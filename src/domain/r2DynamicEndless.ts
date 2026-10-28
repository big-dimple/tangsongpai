import {MAX_INTEGER_DIGITS} from './rational';
import type {R2BossId} from './r2Chapter';

/** Exact provisional policy; callers are responsible for real clear evidence and locking. */
const score=(value:string):bigint=>{
 if(!/^(0|[1-9]\d*)$/.test(value)||value.length>MAX_INTEGER_DIGITS)throw Error('numeric-length-limit');
 return BigInt(value);
};
const ceil=(n:bigint,d:bigint)=>(n+d-1n)/d;
const maximum=(...values:bigint[])=>values.reduce((a,b)=>a>b?a:b);
const output=(n:bigint)=>{const value=n.toString();if(value.length>MAX_INTEGER_DIGITS)throw Error('numeric-length-limit');return value;};

/** A real last stage score may bootstrap; omitted evidence never falls back to total run heat. */
export function dynamicEndlessInitialAnchor(normalBaseline:string,lastClearScore?:string):string {
 const baseline=score(normalBaseline);
 return output(lastClearScore===undefined?baseline:maximum(baseline,ceil(score(lastClearScore),10n)));
}
/** Only call after an actual non-Boss clear; skipped stages and Bosses do not advance samples. */
export function dynamicEndlessAdvanceAnchor(anchor:string,normalBaseline:string,currentScore:string,previousNormalScore?:string):string {
 const b=score(anchor),s=score(currentScore),oneShot=ceil(s*35n,100n),limited=oneShot<2n*b?oneShot:2n*b;
 return output(maximum(score(normalBaseline),ceil(b*105n,100n),limited,...(previousNormalScore===undefined?[]:[ceil((s<score(previousNormalScore)?s:score(previousNormalScore))*35n,100n)])));
}
const severeBosses:ReadonlySet<R2BossId>=new Set(['B03','B06','B08','B09','B10','B11','B15','B16']);
/** A Boss discount changes the next target only; the caller retains the original anchor. */
export function dynamicEndlessBossTarget(anchor:string,staticBossTarget:string,boss:R2BossId):string {
 return output(maximum(score(staticBossTarget),ceil(score(anchor)*(severeBosses.has(boss)?75n:90n),100n)));
}
