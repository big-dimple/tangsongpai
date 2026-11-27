/**
 * A small timber stage: one short convolution room shared by effects and UI sounds.
 * The impulse is generated in code from a fixed seed (no asset, no Math.random); music
 * never enters the room. Devices without a ConvolverNode simply stay dry.
 */
export const STAGE_ROOM={seconds:.42,preDelay:.004,earlyTaps:12,sfxSend:.16,uiSend:.08,reopenAfter:.45,reopenRamp:.03} as const;

function stream(seed:number):()=>number {
  let x=seed>>>0||1;
  return ()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};
}

/** Left and right impulse of the room: early boards first, then a fast, dark wooden tail. */
export function stageRoomImpulse(sampleRate:number,seed=0x7a61):[Float32Array,Float32Array] {
  const rate=Number.isFinite(sampleRate)&&sampleRate>=8000?sampleRate:48000,length=Math.max(1,Math.round(STAGE_ROOM.seconds*rate)),start=Math.round(STAGE_ROOM.preDelay*rate);
  const channels:[Float32Array,Float32Array]=[new Float32Array(length),new Float32Array(length)];
  channels.forEach((data,channel)=>{
    const random=stream(seed+channel*977);let low=0,lower=0;
    for(let i=start;i<length;i++){
      const t=(i-start)/Math.max(1,length-start);
      // Wood soaks up the top end as the tail ages: the low-pass closes while the level falls.
      const open=Math.min(1,.5*Math.exp(-3.6*t)+.035);
      low+=(random()*2-1-low)*open;lower+=(low-lower)*Math.min(1,open*1.5);
      data[i]=lower*Math.exp(-6.9*t)*Math.min(1,(i-start)/(.006*rate))/Math.sqrt(open);
    }
    // A dozen close reflections from the back wall, floor and eaves within the first 40ms.
    for(let tap=0;tap<STAGE_ROOM.earlyTaps;tap++){
      const at=start+Math.floor((.002+.038*Math.pow(random(),1.3))*rate),sign=random()<.5?-1:1;
      if(at<length)data[at]+=sign*.45*Math.exp(-tap*.16);
    }
    // No DC and no click at the cut: one-pole high-pass, then a short fade to silence.
    let previousIn=0,previousOut=0;
    for(let i=0;i<length;i++){const value=data[i];previousOut=value-previousIn+.985*previousOut;previousIn=value;data[i]=previousOut;}
    const fade=Math.min(length,Math.round(.02*rate));for(let i=0;i<fade;i++)data[length-1-i]*=i/fade;
    // Unit energy per channel: a steady sound returns from the room exactly at its send level,
    // on every browser (the node's own loudness normalisation is not used).
    let energy=0;for(let i=0;i<length;i++)energy+=data[i]*data[i];
    const scale=energy>0?1/Math.sqrt(energy):0;for(let i=0;i<length;i++)data[i]*=scale;
  });
  return channels;
}

export interface StageRoom {
  /** Exact silence now: a frozen or muted tail must not bloom later. */
  close(time:number):void;
  /** Let the room speak again once any old tail has run out. */
  open(time:number,wait?:number):void;
}
type RoomContext=Pick<BaseAudioContext,'createGain'|'sampleRate'>&Partial<Pick<BaseAudioContext,'createConvolver'|'createBuffer'>>;

/** effects → send → room → return → master. Returns undefined (dry mix) where unsupported. */
export function connectStageRoom(context:RoomContext,sfx:AudioNode,ui:AudioNode,master:AudioNode):StageRoom|undefined {
  if(typeof context.createConvolver!=='function'||typeof context.createBuffer!=='function')return;
  try {
    const [left,right]=stageRoomImpulse(context.sampleRate),buffer=context.createBuffer(2,left.length,Number.isFinite(context.sampleRate)&&context.sampleRate>=8000?context.sampleRate:48000);
    buffer.getChannelData(0).set(left);buffer.getChannelData(1).set(right);
    const room=context.createConvolver(),sfxSend=context.createGain(),uiSend=context.createGain(),back=context.createGain();
    room.normalize=false;room.buffer=buffer;
    sfxSend.gain.value=STAGE_ROOM.sfxSend;uiSend.gain.value=STAGE_ROOM.uiSend;back.gain.value=1;
    sfx.connect(sfxSend);ui.connect(uiSend);sfxSend.connect(room);uiSend.connect(room);room.connect(back);back.connect(master);
    return {
      close:time=>{try{back.gain.cancelScheduledValues(time);back.gain.setValueAtTime(0,time);}catch{/* A dry mix is still complete. */}},
      open:(time,wait=0)=>{try{
        back.gain.cancelScheduledValues(time);
        if(wait>0){back.gain.setValueAtTime(0,time);back.gain.setValueAtTime(0,time+wait);back.gain.linearRampToValueAtTime(1,time+wait+STAGE_ROOM.reopenRamp);}
        else back.gain.setValueAtTime(1,time);
      }catch{/* A dry mix is still complete. */}},
    };
  } catch {return;}
}
