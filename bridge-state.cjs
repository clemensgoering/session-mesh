'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
function projectKey(p){return path.win32.normalize(p||'').replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\/,'').replace(/[\\/]+$/,'').toLowerCase();}
function inProject(cwd,root){const value=projectKey(cwd),base=projectKey(root);return Boolean(base)&&(value===base||value.startsWith(base+'\\'));}
async function withFileLock(file,operation,timeout=5000){
  await fs.mkdir(path.dirname(file),{recursive:true});const deadline=Date.now()+timeout;
  for(;;){try{await fs.mkdir(file);break;}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()>=deadline)throw Error(`Session Mesh coordination lock busy: ${file}. No operation attempted; inspect before retrying.`);await new Promise(r=>setTimeout(r,50));}}
  try{return await operation();}finally{await fs.rmdir(file);}
}
class BridgeState {
  constructor(file=path.join(__dirname,'bridge-state.json')){this.file=file;this.writes=Promise.resolve();}
  async read(){try{const value=JSON.parse(await fs.readFile(this.file,'utf8'));if(value.version!==1)throw Error('Unsupported Session Mesh state version');return value;}catch(e){if(e.code==='ENOENT')return {version:1,codexMode:'any-owner',desktopOwners:{},mobileChecks:{}};throw e;}}
  async update(change){const operation=this.writes.catch(()=>{}).then(()=>withFileLock(this.file+'.lock',async()=>{const state=await this.read();await change(state);const tmp=this.file+`.${process.pid}.tmp`;await fs.writeFile(tmp,JSON.stringify(state,null,2)+'\n');await fs.rename(tmp,this.file);return state;}));this.writes=operation;return operation;}
  async setOrchestrator(root,id){if(!path.win32.isAbsolute(root||''))throw Error('Select an absolute project root first');return this.update(s=>{s.projectOrchestrators=s.projectOrchestrators||{};s.projectOrchestrators[projectKey(root)]={id,projectPath:root};if(s.orchestratorId===id)delete s.orchestratorId;});}
  async setLabel(id,label){if(typeof id!=='string'||!/^(?:claude|codex):[a-f0-9-]{36}$/i.test(id))throw Error('Use a full session ID');if(typeof label!=='string'||label.length>120||/[\x00-\x1f\x7f]/.test(label))throw Error('Label must be a single line of at most 120 characters');return this.update(s=>{s.labels=s.labels||{};if(label.trim())s.labels[id]=label.trim();else delete s.labels[id];});}
  async confirmDesktop(ownerClientId){if(!ownerClientId)throw Error('No native owner to confirm');return this.update(s=>{s.desktopOwners[ownerClientId]={confirmedAt:new Date().toISOString(),evidence:'user-confirmed'};});}
  async recordProbe(id,result){return this.update(s=>{s.lastProbe={id,ownerClientId:result.ownerClientId||null,messageId:result.messageId,expectedReply:result.expectedReply,status:result.status,at:new Date().toISOString()};});}
  async confirmMobile(id,ownerClientId){return this.update(s=>{const p=s.lastProbe;if(!p||p.id!==id||p.ownerClientId!==ownerClientId||Date.now()-Date.parse(p.at)>15*60*1000)throw Error('Run a fresh connection test for this owner first');s.mobileChecks[id]={ownerClientId,messageId:p.messageId,confirmedAt:new Date().toISOString(),evidence:'user-confirmed-on-phone'};});}
}
function routingStatus(row,state,observedType){
  const observed=observedType==='vscode'?'vscode':observedType==='desktop'?'desktop':null;
  const confirmation=state.desktopOwners?.[row.ownerClientId];
  const ownerApp=row.harness==='claude'?(row.entrypoint||'unknown'):observed || (confirmation?'desktop-confirmed':'unknown');
  const ownerEvidence=row.harness==='claude'?'native-registry':observed?'native-client-status':confirmation?'user-confirmed':'unavailable';
  const desktop=ownerApp==='desktop'||ownerApp==='desktop-confirmed';
  const brokenView=row.harness==='codex'&&row.uiState==='needs-reload';
  const routeReady=Boolean(row.reachable)&&!brokenView&&(row.harness!=='codex'||state.codexMode==='any-owner'||desktop);
  const mobile=state.mobileChecks?.[row.id];
  const assignments=Object.values(state.projectOrchestrators||{}).filter(p=>p.id===row.id);
  return {ownerApp,ownerEvidence,nativeClientType:observedType||null,routeReady,routingMode:state.codexMode||'any-owner',remote:mobile&&mobile.ownerClientId===row.ownerClientId?'user-confirmed':row.harness==='claude'?row.remote:'unverified',remoteCheckedAt:mobile?.ownerClientId===row.ownerClientId?mobile?.confirmedAt:null,role:assignments.length||state.orchestratorId===row.id?'orchestrator':'peer',orchestratorProjects:assignments.map(p=>p.projectPath),legacyOrchestrator:state.orchestratorId===row.id,routeBlock:routeReady?null:!row.reachable?'no-live-owner':brokenView?'native-view-needs-reload':observed==='vscode'?'owned-in-vscode':'desktop-owner-not-confirmed'};
}
module.exports={BridgeState,routingStatus,projectKey,inProject,withFileLock};
