'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const { STANDARDS }=require('./standards.cjs');
const START='<!-- SESSION-MESH:START -->',END='<!-- SESSION-MESH:END -->';
function managed(original,body){
  const start=original.indexOf(START),end=original.indexOf(END);
  if((start<0)!==(end<0)||start>=0&&end<start)throw Error('Malformed Session Mesh managed block; no changes written');
  const block=`${START}\n${body}\n${END}`;
  return start>=0?original.slice(0,start)+block+original.slice(end+END.length):original+(original.endsWith('\n')||!original?'':'\n')+'\n'+block+'\n';
}
async function read(file){try{return await fs.readFile(file,'utf8')}catch(e){if(e.code==='ENOENT')return '';throw e}}
async function planSetup(root,nodePath,mcpPath,{user=false}={}){
  if(!path.isAbsolute(nodePath))throw Error('Set sessionMesh.nodePath to an absolute Node.js executable path before setup');
  const jsonPath=path.join(root,user?'.claude.json':'.mcp.json'),jsonText=await read(jsonPath),config=jsonText?JSON.parse(jsonText):{};
  if(!config||Array.isArray(config)||typeof config!=='object')throw Error('Invalid Claude configuration object');
  if(config.mcpServers&&typeof config.mcpServers!=='object')throw Error('Invalid mcpServers object');
  const entry={command:nodePath,args:[mcpPath]};config.mcpServers=config.mcpServers||{};
  if(config.mcpServers['session-mesh']&&JSON.stringify(config.mcpServers['session-mesh'])!==JSON.stringify(entry))throw Error('Existing session-mesh MCP entry differs; inspect it before replacing');
  config.mcpServers['session-mesh']=entry;
  const tomlPath=path.join(root,'.codex','config.toml'),tomlText=await read(tomlPath);
  const TS='# SESSION-MESH:START',TE='# SESSION-MESH:END',ti=tomlText.indexOf(TS),tj=tomlText.indexOf(TE);
  if((ti<0)!==(tj<0)||ti>=0&&tj<ti)throw Error('Malformed TOML managed block');
  const unmanaged=ti<0?tomlText:tomlText.slice(0,ti)+tomlText.slice(tj+TE.length);
  if(/^\s*\[mcp_servers\.(?:session-mesh|"session-mesh"|'session-mesh')\]/m.test(unmanaged))throw Error('An unmanaged Codex session-mesh config already exists');
  const block=`${TS}\n[mcp_servers.session-mesh]\ncommand = ${JSON.stringify(nodePath)}\nargs = [${JSON.stringify(mcpPath)}]\n${TE}`;
  const toml=ti<0?tomlText+'\n'+block+'\n':tomlText.slice(0,ti)+block+tomlText.slice(tj+TE.length);
  const plan=[{file:jsonPath,before:jsonText,after:JSON.stringify(config,null,2)+'\n'},{file:tomlPath,before:tomlText,after:toml}];
  for(const filename of user?['.codex/AGENTS.md','.claude/CLAUDE.md']:['AGENTS.md','CLAUDE.md']){const file=path.join(root,filename),before=await read(file);plan.push({file,before,after:managed(before,'## Session Mesh communication\n\n'+STANDARDS+'\n\nTools appear after this session reloads its MCP configuration. Respect any native MCP trust/approval prompt. If they are missing, report it instead of fabricating tool use.')})}
  return plan.filter(p=>p.before!==p.after);
}
async function applyPlan(plan){
  // Recheck before mutation; back up each existing file. No provider sessions are restarted.
  for(const p of plan)if(await read(p.file)!==p.before)throw Error('Configuration changed since planning; try setup again');
  for(const p of plan){await fs.mkdir(path.dirname(p.file),{recursive:true});if(p.before)await fs.writeFile(`${p.file}.session-mesh-${Date.now()}.bak`,p.before,{flag:'wx'});await fs.writeFile(p.file,p.after);}
}
module.exports={planSetup,applyPlan,managed};
