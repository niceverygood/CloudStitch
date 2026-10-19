// Real embedded PNG texture layers. No paid generation, DOM or account dependencies.
const {PNG}=require('pngjs');
exports.attachPaint=function(buffer){
 const original=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)).trim()),binStart=20+buffer.readUInt32LE(12)+8;
 let binary=buffer.subarray(binStart),offset=binary.length;const segments=[binary],images=[],textures=[];
 const categories=['metal','canvas','wood','brass','paint'];
 function noise(x,y){return(Math.sin(x*127.1+y*311.7)*43758.5453)%1;}
 for(const category of categories){const png=new PNG({width:512,height:512});for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const n=Math.abs(noise(x,y)),brush=Math.sin(x*.04+y*.006)*.018+Math.sin(x*.13+y*.023)*.012;let v=.91+brush+(n-.5)*.035;
  if(category==='canvas'){v=.94+(Math.sin(x*Math.PI*.5)+Math.sin(y*Math.PI*.5))*.022+(n-.5)*.026;const seam=x%128; if(seam<3)v=.65;if(seam>5&&seam<8&&y%14<7)v=.63;}
  if(category==='wood'){const grain=Math.sin(y*.12+Math.sin(x*.009)*3)+Math.sin(y*.52+x*.006)*.3;v=.88+grain*.065+(n-.5)*.035;if(y%128<4)v=.48;}
  if(category==='metal'){if(x%128<2||y%128<2)v=.63;if(n>.996)v=.61;const scratch=(x+Math.floor(y/91)*17)%191;if(scratch<1&&y%93<32)v=.99;}
  if(category==='brass')v=.91+Math.sin(y*.17+x*.013)*.045+(n-.5)*.035;
  const i=(y*512+x)*4,c=Math.max(0,Math.min(255,Math.round(v*255)));png.data[i]=c;png.data[i+1]=c;png.data[i+2]=c;png.data[i+3]=255;
 }const encoded=PNG.sync.write(png),padding=(4-offset%4)%4;if(padding){segments.push(Buffer.alloc(padding));offset+=padding;}const index=original.bufferViews.length;original.bufferViews.push({buffer:0,byteOffset:offset,byteLength:encoded.length});segments.push(encoded);offset+=encoded.length;images.push({bufferView:index,mimeType:'image/png',name:'painted-'+category});textures.push({source:images.length-1,sampler:0});}
 original.images=images;original.textures=textures;original.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
 for(const m of original.materials){const n=m.name||'',type=/cream|cloth|red/.test(n)?'canvas':/wood/.test(n)?'wood':/brass|gold/.test(n)?'brass':/teal/.test(n)?'paint':'metal';if(!n.includes('ember'))m.pbrMetallicRoughness.baseColorTexture={index:categories.indexOf(type),texCoord:0};}
 const tail=(4-offset%4)%4;if(tail){segments.push(Buffer.alloc(tail));offset+=tail;}original.buffers[0].byteLength=offset;const json=Buffer.from(JSON.stringify(original)),jp=(4-json.length%4)%4,j=Buffer.concat([json,Buffer.alloc(jp,32)]),bin=Buffer.concat(segments),header=Buffer.alloc(20),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+j.length+8+bin.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,j,bh,bin]);
};
