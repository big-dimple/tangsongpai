import {GAME_NAME} from './Brand';
import './HomePage.css';

// Capture the existing loading artwork before its dialog leaves the document.
// The same inline SVG, suit drawings and shared .load-* styles remain the visual source.
const sceneTemplate=typeof document==='undefined'?undefined:document.querySelector<HTMLElement>('#resource-loading .load-scene')?.cloneNode(true) as HTMLElement|undefined;
const mastheadTemplate=typeof document==='undefined'?undefined:document.querySelector<HTMLElement>('#resource-loading .load-top')?.cloneNode(true) as HTMLElement|undefined;
export interface HomePageModel {summary?:readonly string[];canContinue:boolean;canStart:boolean;canTutorial:boolean;notice:boolean;message?:string;reduced:boolean;showTutorialSkip?:boolean;canSkipTutorial?:boolean;checkingHistory?:boolean;firstPlayer?:boolean}

/** Native actions sit with the paper artwork; selection, persistence and routing stay in TitleScene. */
export class HomePage {
 readonly root=document.createElement('main');
 private summary=document.createElement('p');
 private start=document.createElement('button');
 private tutorial=document.createElement('button');
 private resume=document.createElement('button');
 private skip=document.createElement('button');
 private hint=document.createElement('p');
 private notice=document.createElement('p');
 private busy=false;
 private visibility=()=>this.root.toggleAttribute('data-home-paused',document.hidden);
 constructor(actions:{start:()=>void;tutorial:()=>void;resume:()=>void;skipTutorial:()=>void}){
  this.root.className='title-home';this.root.setAttribute('aria-label',GAME_NAME+'首页');
  const sheet=document.createElement('div');sheet.className='home-sheet';
  const masthead=mastheadTemplate?.cloneNode(true) as HTMLElement|undefined;
  if(masthead){masthead.classList.add('home-masthead');masthead.setAttribute('aria-hidden','true');sheet.append(masthead);}
  const art=sceneTemplate?.cloneNode(true) as HTMLElement|undefined;
  if(art){
   art.classList.add('home-hero');art.removeAttribute('aria-hidden');
   for(const ornament of art.querySelectorAll('.load-world,.load-side,.load-fan'))ornament.setAttribute('aria-hidden','true');
   for(const card of art.querySelectorAll('.load-card-seat'))card.classList.add('is-inked');
   sheet.append(art);
  }else {const heading=document.createElement('h1');heading.textContent=GAME_NAME;sheet.append(heading);}
  const entry=document.createElement('section');entry.className='home-entry';entry.setAttribute('aria-label','开始或继续');
  this.summary.className='home-save';this.summary.setAttribute('aria-label','当前存档');
  const buttons=document.createElement('div');buttons.className='home-actions';
  this.resume.type=this.start.type=this.tutorial.type=this.skip.type='button';
  this.resume.textContent='继续本局';this.start.textContent='开始新局';this.tutorial.textContent='新手首战';this.skip.textContent='跳过教程，直接选角';
  this.resume.dataset.ui='title/action/title-continue';this.start.dataset.ui='title/action/title-start';this.tutorial.dataset.ui='title/action/tutorial-start';this.skip.dataset.ui='title/action/skip-tutorial';
  this.resume.onclick=actions.resume;this.start.onclick=actions.start;this.tutorial.onclick=actions.tutorial;this.skip.onclick=actions.skipTutorial;
  buttons.append(this.resume,this.start,this.tutorial,this.skip);
  this.hint.className='home-hint';
  this.notice.className='home-notice';this.notice.textContent='存档提示请查看右上菜单。';this.notice.setAttribute('role','status');
  entry.append(this.summary,buttons,this.hint,this.notice);sheet.append(entry);
  const footer=document.createElement('p');footer.className='home-footer';footer.textContent='一纸纳山河 · 六位群英同席';sheet.append(footer);
  this.root.append(sheet);document.body.append(this.root);this.visibility();document.addEventListener('visibilitychange',this.visibility);
 }
 update(model:HomePageModel):void {
  this.root.dataset.homeMotion=model.reduced?'reduce':'full';this.root.dataset.hasSave=String(!!model.summary);
  this.summary.hidden=!model.summary;this.summary.replaceChildren(...(model.summary??[]).map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
  this.resume.hidden=!model.summary;this.resume.disabled=this.busy||!model.canContinue;this.start.disabled=this.busy||!model.canStart;this.tutorial.disabled=this.busy||!model.canTutorial;
  this.start.textContent=model.firstPlayer?'新手首战':'普通新局';this.tutorial.hidden=!!model.firstPlayer;
  this.skip.hidden=!model.showTutorialSkip;this.skip.disabled=this.busy||!model.canSkipTutorial;this.skip.className='home-text-action';
  this.hint.textContent=model.firstPlayer?(model.checkingHistory?'正在准备新手首战，也可以直接选角。':'一手牌一场实战，边玩边学会计分、构筑与英雄技能。'):'新手首战可随时重玩；普通新局从选英雄开始。';
  this.notice.textContent=model.message||'存档提示请查看右上菜单。';
  this.resume.className='home-primary';this.start.className=model.summary||!model.firstPlayer?'home-secondary':'home-primary';this.tutorial.className=model.summary?'home-secondary':'home-primary';this.notice.hidden=!model.notice;
 }
 confirm():void {this.busy=true;this.resume.disabled=this.start.disabled=this.tutorial.disabled=this.skip.disabled=true;this.root.setAttribute('aria-busy','true');}
 destroy():void {document.removeEventListener('visibilitychange',this.visibility);this.resume.onclick=this.start.onclick=this.tutorial.onclick=this.skip.onclick=null;this.root.remove();}
}
