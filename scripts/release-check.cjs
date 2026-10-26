const fs=require('node:fs');
const p=require('../package.json');const errors=[];
if(!p.publisher||p.publisher==='local-lab')errors.push('Set the actual Marketplace publisher.');
for(const [name,value]of Object.entries({repository:p.repository?.url,homepage:p.homepage,bugs:p.bugs?.url}))if(typeof value!=='string'||!value.startsWith('https://')||/example\.|OWNER|PLACEHOLDER/.test(value))errors.push(`Set a real HTTPS ${name} URL.`);
let evidence;try{evidence=JSON.parse(fs.readFileSync('.release-evidence.json','utf8'))}catch{}
if(evidence?.bidirectionalLiveTest!==true||!evidence.reviewedBy||!/^\d{4}-\d{2}-\d{2}$/.test(evidence.reviewedAt||''))errors.push('Record completed bidirectional native validation with reviewer and date in .release-evidence.json.');
if(errors.length){console.error('Release gates not satisfied:\n'+errors.map(e=>'- '+e).join('\n'));process.exitCode=1}else console.log('Metadata and recorded validation gates passed. Complete the manual review in RELEASING.md before publishing.');
