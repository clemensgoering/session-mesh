'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {CodexIPC}=require('./ipc.cjs');
const {NativeMesh,resolveTarget,codexState}=require('./native.cjs');
const {createHandler}=require('./mcp.cjs');
const {planSetup,applyPlan,managed}=require('./setup.cjs');
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
  let call;const ipc={owner:async()=>({handledByClientId:'owner',result:{supportsUntrustedAppInput:true}}),snapshot:async()=>({threadRuntimeStatus:{type:'active'}}),request:async(...args)=>{call=args;return {result:{method:args[0]}}}};
  const mesh=new NativeMesh({ipc});mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];
  const r=await mesh.send('codex:target','message',{id:'claude:sender',name:'sender'});assert.equal(call[0],'thread-follower-steer-turn');assert.equal(call[1].conversationId,'target');assert.equal(call[2].targetClientId,'owner');assert.equal(r.status,'accepted');
});
test('Codex refuses unknown runtime state before any turn mutation',async()=>{
  let mutated=false;const mesh=new NativeMesh({ipc:{owner:async()=>({result:{supportsUntrustedAppInput:true}}),snapshot:async()=>null,request:async()=>{mutated=true}}});mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];await assert.rejects(mesh.send('codex:target','message'),/state is unknown/);assert.equal(mutated,false);
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
  let call;const mesh=new NativeMesh({ipc:{owner:async()=>({handledByClientId:'owner'}),snapshot:async()=>({threadRuntimeStatus:{type:'idle'}}),request:async(...args)=>{call=args;return {result:{method:args[0]}}}}});
  mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];await mesh.send('codex:target','hello');
  assert.equal(call[0],'thread-follower-start-turn');assert.equal(call[1].turnStart.request.threadId,'target');assert.equal(call[2].version,2);assert.equal(call[2].targetClientId,'owner');assert.deepEqual(call[1].turnStart.context,{inheritThreadSettings:true});
});
test('peer delivery refuses owners without explicit untrusted-input support',async()=>{
  let called=false;const mesh=new NativeMesh({ipc:{owner:async()=>({result:{}}),request:async()=>{called=true}}});mesh.list=async()=>[{id:'codex:target',nativeId:'target',reachable:true,harness:'codex'}];await assert.rejects(mesh.send('codex:target','hello',{id:'claude:sender',name:'sender'}),/untrusted input/);assert.equal(called,false);
});
