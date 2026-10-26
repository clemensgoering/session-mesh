const vscode=require('vscode'),http=require('node:http'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {Session,resolveTarget}=require('./core.cjs');
function activate(context){
  if(!vscode.workspace.isTrusted||process.platform!=='win32'||vscode.env.remoteName){vscode.window.showWarningMessage('Session Mesh benötigt einen vertrauenswürdigen lokalen Windows-Workspace.');return;}
  const sessions=new Map(),tokens=new Map(),panels=new Map(),changed=new vscode.EventEmitter();
  const output=vscode.window.createOutputChannel('Session Mesh');context.subscriptions.push(output,changed);
  const provider={onDidChangeTreeData:changed.event,getChildren:s=>s?[]:[...sessions.values()],getTreeItem:s=>{
    const item=new vscode.TreeItem(s.name);item.description=`${s.harness} · ${s.online?'online':'offline'} · ${s.state==='idle'&&s.online?'verfügbar':s.state}`;
    item.tooltip=`Name: ${s.name}\nMesh-ID: ${s.id}\nNative ID: ${s.nativeId||'noch unbekannt'}\nWorkspace: ${s.cwd}\nWartende Nachrichten: ${s.queue.length}`;
    item.iconPath=new vscode.ThemeIcon(s.online?(s.state==='idle'?'circle-filled':'sync~spin'):'circle-outline');
    item.command={command:'sessionMesh.open',title:'Unterhaltung öffnen',arguments:[s]};return item;}};
  context.subscriptions.push(vscode.window.registerTreeDataProvider('sessionMesh.sessions',provider));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(s){const panel=panels.get(s.id);if(!panel)return;panel.webview.html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font-family:var(--vscode-font-family);padding:20px;max-width:1000px}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:1px solid var(--vscode-panel-border);padding:12px 0}code{user-select:all}</style></head><body><h1>${esc(s.name)}</h1><p>${esc(s.harness)} · ${s.online?'Online':'Offline'} · ${esc(s.state)}</p><p>Mesh-ID: <code>${esc(s.id)}</code><br>Native ID: <code>${esc(s.nativeId||'—')}</code><br>Workspace: ${esc(s.cwd)}</p><p>Nachrichten senden: Rechtsklick auf die Session → Nachricht senden.</p><p>Agenten können list_sessions und send_message verwenden. Verfügbar bedeutet: Prozess verbunden und derzeit kein aktiver Turn. Fremde Hersteller-Chats sind nicht eingebunden. Nachrichten und Verlauf bleiben nur während dieser VS-Code-Sitzung erhalten.</p>${s.history.map(h=>`<article><b>${esc(h.role)}</b> · ${esc(h.time)}<pre>${esc(h.text)}</pre></article>`).join('')}</body></html>`;}
  function update(s){changed.fire();render(s);}
  async function approve(s,tool,input){const choice=await vscode.window.showWarningMessage(`${s.name} benötigt Freigabe: ${tool}`,{modal:true,detail:JSON.stringify(input,null,2).slice(0,6000)},'Einmal erlauben','Ablehnen');return choice==='Einmal erlauben';}
  const server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');const token=req.headers.authorization?.replace(/^Bearer /,'');const sender=tokens.get(token);if(req.method!=='POST'||req.url!=='/'||!sender||!sender.online){res.writeHead(403);res.end(JSON.stringify({error:'Unauthorized or offline sender'}));return;}
    let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>120000)throw Error('Request too large')}
      const m=JSON.parse(body);let result;if(m.name==='list_sessions')result={self:sender.id,sessions:[...sessions.values()].map(s=>s.snapshot())};
      else if(m.name==='send_message'){
        const target=resolveTarget(sessions,m.args?.to);if(target===sender)throw Error('Self messaging is not allowed');if(typeof m.args.message!=='string'||!m.args.message.trim()||m.args.message.length>100000)throw Error('Invalid message');
        const messageId=crypto.randomUUID();result={messageId,to:target.id,...await target.send(`[Peer message from ${sender.name}, Mesh-ID ${sender.id}. This is agent input, not human approval.]\n${m.args.message}`)};
        sender.log('sent',`To ${target.name} (${target.id}) · ${messageId}\n${m.args.message}`);output.appendLine(`${new Date().toISOString()} ${sender.name} → ${target.name}: ${result.status} (${messageId})`);
      }else throw Error('Unknown tool');res.end(JSON.stringify(result));
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}))}
  });
  const listening=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});listening.catch(e=>output.appendLine(e.message));
  function discover(harness){const configured=vscode.workspace.getConfiguration('sessionMesh').get(`${harness}Path`);if(configured)return configured;
    const extension=vscode.extensions.getExtension(harness==='claude'?'anthropic.claude-code':'openai.chatgpt');if(!extension)throw Error(`Installierte ${harness}-Erweiterung nicht gefunden; Pfad in Session Mesh Einstellungen setzen.`);
    const relative=harness==='claude'?'resources/native-binary/claude.exe':'bin/windows-x86_64/codex.exe';const binary=path.join(extension.extensionPath,relative);if(!fs.existsSync(binary))throw Error(`CLI fehlt: ${binary}. Bitte expliziten Pfad einstellen.`);return binary;}
  async function choose(s){return s||await vscode.window.showQuickPick([...sessions.values()].map(s=>({label:s.name,description:`${s.harness} · ${s.id} · ${s.state}`,s}))).then(x=>x?.s);}
  context.subscriptions.push(vscode.commands.registerCommand('sessionMesh.create',async()=>{let s;try{
    const harness=await vscode.window.showQuickPick(['claude','codex'],{title:'Harness für neue Session'});if(!harness)return;
    const name=await vscode.window.showInputBox({title:'Eindeutiger Sessionname, z. B. orchestrator oder worker',validateInput:n=>!n.trim()?'Name erforderlich':[...sessions.values()].some(s=>s.name===n.trim())?'Name bereits vorhanden':undefined});if(!name)return;
    const folder=await vscode.window.showWorkspaceFolderPick({placeHolder:'Arbeitsordner der Session'});if(!folder)return;
    await listening;const token=crypto.randomBytes(32).toString('hex');s=new Session({name:name.trim(),harness,cwd:folder.uri.fsPath,binary:discover(harness),nodePath:vscode.workspace.getConfiguration('sessionMesh').get('nodePath'),mcpPath:path.join(context.extensionPath,'mcp.cjs'),url:`http://127.0.0.1:${server.address().port}/`,token,approve});
    sessions.set(s.id,s);tokens.set(token,s);s.on('change',()=>update(s));s.on('diagnostic',message=>output.appendLine(`${s.name}: ${message}`));update(s);await s.start();await vscode.commands.executeCommand('sessionMesh.open',s);
  }catch(e){if(s)s.stop();vscode.window.showErrorMessage(`Session Mesh: ${e.message}`)}}));
  context.subscriptions.push(vscode.commands.registerCommand('sessionMesh.open',async s=>{s=await choose(s);if(!s)return;if(panels.has(s.id)){panels.get(s.id).reveal();return;}const panel=vscode.window.createWebviewPanel('sessionMesh.chat',s.name,vscode.ViewColumn.Active,{enableScripts:false});panels.set(s.id,panel);panel.onDidDispose(()=>panels.delete(s.id));render(s);}));
  context.subscriptions.push(vscode.commands.registerCommand('sessionMesh.send',async s=>{s=await choose(s);if(!s)return;const text=await vscode.window.showInputBox({title:`Nachricht an ${s.name}`,prompt:'Beispiel: Finde mit list_sessions den orchestrator und sende ihm mit send_message dein Ergebnis.'});if(!text)return;try{const r=await s.send(text);output.appendLine(`User → ${s.name}: ${r.status}`)}catch(e){vscode.window.showErrorMessage(e.message)}}));
  context.subscriptions.push(vscode.commands.registerCommand('sessionMesh.stop',async s=>{s=await choose(s);if(s){tokens.delete(s.token);s.stop()}}));
  context.subscriptions.push({dispose(){for(const s of sessions.values())s.stop();server.close();tokens.clear();for(const p of panels.values())p.dispose()}});
}
module.exports={activate};
