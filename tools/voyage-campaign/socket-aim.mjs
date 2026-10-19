/**
 * Candidate planar aiming adapter. It changes yaw inputs through callbacks only.
 * origin, target and readFrame positions/directions must use the same world XZ.
 * readFrame must refresh actual parent/world matrices before reading the socket.
 * The returned frame is the last callback object, never a synthetic firing frame.
 */
const point = value => value && typeof value==='object' && Number.isFinite(value.x) && Number.isFinite(value.z) && (value.y===undefined || Number.isFinite(value.y));
const failure = (reason, iterations = 0) => ({ok:false,converged:false,frame:null,iterations,reason,crossTrackError:null,angleErrorRadians:null,forwardDistance:null,targetDistance:null});

/**
 * aimRelative(dx,dz,heading) retains the source asset's yaw implementation.
 * Iteration accounts for the offset pivot and rotating barrel/side socket.
 * Success requires a forward ray with both small lateral and angular error.
 * A non-converged result keeps the measured frame and has ok:false; callers
 * decide whether to inhibit firing rather than substituting a made-up frame.
 */
export function aimSocketAt({aimRelative,readFrame,origin,target,heading=0,maxIterations=8,tolerance=.01,angleToleranceRadians=1e-4} = {}) {
  if(typeof aimRelative!=='function'||typeof readFrame!=='function'||!point(origin)||!point(target)||!Number.isFinite(heading)||
      !Number.isInteger(maxIterations)||maxIterations<1||maxIterations>8||!Number.isFinite(tolerance)||tolerance<=0||
      !Number.isFinite(angleToleranceRadians)||angleToleranceRadians<=0) return failure('invalid-input');
  let dx=target.x-origin.x,dz=target.z-origin.z;
  if(!Number.isFinite(dx)||!Number.isFinite(dz)) return failure('invalid-input');
  if(Math.hypot(dx,dz)<1e-8) return failure('coincident-target');
  let result=null;
  for(let iteration=1;iteration<=maxIterations;iteration++){
    let frame;
    try {aimRelative(dx,dz,heading);frame=readFrame();}
    catch {return failure('callback-failed',iteration);}
    if(!point(frame?.position)||!point(frame?.direction)) return failure('invalid-frame',iteration);
    const length=Math.hypot(frame.direction.x,frame.direction.z);
    if(!Number.isFinite(length)||length<1e-8) return failure('invalid-frame',iteration);
    const nextX=target.x-frame.position.x,nextZ=target.z-frame.position.z;
    if(!Number.isFinite(nextX)||!Number.isFinite(nextZ)) return failure('invalid-frame',iteration);
    const targetDistance=Math.hypot(nextX,nextZ),forwardX=frame.direction.x/length,forwardZ=frame.direction.z/length;
    const forwardDistance=nextX*forwardX+nextZ*forwardZ;
    const crossTrackError=Math.abs(nextX*forwardZ-nextZ*forwardX);
    const angleErrorRadians=targetDistance<1e-8?0:Math.atan2(crossTrackError,forwardDistance);
    if(![targetDistance,forwardDistance,crossTrackError,angleErrorRadians].every(Number.isFinite)) return failure('invalid-frame',iteration);
    const converged=targetDistance>=1e-8&&forwardDistance>0&&crossTrackError<=tolerance&&angleErrorRadians<=angleToleranceRadians;
    result={ok:converged,converged,frame,iterations:iteration,crossTrackError,angleErrorRadians,forwardDistance,targetDistance,reason:converged?'converged':'iteration-limit'};
    if(converged)return result;
    if(targetDistance<1e-8)return {...result,reason:'target-at-muzzle'};
    dx=nextX;dz=nextZ;
  }
  return result;
}
