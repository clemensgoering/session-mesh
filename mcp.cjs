'use strict';
const readline = require('node:readline');
const { NativeMesh, resolveTarget } = require('./native.cjs');
const { STANDARDS } = require('./standards.cjs');
const tools = [
  { name: 'list_sessions', description: 'Discover existing native sessions, exact IDs, role, live owner, routeReady and separate remote evidence. Online/idle alone does not mean routed or remotely controllable. Default local routing does not require a Desktop confirmation. Desktop-only is an optional user policy. Results include standards.', inputSchema: { type:'object', properties:{}, additionalProperties:false } },
  { name: 'identify_session', description: 'Bind this MCP connection to your own native session ID from list_sessions. Identity is self-reported, not proof or authorization. Call before sending. Cannot change identity in this connection.', inputSchema: { type:'object', properties:{ id:{type:'string'} }, required:['id'], additionalProperties:false } },
  { name: 'send_message', description: 'Deliver a delegation, question, result or blocker to an existing reachable session. At completion explicitly report to your designated orchestrator ID. Not a human approval. No automatic reply to acknowledgements; no blind retries on unknown delivery.', inputSchema: { type:'object', properties:{ to:{type:'string'}, message:{type:'string'} }, required:['to','message'], additionalProperties:false } },
  { name: 'mesh_standards', description: 'Read the shared addressing, delegation, reporting, security and delivery standards for all Session Mesh peers.', inputSchema: { type:'object', properties:{}, additionalProperties:false } },
  { name:'diagnose_session',description:'Read-only check of an exact session owner, idle/busy state, tunnel routing policy and remote evidence. Does not send a message, start a chat, take ownership or prove phone delivery.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}}
];
function createHandler(mesh = new NativeMesh()) {
  let identity = null;
  return async m => {
    if (m.id === undefined) return;
    let result;
    if (m.method === 'initialize') result = { protocolVersion:m.params?.protocolVersion || '2024-11-05', capabilities:{tools:{}}, serverInfo:{name:'session-mesh',version:'0.3.1'}, instructions:STANDARDS };
    else if (m.method === 'ping') result = {};
    else if (m.method === 'tools/list') result = {tools};
    else if (m.method === 'tools/call') {
      try {
        const {name, arguments:a = {}} = m.params || {}; let value;
        if (name === 'mesh_standards') value = {standards:STANDARDS};
        else if(name==='diagnose_session')value=await mesh.inspect(a.id);
        else if (name === 'list_sessions') value = {self:identity, identityAssurance:'self-reported', sessions:(await mesh.list()).map(({endpoint,owner,procStart,...s})=>s), standards:STANDARDS};
        else if (name === 'identify_session') {
          const row = resolveTarget(await mesh.list({withState:false}), a.id);
          if (!row.reachable) throw Error('Your identity must be a live native session');
          if (identity && identity.id !== row.id) throw Error('Identity already bound for this MCP connection');
          identity = {id:row.id,name:row.name}; value = {self:identity, identityAssurance:'self-reported'};
        } else if (name === 'send_message') {
          if (!identity) throw Error('Call identify_session with your own ID first');
          value = await mesh.send(a.to,a.message,identity);
        } else throw Error('Unknown tool');
        result = {content:[{type:'text',text:JSON.stringify(value)}]};
      } catch(e) { result={isError:true,content:[{type:'text',text:e.message}]}; }
    } else return {jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Method not found'}};
    return {jsonrpc:'2.0',id:m.id,result};
  };
}
if (require.main === module) {
  const mesh = new NativeMesh(), handle = createHandler(mesh);
  readline.createInterface({input:process.stdin}).on('line',line=>{ let m; try{m=JSON.parse(line)}catch{return;} handle(m).then(r=>{if(r)process.stdout.write(JSON.stringify(r)+'\n')}).catch(()=>{}); }).on('close',()=>mesh.close());
}
module.exports={createHandler,tools};
