'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { randomUUID, createHash } = require('node:crypto');
const { CodexIPC } = require('./ipc.cjs');
const { BridgeState,routingStatus,inProject,withFileLock }=require('./bridge-state.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function openCodexThread(id) {
  if (!uuid.test(id)) throw Error('Invalid native Codex UUID');
  if (process.platform !== 'win32') throw Error('Opening Codex threads requires local Windows');
  const run = require('node:util').promisify(require('node:child_process').execFile);
  // Only a validated UUID enters this fixed command; no prompt, path or caller URL.
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Start-Process -FilePath 'codex://threads/${id}' -WindowStyle Hidden -ErrorAction Stop`],
    {windowsHide:true, timeout:10000, maxBuffer:4096});
}
function readCodexMetadata(home){
  let db;try{
    const {DatabaseSync}=require('node:sqlite');
    db=new DatabaseSync(path.join(home,'.codex','state_5.sqlite'),{readOnly:true});
    return new Map(db.prepare('SELECT id, cwd, archived FROM threads').all().map(r=>[r.id,r]));
  }catch{return new Map();}finally{db?.close();}
}
function alive(pid) { if (!Number.isInteger(pid) || pid < 1) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function codexState(snapshot) {
  if (!snapshot) return 'unknown';
  const runtime = snapshot.threadRuntimeStatus?.type;
  if (runtime === 'active') return 'busy';
  if (runtime === 'idle') return 'idle';
  return 'unknown';
}
// UI-owner requests use a richer contract than public app-server text input.
// Desktop's rendering path calls text_elements.some without a null fallback.
function ownerText(text){return {type:'text',text,text_elements:[]};}
function ownerSteerParams(conversationId,input,text,messageId,snapshot){
  const cwd=snapshot?.environments?.[0]?.cwd||snapshot?.cwd||undefined;
  // The native UI dereferences restoreMessage.cwd and restoreMessage.context
  // before dispatching turn/steer. This is UI recovery metadata, not a cwd override.
  return {conversationId,input,clientUserMessageId:messageId,attachments:[],restoreMessage:{id:messageId,text,cwd,createdAt:Date.now(),context:{prompt:text,addedFiles:[],fileAttachments:[],ideContext:null,imageAttachments:[],workspaceRoots:cwd?[cwd]:[]}}};
}
function ownerViewHealth(snapshot){
  if(!snapshot)return {uiState:'unknown',invalidTextInputs:0};
  const pending=[snapshot],seen=new Set();let invalidTextInputs=0;
  while(pending.length){const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
    if(seen.size>150000)return {uiState:'unknown',invalidTextInputs};
    if(Array.isArray(value.params?.input))for(const input of value.params.input)if(input?.type==='text'&&!Array.isArray(input.text_elements))invalidTextInputs++;
    for(const next of Object.values(value))if(next&&typeof next==='object')pending.push(next);
  }
  return {uiState:invalidTextInputs?'needs-reload':'ready',invalidTextInputs};
}
function ownerReceipt(response,method){
  // eUt in the owning extension unwraps {method,result} once before IPC replies.
  // The method discriminator is on the OUTER IPC response, not result.method.
  if(response?.type!=='response'||response.resultType!=='success'||response.method!==method)throw Error('Unexpected owner response; delivery unknown. Do not retry automatically.');
  const payload=response.result?.result;
  const turnId=method==='thread-follower-start-turn'?payload?.turn?.id:payload?.turnId;
  if(typeof turnId!=='string'||!turnId)throw Error('Owner response has no turn ID; delivery unknown. Do not retry automatically.');
  return {turnId,resultMethod:response.method};
}
const claudeTitleFiles=new Map(),claudeTitleCache=new Map();
function parseClaudeTitles(text,id){let custom,ai;for(const line of text.split('\n'))try{const r=JSON.parse(line);if(r.sessionId!==id)continue;const value=r.type==='custom-title'?r.customTitle:r.type==='ai-title'?r.aiTitle:null;if(typeof value!=='string'||!value.trim())continue;const title=value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,256);if(r.type==='custom-title')custom=title;else ai=title;}catch{}return custom?{title:custom,titleSource:'claude-custom-title'}:ai?{title:ai,titleSource:'claude-ai-title'}:null;}
async function readClaudeTitle(home,id,cwd){
  if(!uuid.test(id))return null;const key=home+':'+id,root=path.join(home,'.claude','projects');
  try{
    let file=claudeTitleFiles.get(key);
    if(!file){const preferred=String(cwd||'').replace(/[^a-zA-Z0-9]/g,'-');const dirs=[preferred,...await fs.readdir(root)];for(const dir of new Set(dirs)){if(!dir)continue;const candidate=path.join(root,dir,id+'.jsonl');try{if((await fs.lstat(candidate)).isFile()){file=candidate;break;}}catch{}}if(!file)return null;claudeTitleFiles.set(key,file);}
    const stat=await fs.lstat(file);if(!stat.isFile())return null;
    const stamp=stat.size+':'+stat.mtimeMs,cached=claudeTitleCache.get(key);if(cached?.stamp===stamp)return cached.value;
    const handle=await fs.open(file,'r');let texts=[];try{const bytes=128*1024;for(const start of new Set([0,Math.max(0,stat.size-bytes)])){const buffer=Buffer.alloc(Math.min(bytes,stat.size-start));const read=await handle.read(buffer,0,buffer.length,start);texts.push(buffer.subarray(0,read.bytesRead).toString('utf8'));}}finally{await handle.close();}
    const value=parseClaudeTitles(texts.join('\n'),id);if(claudeTitleCache.size>1000){claudeTitleFiles.clear();claudeTitleCache.clear();}claudeTitleCache.set(key,{stamp,value});return value;
  }catch{claudeTitleFiles.delete(key);return null;}
}
async function readClaude(home) {
  const dir = path.join(home, '.claude', 'sessions'); let names; try { names = await fs.readdir(dir); } catch { return []; }
  const rows = await Promise.all(names.filter(n => /^\d+\.json$/.test(n)).map(async n => {
    try {
      const r = JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'));
      if (!uuid.test(r.sessionId) || !alive(r.pid)) return null;
      const endpoint = typeof r.messagingSocketPath === 'string' && /^\\\\\.\\pipe\\(?:LOCAL\\)?cc-msg-[a-z0-9-]+$/i.test(r.messagingSocketPath) ? r.messagingSocketPath : null;
      const title=await readClaudeTitle(home,r.sessionId,r.cwd);
      return { id: `claude:${r.sessionId}`, nativeId: r.sessionId, name: title?.title||r.name || r.sessionId, nativeTitle:title?.title||null,titleSource:title?.titleSource||'native-registry',registryName:r.name||null, harness: 'claude', cwd: r.cwd || '', pid: r.pid, procStart: r.procStart, ownerClientId:`claude:${r.pid}:${r.procStart||''}`, state: r.status || 'unknown', online: false, available: false, reachable: false, remote: r.bridgeSessionId ? 'registered' : 'unknown', endpoint, version: r.version, entrypoint: r.entrypoint || 'unknown', source: 'live-registry' };
    } catch { return null; }
  }));
  return rows.filter(Boolean);
}
async function probePipe(endpoint) {
  return new Promise(resolve => {
    const socket = net.connect(endpoint), finish = ok => { clearTimeout(timer); socket.destroy(); resolve(ok); };
    const timer = setTimeout(() => finish(false), 500);
    socket.on('connect', () => finish(true)); socket.on('error', () => finish(false));
  });
}
function resolveTarget(rows, target) {
  const exact = rows.find(s => s.id === target); if (exact) return exact;
  const matches = rows.filter(s => s.nativeId === target || s.name === target);
  if (matches.length !== 1) throw Error(matches.length ? 'Ambiguous target; use harness-qualified ID' : 'Session not found');
  return matches[0];
}
class NativeMesh {
  constructor({ home = os.homedir(), ipc = new CodexIPC(), limit = 100, state = new BridgeState(), opener = openCodexThread, openTimeout = 20000 } = {}) { this.home = home; this.ipc = ipc; this.limit = limit; this.bridgeState=state; this.opener=opener; this.openTimeout=openTimeout; this.opening=new Map(); this.openQueue=Promise.resolve(); }
  async openSession(id) {
    if (typeof id !== 'string' || !id.startsWith('codex:') || !uuid.test(id.slice(6))) throw Error('Use an exact codex:<native-UUID> ID from list_sessions');
    if (this.opening.has(id)) return this.opening.get(id);
    const pending=this.openQueue.catch(()=>{}).then(()=>this.bridgeState.file?withFileLock(this.bridgeState.file+'.open.lock',()=>this.openExisting(id),30000):this.openExisting(id));
    this.openQueue=pending;this.opening.set(id,pending);
    try{return await pending;}finally{this.opening.delete(id);}
  }
  async openExisting(id) {
    const row=(await this.list({withState:false,targetId:id})).find(r=>r.id===id);
    if (!row || row.harness!=='codex') throw Error('Existing Codex thread not found in the discovery index; no opening attempted');
    if(row.archived)throw Error('Archived Codex threads must be restored by the user before opening');
    if (row.reachable) return {status:'already-online',...await this.inspect(id),detail:'Existing owner preserved. No navigation or message was sent.'};
    // Do not navigate if ownership appeared since discovery.
    let owner;try{owner=await this.ipc.owner(row.nativeId);}catch{}
    if(owner?.handledByClientId)return {status:'already-online',...await this.inspect(id),detail:'Owner appeared before opening. No navigation or message was sent.'};
    await this.opener(row.nativeId);
    const deadline=Date.now()+this.openTimeout;
    let last={id,name:row.name,online:false,available:false,state:'not-loaded',routeReady:false,routeBlock:'no-live-owner',ownerClientId:null};
    do {
      try {
        const current=await this.ipc.owner(row.nativeId);
        if(current?.handledByClientId){
          const snapshot=await this.ipc.snapshot(row.nativeId,current.handledByClientId);
          const state=codexState(snapshot),health=ownerViewHealth(snapshot);
          const route=routingStatus({...row,reachable:true,ownerClientId:current.handledByClientId,...health},await this.bridgeState.read(),this.ipc.clientTypes?.get(current.handledByClientId));
          last={id,name:row.name,online:true,available:state==='idle',state,ownerClientId:current.handledByClientId,...health,...route};
          if(state!=='unknown')return {status:route.routeReady?'ready':'blocked',...last,detail:'Native owner observed after UI open request. No message was sent; opening is not a model or mobile receipt.'};
        }
      }catch{}
      if(Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,Math.min(500,deadline-Date.now())));
    }while(Date.now()<deadline);
    return {status:'open-requested',...last,routeReady:false,routeBlock:last.online?'native-state-unknown':'no-live-owner',detail:'UI open requested, but readiness was not verified before timeout. No message was sent. Inspect before any retry; do not loop opening requests.'};
  }
  async list({ withState = true, projectPath, targetId } = {}) {
    if(projectPath!==undefined&&(typeof projectPath!=='string'||!path.win32.isAbsolute(projectPath)))throw Error('project_path must be an absolute Windows project path');
    const bridge=await this.bridgeState.read();
    const claude = await readClaude(this.home);
    await Promise.all(claude.map(async r => { r.online = r.endpoint ? await probePipe(r.endpoint) : false; r.reachable = r.online; r.available = r.online && r.state === 'idle'; }));
    let text = ''; try { text = await fs.readFile(path.join(this.home, '.codex', 'session_index.jsonl'), 'utf8'); } catch {}
    const index = new Map(); for (const line of text.split('\n')) try { const r = JSON.parse(line); if (uuid.test(r.id)) index.set(r.id, r); } catch {}
    const metadata=readCodexMetadata(this.home);
    const candidates = [...index.values()].filter(r=>(!targetId||`codex:${r.id}`===targetId)&&(!projectPath||inProject(metadata.get(r.id)?.cwd||'',projectPath))).sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, this.limit);
    let connected = false; try { await this.ipc.connect(); connected = true; } catch {}
    const codex = []; let next = 0;
    await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, async () => {
      while (next < candidates.length) {
        const r = candidates[next++];
        const saved=metadata.get(r.id);
        const item = { id: `codex:${r.id}`, nativeId: r.id, name: r.thread_name || r.id, harness: 'codex', cwd: saved?.cwd||'', cwdSource:saved?.cwd?'saved-metadata':'unknown',archived:saved?Boolean(saved.archived):null, state: 'not-loaded', online: false, available: false, reachable: false, remote: 'unknown', source: 'saved-index', updatedAt: r.updated_at };
        if (connected) try {
          const owner = await this.ipc.owner(r.id); item.owner = owner.handledByClientId; item.ownerClientId=item.owner; item.online = item.reachable = true; item.source = 'live-owner'; item.state = 'unknown';
          if (withState) { const snap = await this.ipc.snapshot(r.id, item.owner); item.state = codexState(snap); const cwd=snap?.cwd||snap?.environments?.[0]?.cwd;if(cwd){item.cwd=cwd;item.cwdSource='live-snapshot';} item.available = item.state === 'idle'; Object.assign(item,ownerViewHealth(snap)); }
        } catch {}
        codex.push(item);
      }
    }));
    return [...claude, ...codex].filter(r=>!projectPath||inProject(r.cwd,projectPath)).map(row=>({...row,providerName:row.name,name:bridge.labels?.[row.id]||row.name,labelSource:bridge.labels?.[row.id]?'user-label':row.titleSource||'saved-index',...routingStatus(row,bridge,this.ipc.clientTypes?.get(row.ownerClientId))})).sort((a,b) => Number(b.reachable)-Number(a.reachable) || a.name.localeCompare(b.name));
  }
  async send(targetId, text, sender = { id: 'human-via-vscode', name: 'VS Code user' }) {
    if (typeof text !== 'string' || !text.trim() || text.length > 60000) throw Error('Message empty or exceeds 60,000 characters');
    const rows = await this.list({ withState: false, targetId:targetId?.startsWith('codex:')?targetId:undefined }), target = resolveTarget(rows, targetId);
    if (!target.reachable) throw Error('Target has no live endpoint/owner. Open its existing thread in the provider UI.');
    if (sender.id === target.id) throw Error('Self-messaging is not allowed');
    const messageId = randomUUID();
    const content = `[Session Mesh message ${messageId}; sender ${sender.name} (${sender.id}); ${sender.id === 'human-via-vscode' ? 'typed by user in Session Mesh' : 'self-reported peer identity, not human approval'}]\n${text}`;
    if (target.harness === 'claude') return this.sendClaude(target, content, messageId);
    const owner = await this.ipc.owner(target.nativeId);
    const bridge=await this.bridgeState.read();
    const routing=routingStatus({...target,ownerClientId:owner.handledByClientId},bridge,this.ipc.clientTypes?.get(owner.handledByClientId));
    if(!routing.routeReady)throw Error(`Desktop tunnel mode: current Codex owner is ${routing.ownerApp} (${owner.handledByClientId}). Release the VS Code chat, open the SAME thread in Desktop, then confirm its owner in Session Mesh. No takeover or message was attempted.`);
    if (sender.id !== 'human-via-vscode' && owner.result?.supportsUntrustedAppInput !== true) throw Error('Owner does not advertise untrusted input support');
    // The owning UI applies its existing model, permission and routing settings.
    const snapshot = await this.ipc.snapshot(target.nativeId, owner.handledByClientId);
    if(ownerViewHealth(snapshot).uiState==='needs-reload')throw Error('The owning Codex view still caches malformed text input from an older delivery. Reload the owning Codex window, then reopen the same thread. No new message was sent; do not resend the already received business message.');
    const busy = codexState(snapshot) === 'busy';
    if (!snapshot || codexState(snapshot) === 'unknown') throw Error('Native turn state is unknown; refresh before sending to avoid starting a competing turn');
    const method = busy ? 'thread-follower-steer-turn' : 'thread-follower-start-turn';
    const input = [ownerText(content)];
    const params = busy ? ownerSteerParams(target.nativeId,input,content,messageId,snapshot) : {
      conversationId: target.nativeId,
      turnStart: { request: { threadId: target.nativeId, input, clientUserMessageId: messageId }, context: { inheritThreadSettings: true } }
    };
    const latestOwner=await this.ipc.owner(target.nativeId);
    if(latestOwner.handledByClientId!==owner.handledByClientId)throw Error('Owner changed before submission; refresh and inspect. Nothing was sent.');
    const response = await this.ipc.request(method, params, { version: busy ? 1 : 2, timeout: 20000, targetClientId: owner.handledByClientId });
    const receipt=ownerReceipt(response,method);
    return { messageId, to: target.id, status: 'accepted', ownerClientId:owner.handledByClientId,ownerApp:routing.ownerApp,remote:routing.remote, detail: 'Owning UI accepted request; not a model completion or mobile acknowledgement', ...receipt };
  }
  async inspect(targetId){
    const row=resolveTarget(await this.list({targetId}),targetId);
    return {id:row.id,name:row.name,harness:row.harness,online:row.online,available:row.available,state:row.state,uiState:row.uiState||'unknown',invalidTextInputs:row.invalidTextInputs||0,ownerClientId:row.ownerClientId||null,ownerApp:row.ownerApp,ownerEvidence:row.ownerEvidence,routeReady:row.routeReady,routeBlock:row.routeBlock,remote:row.remote,remoteCheckedAt:row.remoteCheckedAt,role:row.role};
  }
  async confirmDesktop(targetId,expectedOwner){
    const row=resolveTarget(await this.list({withState:false}),targetId);if(row.harness!=='codex'||!row.ownerClientId)throw Error('Select a reachable Codex thread');
    if(expectedOwner&&row.ownerClientId!==expectedOwner)throw Error('Owner changed while confirming. Refresh and check Desktop again.');
    if(this.ipc.clientTypes?.get(row.ownerClientId)==='vscode')throw Error('Native IPC identifies this owner as VS Code. Close its Codex chat and open the existing thread in Desktop first.');
    await this.bridgeState.confirmDesktop(row.ownerClientId);return this.inspect(row.id);
  }
  async probe(targetId){
    const marker='MESH_PROBE_'+randomUUID();
    const result=await this.send(targetId,`Session Mesh connectivity test. Reply with exactly ${marker}. Do not use tools, change files or send messages to other sessions. This tests local routing; the user will separately check the same marker on their phone.`);
    const probe={...result,expectedReply:marker};await this.bridgeState.recordProbe(targetId,probe);return probe;
  }
  async sendClaude(target, content, messageId) {
    // Use only the peer credential, never the own-child token or a bypass-mode claim.
    const hash = createHash('sha256').update(target.endpoint.toLowerCase()).digest('hex');
    const file = path.join(this.home, '.claude', 'sessions', `${target.pid}.${hash}.key`);
    const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Unsafe peer credential file');
    const key = JSON.parse(await fs.readFile(file, 'utf8'));
    if (typeof key.peerToken !== 'string' || !/^[0-9a-f]{32}$/i.test(key.peerToken)) throw Error('Unsupported peer credential format');
    if (target.procStart && key.procStartFt && target.procStart !== key.procStartFt) throw Error('Claude process identity changed');
    return new Promise((resolve, reject) => {
      const socket = net.connect(target.endpoint); let sent = false;
      const timer = setTimeout(() => { socket.destroy(); reject(Error('Claude pipe timeout; delivery may be unknown')); }, 3000);
      socket.on('error', e => { clearTimeout(timer); reject(Error(`Claude pipe ${e.code || 'error'}${sent ? '; delivery unknown' : ''}`)); });
      socket.on('connect', () => {
        const auth = { type: 'auth', token: key.peerToken };
        const frame = { type: 'user', session_id: target.nativeId, uuid: messageId, msgV: 1, msg_id: messageId, from: 'session-mesh', message: { role: 'user', content } };
        socket.end(JSON.stringify(auth) + '\n' + JSON.stringify(frame) + '\n', () => { sent = true; clearTimeout(timer); resolve({ messageId, to: target.id, status: 'submitted', ownerClientId:target.ownerClientId,ownerApp:target.ownerApp,remote:target.remote, detail: 'Written to native peer inbox; receiver can hold/refuse it. No delivery acknowledgement.' }); });
      });
    });
  }
  close() { this.ipc.close(); }
}
module.exports = { NativeMesh, readClaude, resolveTarget, codexState, alive, ownerText, ownerReceipt, ownerViewHealth, ownerSteerParams, openCodexThread, inProject, readCodexMetadata, parseClaudeTitles, readClaudeTitle };
