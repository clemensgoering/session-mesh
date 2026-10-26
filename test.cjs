'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {CodexIPC}=require('./ipc.cjs');
const {NativeMesh,resolveTarget,codexState,ownerText,ownerReceipt,ownerViewHealth}=require('./native.cjs');
const {createHandler}=require('./mcp.cjs');
const {planSetup,applyPlan,managed}=require('./setup.cjs');
const {BridgeState,routingStatus}=require('./bridge-state.cjs');
test('addressing is harness-qualified and rejects duplicate names',()=>{
  const rows=[{id:'claude:a',nativeId:'a',name:'same'},{id:'codex:b',nativeId:'b',name:'same'}];
  assert.equal(resolveTarget(rows,'codex:b'),rows[1]);assert.throws(()=>resolveTarget(rows,'same'),/Ambiguous/);assert.throws(()=>resolveTarget(rows,'missing'),/not found/);
});
test('missing state is unknown, never idle',()=>{assert.equal(codexState(null),'unknown');assert.equal(codexState({threadRuntimeStatus:{type:'active'}}),'busy');assert.equal(codexState({threadRuntimeStatus:{type:'idle'}}),'idle')});
test('native discovery reads saved index without treating disk records as online',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mesh-test-'));try{
    await fs.mkdir(path.join(dir,'.codex'));await fs.writeFile(path.join(dir,'.codex/session_index.jsonl'),JSON.stringify({id:'11111111-1111-1111-1111-111111111111',thread_name:'saved'})+'\ninvalid');
    const mesh=new NativeMesh({home:dir,ipc:{connect:async()=>{throw Error('offline')},close(){}}});const rows=await mesh.list();assert.equal(rows.length,1);assert.equal(rows[0].reachable,false);assert.equal(rows[0].available,false);
    await assert.rejects(mesh.send(rows[0].id,'hello'),/no live/);
  }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('MCP exposes standards and refuses anonymous sends or identity changes',async()=>{
  const rows=[{id:'codex:a',name:'one',reachable:true},{id:'claude:b',name:'two',reachable:true}];let sent=false;
  const handle=createHandler({list:async()=>rows,send:async()=>{sent=true;return {status:'accepted'}}});
  const call=(name,args={})=>handle({id:1,method:'tools/call',params:{name,arguments:args}});
  assert.match((await handle({id:1,method:'initialize',params:{}})).result.instructions,/explicitly send your final result/);
  assert.equal((await call('send_message',{to:'claude:b',message:'x'})).result.isError,true);assert.equal(sent,false);
  assert.equal((await call('identify_session',{id:'codex:a'})).result.isError,undefined);
  assert.equal((await call('identify_session',{id:'claude:b'})).result.isError,true);
  assert.equal((await call('send_message',{to:'claude:b',message:'x'})).result.isError,undefined);
});
test('setup preserves existing config, backs up files and is idempotent',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mesh-setup-'));try{
    await fs.writeFile(path.join(dir,'.mcp.json'),JSON.stringify({mcpServers:{existing:{command:'keep'}}}));await fs.writeFile(path.join(dir,'AGENTS.md'),'Original instructions\n');
    const node=path.join(dir,'node.exe'),mcp=path.join(dir,'mcp.cjs');const plan=await planSetup(dir,node,mcp);await applyPlan(plan);
    assert.equal(JSON.parse(await fs.readFile(path.join(dir,'.mcp.json'))).mcpServers.existing.command,'keep');
    assert.match(await fs.readFile(path.join(dir,'AGENTS.md'),'utf8'),/^Original instructions/);
    assert.equal((await planSetup(dir,node,mcp)).length,0);assert.ok((await fs.readdir(dir)).some(s=>s.endsWith('.bak')));
  }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('malformed managed blocks fail rather than overwriting user instructions',()=>{assert.throws(()=>managed('hello <!-- SESSION-MESH:START -->','new'),/Malformed/)});
test('Codex active turn uses owning client steering and preserves thread ID',async()=>{
  let call;const ipc={owner:async()=>({handledByClientId:'owner',result:{supportsUntrustedAppInput:true}}),snapshot:async()=>({threadRuntimeStatus:{type:'active'}}),request:async(...args)=>{call=args;return {type:'response',resultType:'success',method:args[0],result:{result:args[0]==='thread-follower-start-turn'?{turn:{id:'fixture-turn'}}:{turnId:'fixture-turn'}}}}};
  const mesh=new NativeMesh({ipc,state:{read:async()=>({codexMode:'any-owner',desktopOwners:{},mobileChecks:{}})}});mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];
  const r=await mesh.send('codex:target','message',{id:'claude:sender',name:'sender'});assert.equal(call[0],'thread-follower-steer-turn');assert.equal(call[1].conversationId,'target');assert.equal(call[2].targetClientId,'owner');assert.equal(r.status,'accepted');
});
test('Codex refuses unknown runtime state before any turn mutation',async()=>{
  let mutated=false;const mesh=new NativeMesh({state:{read:async()=>({version:1,codexMode:'any-owner',desktopOwners:{},mobileChecks:{}})},ipc:{owner:async()=>({result:{supportsUntrustedAppInput:true}}),snapshot:async()=>null,request:async()=>{mutated=true}}});mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];await assert.rejects(mesh.send('codex:target','message'),/state is unknown/);assert.equal(mutated,false);
});
test('IPC parses fragmented frames and declines discovery without claiming ownership',async()=>{
  const ipc=new CodexIPC();let destroyed=false;ipc.socket={destroy(){destroyed=true},writable:true,write(){}};
  let frame;ipc.on('broadcast',m=>frame=m);const body=Buffer.from(JSON.stringify({type:'broadcast',method:'test',params:{name:'ä'}})),h=Buffer.alloc(4);h.writeUInt32LE(body.length);const b=Buffer.concat([h,body]);
  ipc.receive(b.subarray(0,3));ipc.receive(b.subarray(3,9));assert.equal(frame,undefined);ipc.receive(b.subarray(9));assert.equal(frame.params.name,'ä');
  const bad=Buffer.alloc(4);bad.writeUInt32LE(80*1024*1024);ipc.receive(bad);assert.equal(destroyed,true);
});
test('user-wide setup targets both harness configs and global instructions',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mesh-user-'));try{
    const plan=await planSetup(dir,path.join(dir,'node.exe'),path.join(dir,'runtime/mcp.cjs'),{user:true});
    assert.deepEqual(plan.map(p=>path.relative(dir,p.file).replaceAll('\\','/')).sort(),['.claude.json','.claude/CLAUDE.md','.codex/AGENTS.md','.codex/config.toml']);
    await applyPlan(plan);assert.equal((await planSetup(dir,path.join(dir,'node.exe'),path.join(dir,'runtime/mcp.cjs'),{user:true})).length,0);
  }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('idle Codex target starts a turn on exactly its existing owning window',async()=>{
  let call;const mesh=new NativeMesh({state:{read:async()=>({version:1,codexMode:'any-owner',desktopOwners:{},mobileChecks:{}})},ipc:{owner:async()=>({handledByClientId:'owner'}),snapshot:async()=>({threadRuntimeStatus:{type:'idle'}}),request:async(...args)=>{call=args;return {type:'response',resultType:'success',method:args[0],result:{result:args[0]==='thread-follower-start-turn'?{turn:{id:'fixture-turn'}}:{turnId:'fixture-turn'}}}}}});
  mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];await mesh.send('codex:target','hello');
  assert.equal(call[0],'thread-follower-start-turn');assert.equal(call[1].turnStart.request.threadId,'target');assert.equal(call[2].version,2);assert.equal(call[2].targetClientId,'owner');assert.deepEqual(call[1].turnStart.context,{inheritThreadSettings:true});
});
test('peer delivery refuses owners without explicit untrusted-input support',async()=>{
  let called=false;const mesh=new NativeMesh({state:{read:async()=>({version:1,codexMode:'any-owner',desktopOwners:{},mobileChecks:{}})},ipc:{owner:async()=>({result:{}}),request:async()=>{called=true}}});mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];await assert.rejects(mesh.send('codex:target','hello',{id:'claude:sender',name:'sender'}),/untrusted input/);assert.equal(called,false);
});
test('desktop mode blocks unknown owners even when idle and online',()=>{
  const r=routingStatus({id:'codex:a',harness:'codex',reachable:true,ownerClientId:'owner'},{codexMode:'desktop',desktopOwners:{},mobileChecks:{}},undefined);assert.equal(r.routeReady,false);assert.equal(r.ownerApp,'unknown');assert.equal(r.remote,'unverified');
});
test('known VS Code owner cannot be relabelled Desktop by an old user confirmation',()=>{
  const r=routingStatus({id:'codex:a',harness:'codex',reachable:true,ownerClientId:'owner'},{codexMode:'desktop',desktopOwners:{owner:{confirmedAt:'now'}},mobileChecks:{}},'vscode');assert.equal(r.routeReady,false);assert.equal(r.ownerApp,'vscode');assert.equal(r.routeBlock,'owned-in-vscode');
});
test('desktop and mobile evidence expire for a changed owner',()=>{
  const config={codexMode:'desktop',desktopOwners:{old:{confirmedAt:'now'}},mobileChecks:{'codex:a':{ownerClientId:'old',confirmedAt:'now'}}};
  assert.equal(routingStatus({id:'codex:a',harness:'codex',reachable:true,ownerClientId:'old'},config).remote,'user-confirmed');const r=routingStatus({id:'codex:a',harness:'codex',reachable:true,ownerClientId:'new'},config);assert.equal(r.remote,'unverified');assert.equal(r.routeReady,false);
});
test('desktop guard prevents native sends before owner confirmation',async()=>{
  let mutation=false;const mesh=new NativeMesh({state:{read:async()=>({codexMode:'desktop',desktopOwners:{},mobileChecks:{}})},ipc:{owner:async()=>({handledByClientId:'owner'}),request:async()=>{mutation=true}}});mesh.list=async()=>[{id:'codex:a',nativeId:'a',reachable:true,harness:'codex'}];await assert.rejects(mesh.send('codex:a','hi'),/Desktop tunnel mode/);assert.equal(mutation,false);
});
test('owner drift between inspection and submit never mutates a competing session',async()=>{
  let n=0,mutation=false;const mesh=new NativeMesh({state:{read:async()=>({codexMode:'any-owner'})},ipc:{owner:async()=>({handledByClientId:++n===1?'first':'second'}),snapshot:async()=>({threadRuntimeStatus:{type:'idle'}}),request:async()=>{mutation=true}}});mesh.list=async()=>[{id:'codex:a',nativeId:'a',reachable:true,harness:'codex'}];await assert.rejects(mesh.send('codex:a','hi'),/Owner changed/);assert.equal(mutation,false);
});
test('bridge state defaults, desktop binding and phone proof persist with exact owner',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mesh-bridge-'));try{
    const state=new BridgeState(path.join(dir,'state.json'));assert.equal((await state.read()).codexMode,'any-owner');await assert.rejects(state.confirmMobile('codex:a','owner'),/fresh connection test/);await state.confirmDesktop('owner');
    await state.recordProbe('codex:a',{ownerClientId:'owner',messageId:'probe',expectedReply:'MESH_PROBE_test',status:'accepted'});
    await assert.rejects(state.confirmMobile('codex:a','different'),/fresh connection test/);await state.confirmMobile('codex:a','owner');const s=await state.read();assert.equal(s.desktopOwners.owner.evidence,'user-confirmed');assert.equal(s.mobileChecks['codex:a'].messageId,'probe');
  }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('read-only MCP diagnosis does not send or require claiming another identity',async()=>{
  let calls=0;const handle=createHandler({inspect:async id=>{calls++;return {id,routeReady:false}},send:async()=>{throw Error('must not send')}});const r=await handle({id:1,method:'tools/call',params:{name:'diagnose_session',arguments:{id:'codex:a'}}});assert.equal(JSON.parse(r.result.content[0].text).routeReady,false);assert.equal(calls,1);
});

test('default local mode routes unknown and VS Code owners without Desktop attestation',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mesh-default-'));try{const state=new BridgeState(path.join(dir,'state.json'));const config=await state.read();for(const type of [undefined,'vscode']){const row=routingStatus({id:'codex:a',harness:'codex',ownerClientId:'native',reachable:true},config,type);assert.equal(row.routeReady,true);assert.equal(row.remote,'unverified');}}finally{await fs.rm(dir,{recursive:true,force:true})}});

test('owner text is safe for the actual desktop aeon-placeholder renderer contract',()=>{
  // Reproduce the precise throwing expression from the installed Desktop error stack.
  const renderCheck=input=>input?.some(e=>e.type==='text'&&e.text_elements.some(({placeholder})=>placeholder==='aeon-continuation'))===true;
  assert.throws(()=>renderCheck([{type:'text',text:'old wire shape'}]),/some/);
  assert.equal(renderCheck([ownerText('new wire shape')]),false);
  assert.equal(ownerText('quoted "\ntext').text,'quoted "\ntext');
});
test('owner acceptance decodes the real outer-method, unwrapped-result envelope',()=>{
  const start={type:'response',requestId:'test',resultType:'success',method:'thread-follower-start-turn',handledByClientId:'native-owner',result:{result:{turn:{id:'native-turn',status:'inProgress'}}}};
  assert.deepEqual(ownerReceipt(start,'thread-follower-start-turn'),{turnId:'native-turn',resultMethod:'thread-follower-start-turn'});
  const steer={...start,method:'thread-follower-steer-turn',result:{result:{turnId:'native-turn'}}};assert.equal(ownerReceipt(steer,'thread-follower-steer-turn').turnId,'native-turn');
  assert.throws(()=>ownerReceipt({...start,method:'different'},'thread-follower-start-turn'),/delivery unknown/);
  assert.throws(()=>ownerReceipt({...start,result:{result:{}}},'thread-follower-start-turn'),/no turn ID/);
});
test('old optimistic input damage is diagnosed and blocked until native view reload',()=>{
  const bad={threadRuntimeStatus:{type:'idle'},turnHistory:{history:{entitiesByKey:{old:{params:{input:[{type:'text',text:'already delivered'}]}}}}}};
  const health=ownerViewHealth(bad);assert.equal(health.uiState,'needs-reload');assert.equal(health.invalidTextInputs,1);
  const route=routingStatus({id:'codex:a',harness:'codex',reachable:true,ownerClientId:'owner',...health},{codexMode:'any-owner'});assert.equal(route.routeReady,false);assert.equal(route.routeBlock,'native-view-needs-reload');
  bad.turnHistory.history.entitiesByKey.old.params.input[0].text_elements=[];assert.equal(ownerViewHealth(bad).uiState,'ready');
});
