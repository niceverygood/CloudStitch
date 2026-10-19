/** Minimal local PCM16/IEEE-float32 reader and PCM16 writer. No codecs/deps. */
export function decodeWav(bytes){
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error('Expected RIFF WAVE');
  let format,chunk;for(let offset=12;offset+8<=bytes.length;){const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;if(start+size>bytes.length)throw new Error('Truncated WAV chunk');if(id==='fmt '){if(size<16)throw new Error('Invalid WAV fmt');format={code:bytes.readUInt16LE(start),channels:bytes.readUInt16LE(start+2),sampleRate:bytes.readUInt32LE(start+4),block:bytes.readUInt16LE(start+12),bits:bytes.readUInt16LE(start+14)};}if(id==='data')chunk={start,size};offset=start+size+(size%2);}
  if(!format||!chunk||!([1,3].includes(format.code))||format.code===1&&format.bits!==16||format.code===3&&format.bits!==32||format.channels<1||format.channels>8||format.sampleRate<8000||format.sampleRate>96000)throw new Error('Unsupported WAV format');
  const unit=format.bits/8;if(format.block!==unit*format.channels||chunk.size%format.block)throw new Error('Invalid WAV alignment');const frames=chunk.size/format.block,channels=Array.from({length:format.channels},()=>new Float32Array(frames));
  for(let i=0;i<frames;i++)for(let c=0;c<channels.length;c++){const offset=chunk.start+i*format.block+c*unit;channels[c][i]=format.code===3?bytes.readFloatLE(offset):bytes.readInt16LE(offset)/32768;if(!Number.isFinite(channels[c][i]))throw new Error('Non-finite WAV sample');}
  return {channels,sampleRate:format.sampleRate,format:format.code===3?'IEEE_FLOAT32':'PCM_S16LE',duration:frames/format.sampleRate};
}
export function encodeWav({channels,sampleRate}){
  const count=channels.length,n=channels[0].length;if(count<1||count>8||!Number.isSafeInteger(sampleRate))throw new Error('Invalid PCM');const bytes=Buffer.alloc(44+n*count*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(count,22);bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*count*2,28);bytes.writeUInt16LE(count*2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(n*count*2,40);
  for(let i=0;i<n;i++)for(let c=0;c<count;c++){const value=channels[c][i];if(!Number.isFinite(value)||Math.abs(value)>.9999)throw new Error('Unsafe output PCM; fix DSP instead of clipping.');bytes.writeInt16LE(Math.round(value*32767),44+(i*count+c)*2);}return bytes;
}
