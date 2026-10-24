import type {AudioEngine} from './AudioEngine';
import './OpeningAudio.css';
type OpeningAudio=Pick<AudioEngine,'startOpeningMusic'|'needsGestureUnlock'|'musicNeedsGesture'|'unlock'|'onMusicStateChange'>;

/** One application binding; the loading dialog and later pages share the same engine. */
export function installOpeningAudio(audio:OpeningAudio,doc=document,target:Window=window):()=>void {
 const hint=doc.createElement('button');hint.type='button';hint.className='opening-audio-hint';
 hint.textContent='轻点画面启音';hint.setAttribute('aria-label','轻点画面启音，也可按 Enter');
 const refresh=()=>{
  const parent=doc.querySelector('#resource-loading .load-copy, .title-home .home-entry')??doc.body;
  if(hint.parentElement!==parent)parent.append(hint);
  hint.hidden=!audio.musicNeedsGesture;
 };
 const gesture=(event:Event)=>{
  if(!event.isTrusted)return;
  if(event.type==='keydown'&&!['Enter',' '].includes((event as KeyboardEvent).key))return;
  if(audio.needsGestureUnlock)void audio.unlock();
 };
 // click (including touch-generated click) preserves Safari's actual activation.
 target.addEventListener('click',gesture,{capture:true});target.addEventListener('keydown',gesture,{capture:true});
 const stop=audio.onMusicStateChange(refresh),observer=new MutationObserver(refresh);
 observer.observe(doc.body,{childList:true,subtree:true});
 audio.startOpeningMusic();refresh();
 return ()=>{stop();observer.disconnect();hint.remove();target.removeEventListener('click',gesture,{capture:true});target.removeEventListener('keydown',gesture,{capture:true});};
}
