const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const validator=require(process.argv[2] ? path.resolve(__dirname,'../..',process.argv[2]) : 'gltf-validator');
const root=path.resolve(__dirname,'../..');
const output=path.join(root,'work/verification/combat-vfx/gltf-validator.json');
const sources=[
  ['asset','outputs/combat-vfx/assets'],
  ['sequence','outputs/combat-vfx/sequences']
];
const categories={
  vertex_colors:/COLOR_\d|ACCESSOR_NON_CLAMPED|color component/i,
  normal_vectors:/NORMAL|NON_UNIT|normal vector/i,
  min_max:/MIN_MISMATCH|MAX_MISMATCH|INVALID_(MIN|MAX)|MIN_MAX|MIN_GREATER_MAX|ACCESSOR_INVALID_FLOAT/i,
  uv:/TEXCOORD|UV/i,
  animation:/ANIMATION|\/animations\//i,
  input_range:/ANIMATION_INPUT|INPUT_(NEGATIVE|NON|INVALID)|NON_INCREASING|INPUT_ACCESSOR/i
};
const summarize=messages=>messages.reduce((out,message)=>{out[message.code]=(out[message.code]||0)+1;return out;},{});
async function main(){
  const files=sources.flatMap(([kind,folder])=>fs.readdirSync(path.join(root,folder)).filter(name=>name.endsWith('.glb')).sort().map(name=>({kind,file:folder+'/'+name})));
  if(files.filter(item=>item.kind==='asset').length!==48 || files.filter(item=>item.kind==='sequence').length!==6)throw new Error('Expected 48 assets and 6 sequences.');
  const report={validator:'Khronos glTF-Validator',version:validator.version(),package:'gltf-validator@2.0.0-dev.3.10',
    officialDocumentation:'https://github.com/KhronosGroup/glTF-Validator/blob/main/node/README.md',
    specification:'glTF 2.0',validationOptions:{format:'glb',maxIssues:0,writeTimestamp:false},
    ignoredIssues:[],severityOverrides:{},expectedAssets:48,expectedSequences:6,files:[],totals:{errors:0,warnings:0,infos:0,hints:0},issueCodes:{},sections:{}};
  for(const item of files){
    const bytes=fs.readFileSync(path.join(root,item.file));
    const result=await validator.validateBytes(new Uint8Array(bytes),{
      uri:item.file,format:'glb',maxIssues:0,writeTimestamp:false,
      externalResourceFunction:async uri=>{throw new Error('Unexpected external resource in self-contained GLB: '+uri);}
    });
    const issues=result.issues;
    const entry={...item,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
      errors:issues.numErrors,warnings:issues.numWarnings,infos:issues.numInfos,hints:issues.numHints,
      truncated:issues.truncated,issueCodes:summarize(issues.messages),criticalMessages:issues.messages.filter(message=>message.severity<=1),
      messages:issues.messages,info:result.info,sections:{}};
    for(const [name,regex] of Object.entries(categories)){
      const matches=issues.messages.filter(message=>regex.test([message.code,message.pointer,message.message].join(' ')));
      entry.sections[name]={count:matches.length,issueCodes:summarize(matches),examples:matches.slice(0,8)};
    }
    report.files.push(entry);
    report.totals.errors+=entry.errors;report.totals.warnings+=entry.warnings;report.totals.infos+=entry.infos;report.totals.hints+=entry.hints;
    for(const [code,count] of Object.entries(entry.issueCodes))report.issueCodes[code]=(report.issueCodes[code]||0)+count;
    console.log(JSON.stringify({file:item.file,errors:entry.errors,warnings:entry.warnings,infos:entry.infos,codes:entry.issueCodes}));
  }
  for(const name of Object.keys(categories)){
    report.sections[name]={count:report.files.reduce((sum,file)=>sum+file.sections[name].count,0),files:report.files.filter(file=>file.sections[name].count).map(file=>({file:file.file,...file.sections[name]}))};
  }
  report.filesWithErrors=report.files.filter(file=>file.errors).length;
  report.filesWithWarnings=report.files.filter(file=>file.warnings).length;
  report.passed=report.totals.errors===0 && report.files.every(file=>!file.truncated);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,files:report.files.length,filesWithErrors:report.filesWithErrors,totals:report.totals,issueCodes:report.issueCodes,sectionCounts:Object.fromEntries(Object.entries(report.sections).map(([name,value])=>[name,value.count])),output},null,2));
  if(!report.passed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
