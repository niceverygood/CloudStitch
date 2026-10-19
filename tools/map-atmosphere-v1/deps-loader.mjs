// Optional existing dependency directory. Normal repository npm installs work without this loader.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export async function resolve(specifier,context,nextResolve){
  const deps=process.env.CLOUDSTITCH_NODE_MODULES;
  if(deps && (specifier==='three'||specifier.startsWith('three/'))){
    const rel=specifier==='three'?'three/build/three.module.js':specifier.replace('three/addons/','three/examples/jsm/');
    const target=path.join(deps,rel);
    if(!fs.existsSync(target))throw new Error('Dependency not found: '+target);
    return {url:pathToFileURL(target).href,shortCircuit:true};
  }
  return nextResolve(specifier,context);
}
