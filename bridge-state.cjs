'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
class BridgeState {
  constructor(file=path.join(__dirname,'bridge-state.json')){this.file=file;this.writes=Promise.resolve();}
  async read(){try{const value=JSON.parse(await fs.readFile(this.file,'utf8'));if(value.version!==1)throw Error('Unsupported Session Mesh state version');return value;}catch(e){if(e.code==='ENOENT')return {version:1,codexMode:'any-owner',desktopOwners:{},mobileChecks:{}};throw e;}}
  async update(change){const operation=this.writes.catch(()=>{}).then(async()=>{const state=await this.read();await change(state);await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+`.${process.pid}.tmp`;await fs.writeFile(tmp,JSON.stringify(state,null,2)+'\n');await fs.rename(tmp,this.file);return state;});this.writes=operation;return operation;}
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
  const routeReady=Boolean(row.reachable)&&(row.harness!=='codex'||state.codexMode==='any-owner'||desktop);
  const mobile=state.mobileChecks?.[row.id];
  return {ownerApp,ownerEvidence,nativeClientType:observedType||null,routeReady,routingMode:state.codexMode||'any-owner',remote:mobile&&mobile.ownerClientId===row.ownerClientId?'user-confirmed':row.harness==='claude'?row.remote:'unverified',remoteCheckedAt:mobile?.ownerClientId===row.ownerClientId?mobile?.confirmedAt:null,role:state.orchestratorId===row.id?'orchestrator':'peer',routeBlock:routeReady?null:!row.reachable?'no-live-owner':observed==='vscode'?'owned-in-vscode':'desktop-owner-not-confirmed'};
}
module.exports={BridgeState,routingStatus};
