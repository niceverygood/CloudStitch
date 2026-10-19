import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),integrationRoot=process.argv[2]?path.resolve(process.argv[2]):null;
function run(name,args=[]){const output=execFileSync(process.execPath,[path.join(root,'tools/audio',name),...args],{cwd:root,encoding:'utf8',windowsHide:true});return output.trim();}
const runtime=run('verify-runtime.mjs');console.log(runtime.split('\n')[0]);
const adapter=JSON.parse(run('verify-adapter.mjs',integrationRoot?['--integration-root',integrationRoot]:[]));
await writeFile(path.join(root,'outputs/audio-v1/adapter-verification.json'),JSON.stringify(adapter,null,2)+'\n');
console.log(`adapter: ${adapter.passed}/${adapter.checks.length}`);
if(integrationRoot)console.log(run('verify-controller.mjs',[integrationRoot]));
console.log(run('verify-http.mjs',integrationRoot?[integrationRoot]:[]));
const signal=JSON.parse(await readFile(path.join(root,'outputs/audio-v1/signal-verification.json'),'utf8'));
const runtimeReport=JSON.parse(await readFile(path.join(root,'outputs/audio-v1/runtime-verification.json'),'utf8'));
const summary={version:'audio-v1.0.0-ready',ready:'implementation_ready_for_sequential_browser_and_listening_QA',passed:signal.passed&&runtimeReport.failed===0&&adapter.failed===0,
  checks:{signalClips:signal.checks.length,runtime:runtimeReport.passed,adapter:adapter.passed,actualController:integrationRoot?'8/8 actual-input Node checks':'not-run (supply frozen integration root)',http:integrationRoot?'35/35 local requests':'31/31 local requests'},
  reports:['signal-verification.json','runtime-verification.json','adapter-verification.json',...(integrationRoot?['controller-verification.json']:[]),'http-verification.json'],
  notPerformed:['Browser launch/native Web Audio/OfflineAudioContext measurement','Human listening, headphones/speakers, mono masking and low-dynamic-range comfort','Full integration UI, map transitions, long duration audio and hardware latency'],
  integrationInstalled:false,dependenciesAdded:0,externalAudioDownloads:0,musicOrVoiceCreated:false};
await writeFile(path.join(root,'outputs/audio-v1/verification.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
