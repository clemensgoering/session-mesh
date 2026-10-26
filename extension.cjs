'use strict';
const vscode=require('vscode'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {NativeMesh}=require('./native.cjs');
const {planSetup,applyPlan}=require('./setup.cjs');
function activate(context){
  if(!vscode.workspace.isTrusted||process.platform!=='win32'||vscode.env.remoteName)return;
  const mesh=new NativeMesh(),changed=new vscode.EventEmitter(),output=vscode.window.createOutputChannel('Session Mesh');
  const runtime=path.join(context.globalStorageUri.fsPath,'runtime');
  const runtimeReady=(async()=>{await fs.mkdir(runtime,{recursive:true});for(const name of ['mcp.cjs','native.cjs','ipc.cjs','standards.cjs'])await fs.copyFile(path.join(context.extensionPath,name),path.join(runtime,name));})();
  runtimeReady.catch(e=>output.appendLine(`MCP runtime: ${e.message}`));
  let rows=[],refreshing=null,disposed=false;
  const hidden=new Set(context.globalState.get('hiddenSessions',[]));
  const tree={onDidChangeTreeData:changed.event,getChildren:()=>rows.filter(r=>!hidden.has(r.id)),getTreeItem:r=>{
    const item=new vscode.TreeItem(r.name);item.contextValue='nativeSession';
    item.description=`${r.harness} · ${r.online?'online':'nicht geladen'} · ${r.available?'verfügbar':r.state} · ${r.nativeId.slice(0,8)}`;
    item.tooltip=`ID: ${r.id}\nQuelle: ${r.source}\nOrdner: ${r.cwd||'unbekannt'}\nErreichbar: ${r.reachable?'ja':'nein'}\nRemote: ${r.remote==='registered'?'beim Anbieter registriert; Verbindung nicht geprüft':'unbekannt'}\nOnline und verfügbar werden separat geprüft.`;
    item.iconPath=new vscode.ThemeIcon(r.available?'pass-filled':r.online?'circle-filled':'circle-outline');item.command={command:'sessionMesh.open',title:'Sessiondetails',arguments:[r]};return item;
  }};
  const view=vscode.window.createTreeView('sessionMesh.sessions',{treeDataProvider:tree});view.description='Vorhandene Threads';
  async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{view.message='Suche native Sitzungen …';try{rows=await mesh.list();if(!disposed){view.message=`${rows.filter(r=>r.reachable).length} erreichbar · ${rows.length} gefunden`;changed.fire();}}catch(e){output.appendLine(e.message);view.message='Erkennung fehlgeschlagen – siehe Ausgabe';}finally{refreshing=null;}})();return refreshing;}
  async function choose(r){return r||await vscode.window.showQuickPick(rows.filter(s=>!hidden.has(s.id)).map(s=>({label:s.name,description:`${s.id} · ${s.state}`,s}))).then(r=>r?.s);}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function command(id,fn){context.subscriptions.push(vscode.commands.registerCommand(id,async(...args)=>{try{return await fn(...args)}catch(e){vscode.window.showErrorMessage(`Session Mesh: ${e.message}`)}}));}
  command('sessionMesh.refresh',refresh);
  command('sessionMesh.remove',async r=>{r=await choose(r);if(!r)return;hidden.add(r.id);await context.globalState.update('hiddenSessions',[...hidden]);changed.fire();});
  command('sessionMesh.restore',async()=>{hidden.clear();await context.globalState.update('hiddenSessions',[]);await refresh();});
  command('sessionMesh.copyId',async r=>{r=await choose(r);if(r)await vscode.env.clipboard.writeText(r.id);});
  command('sessionMesh.open',async r=>{r=await choose(r);if(!r)return;const panel=vscode.window.createWebviewPanel('sessionMesh.details',r.name,vscode.ViewColumn.Active,{enableScripts:false});panel.webview.html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font-family:var(--vscode-font-family);padding:24px}code{user-select:all}p{line-height:1.6}</style></head><body><h1>${esc(r.name)}</h1><p>ID: <code>${esc(r.id)}</code></p><p>Harness: ${esc(r.harness)}<br>Online: ${r.online?'ja':'nein'}<br>Verfügbar: ${r.available?'ja':'nein oder unbekannt'}<br>Status: ${esc(r.state)}<br>Remote: ${esc(r.remote)}<br>Ordner: ${esc(r.cwd)}</p><p>Dies ist eine vorhandene native Sitzung. Session Mesh startet oder übernimmt sie nicht. Ein gespeicherter Thread ohne Live-Verbindung kann erst nach Öffnen beim Anbieter Nachrichten empfangen. „Aus Session Mesh entfernen“ blendet den Eintrag aus; der Chat bleibt erhalten.</p><p>Remote-Steuerung bleibt beim Anbieter. Für Claude im vorhandenen Chat /remote-control verwenden. „Registriert“ bestätigt keine aktuelle Mobilverbindung. Codex-Remote-Status ist noch unbekannt.</p></body></html>`;context.subscriptions.push(panel);});
  command('sessionMesh.send',async r=>{r=await choose(r);if(!r)return;if(!r.reachable)throw Error('Kein Live-Empfänger. Öffne zuerst den bestehenden Thread im Anbieterfenster.');const text=await vscode.window.showInputBox({title:`An vorhandene Sitzung ${r.name}`,prompt:r.id});if(!text)return;await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Session Mesh: Nachricht zustellen'},async()=>{const result=await mesh.send(r.id,text);output.appendLine(`${result.messageId} → ${r.id}: ${result.status}`);vscode.window.showInformationMessage(`${r.name}: ${result.status}. Dies bestätigt noch keine Bearbeitung.`);});});
  command('sessionMesh.setup',async()=>{const scope=await vscode.window.showQuickPick([{label:'Alle Projekte dieses Benutzers',description:'Globale MCP-Konfiguration und gemeinsame Standards',user:true},{label:'Nur dieses Projekt',description:'Projektbezogene Konfiguration und Standards',user:false}],{title:'Session Mesh für Claude und Codex einrichten'});if(!scope)return;let root=os.homedir();if(!scope.user){const folder=await vscode.window.showWorkspaceFolderPick({placeHolder:'Projekt auswählen'});if(!folder)return;root=folder.uri.fsPath;}let node=vscode.workspace.getConfiguration('sessionMesh').get('nodePath');if(!path.isAbsolute(node||'')){node=await vscode.window.showInputBox({title:'Absoluter Pfad zu Node.js 22+',value:'C:\\Program Files\\nodejs\\node.exe'});if(!node)return;await vscode.workspace.getConfiguration('sessionMesh').update('nodePath',node,vscode.ConfigurationTarget.Global);}
    await runtimeReady;const plan=await planSetup(root,node,path.join(runtime,'mcp.cjs'),{user:scope.user});await applyPlan(plan);vscode.window.showInformationMessage(`Session Mesh: ${plan.length} Dateien eingerichtet. Bestehende Chats müssen MCP/Projektanweisungen neu laden; native Freigaben bleiben erforderlich.`);
  });
  // Retired 0.1 commands explain the migration; never create/stop provider chats.
  command('sessionMesh.create',async()=>{vscode.window.showInformationMessage('Session Mesh verbindet vorhandene Chats. Öffne einen Chat bei Claude/Codex und aktualisiere hier.');await refresh();});
  command('sessionMesh.stop',async()=>{vscode.window.showInformationMessage('Session Mesh beendet keine fremden Chats. Nutze „Aus Session Mesh entfernen“ zum Ausblenden.');});
  context.subscriptions.push(view,changed,output,{dispose(){disposed=true;mesh.close();}});
  const interval=setInterval(()=>{if(view.visible)void refresh();},45000);context.subscriptions.push({dispose(){clearInterval(interval)}});
  void refresh();
  if(!context.globalState.get('tunnelOnboardingShown')){
    void vscode.window.showInformationMessage('Session Mesh verbindet jetzt vorhandene Chats. Richte Werkzeuge und Standards einmal pro Projekt ein; laufende Chats müssen MCP neu laden.','Projekt einrichten').then(choice=>{if(choice)void vscode.commands.executeCommand('sessionMesh.setup');});
    void context.globalState.update('tunnelOnboardingShown',true);
  }
}
module.exports={activate};
