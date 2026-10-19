/** Run only in the integration owner's available browser slot. No audio output. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
function encodeWav(channels,rate){const n=channels[0].length,count=channels.length,b=Buffer.alloc(44+n*count*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(count,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*count*4,28);b.writeUInt16LE(count*4,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(n*count*4,40);for(let i=0;i<n;i++)for(let c=0;c<count;c++){const value=channels[c][i];if(!Number.isFinite(value))throw Error('Non-finite decoded PCM');b.writeFloatLE(value,44+(i*count+c)*4);}return b;}
(async()=>{
 const args=process.argv.slice(2),at=args.indexOf('--playwright-root');if(at<0)throw Error('Pass --playwright-root <existing integration root>. No dependency install.');
 const {chromium}=require(path.join(path.resolve(args[at+1]),'node_modules/playwright'));
 const catalog=JSON.parse(await fs.readFile(path.join(root,'outputs/audio-rich-v1/input-catalog.json'),'utf8')),report={version:'audio-rich-native-decoding-1',method:'Native Chromium OfflineAudioContext.decodeAudioData to 44100 Hz. No source playback, no game UI or human listening.',sampleRate:44100,clips:[]};
 let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-first-run']});const page=await browser.newPage();await page.goto('about:blank');
  for(const asset of catalog.assets){const encoded=await fs.readFile(path.join(root,'outputs/audio-rich-v1',asset.source.file));if(crypto.createHash('sha256').update(encoded).digest('hex')!==asset.source.sha256)throw Error('Input hash mismatch');
   const decoded=await page.evaluate(async base64=>{const bytes=Uint8Array.from(atob(base64),v=>v.charCodeAt(0)),context=new OfflineAudioContext(2,1,44100),buffer=await context.decodeAudioData(bytes.buffer);return {sampleRate:buffer.sampleRate,duration:buffer.duration,channels:Array.from({length:buffer.numberOfChannels},(_,c)=>{const pcm=buffer.getChannelData(c),bytes=new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength);let raw='';for(let start=0;start<bytes.length;start+=32768)raw+=String.fromCharCode(...bytes.subarray(start,start+32768));return btoa(raw);}),frames:buffer.length};},encoded.toString('base64'));
   const channels=decoded.channels.map(value=>{const b=Buffer.from(value,'base64'),out=new Float32Array(b.length/4);for(let i=0;i<out.length;i++)out[i]=b.readFloatLE(i*4);return out;}),wav=encodeWav(channels,decoded.sampleRate),relative=`work/audio/rich-v1/decoded/${asset.id}.wav`;
   await fs.writeFile(path.join(root,relative),wav);report.clips.push({id:asset.id,path:relative,sampleRate:decoded.sampleRate,duration:decoded.duration,channels:channels.length,frames:decoded.frames,bytes:wav.length,sha256:crypto.createHash('sha256').update(wav).digest('hex'),sourceSha256:asset.source.sha256});
  }
  report.passed=report.clips.length===49;await fs.writeFile(path.join(root,'work/audio/rich-v1/decoding.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,decoded:report.clips.length,report:'work/audio/rich-v1/decoding.json',playback:false}));
 }finally{await browser?.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
