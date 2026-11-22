import {SUIT_SYMBOL, type Suit} from '../cards/types';
import {GAME_NAME} from './Brand';
import {assetUrl} from './theme';
import type {FirstPlayerStatus} from './TutorialEntry';
import './HomePage.css';

export interface HomePageModel {
  summary?:readonly string[];
  canContinue:boolean;
  canStart:boolean;
  canTutorial:boolean;
  notice:boolean;
  message?:string;
  canSkipTutorial?:boolean;
  checkingHistory?:boolean;
  playerStatus:FirstPlayerStatus;
  reducedMotion?:boolean;
}

interface HomeActions {
  start:(cardId?:string)=>void;
  tutorial:()=>void;
  resume:()=>void;
  skipTutorial:()=>void;
}

const openingFaces = [
  {suit:'clubs', rank:5, name:'梅花'},
  {suit:'hearts', rank:5, name:'红桃'},
  {suit:'diamonds', rank:4, name:'方片'},
] as const;

const entryCopy = {
  first: {heading:'从一对牌起手', hint:'跟刘娥找两张点数相同的牌。', start:'新手首战'},
  returning: {heading:'选一位英雄入局', hint:'挑选英雄与起手路线，去河市备牌。', start:'普通新局'},
  unknown: {heading:'准备开局', hint:'初次开局可跟刘娥学出牌，也可直接选角。', start:'开始游戏'},
};

function element<K extends keyof HTMLElementTagNameMap>(tag:K,className:string,copy?:string):HTMLElementTagNameMap[K] {
  const el=document.createElement(tag);
  el.className=className;
  if(copy)el.textContent=copy;
  return el;
}

function action(id:string,label:string,run:()=>void):HTMLButtonElement {
  const button=element('button','',label);
  button.type='button';
  button.dataset.ui='title/action/'+id;
  button.onclick=run;
  return button;
}

function openingCard(suit:Suit,rank:number,name:string,start:HomeActions['start']) {
  const id=suit+'-'+rank,symbol=SUIT_SYMBOL[suit];
  const seat=element('span','load-card-seat');
  const face=element('span','load-card home-playing-card');
  face.setAttribute('aria-hidden','true');
  face.dataset.suit=suit;
  const index=element('span','home-card-index');
  index.append(element('b','',String(rank)),element('i','',symbol));
  const pips=element('span','home-pips');
  for(let i=0;i<rank;i++)pips.append(element('i','',symbol));
  face.append(index,pips,index.cloneNode(true));
  const pick=action('pick-'+id,'',()=>start(id));
  pick.className='home-pick';
  pick.setAttribute('aria-label','拿起'+name+rank+'，开始新手首战');
  pick.hidden=true;
  seat.append(face,pick);
  return {seat,pick};
}

export class HomePage {
  readonly root=element('main','title-home');
  private readonly heading=element('h2','');
  private readonly summary=element('p','home-save');
  private readonly hint=element('p','home-hint');
  private readonly notice=element('p','home-notice');
  private readonly pickHint=element('figcaption','home-pick-hint','拿一张牌入局');
  private readonly picks:HTMLButtonElement[]=[];
  private readonly start:HTMLButtonElement;
  private readonly tutorial:HTMLButtonElement;
  private readonly resume:HTMLButtonElement;
  private readonly skip:HTMLButtonElement;
  private busy=false;

  constructor(actions:HomeActions) {
    this.root.setAttribute('aria-label',GAME_NAME+'首页');
    const sheet=element('div','home-sheet');
    const art=element('section','home-hero');
    art.setAttribute('aria-label','开场画卷');
    const world=element('div','load-world');
    const river=element('img','');
    river.alt='';
    river.src=assetUrl('assets/p00/river-market.webp');
    world.append(river);
    const masthead=element('header','home-masthead');
    const genre=element('span','home-genre','唐宋人物 · 扑克构筑');
    const sound=element('div','home-sound');
    masthead.append(genre,sound);
    const brand=element('div','home-brand');
    const title=element('h1','home-wordmark',GAME_NAME);
    const seal=element('span','load-seal','开卷');
    seal.setAttribute('aria-hidden','true');
    brand.append(title,seal,element('p','home-chapters','八章 · 二十四场'));
    const deck=element('figure','home-deck');
    const fan=element('div','home-fan');
    for(const {suit,rank,name} of openingFaces){
      const card=openingCard(suit,rank,name,actions.start);
      fan.append(card.seat);
      this.picks.push(card.pick);
    }
    deck.append(fan,this.pickHint);
    const cast=element('div','home-cast');
    cast.setAttribute('aria-hidden','true');
    art.append(world,masthead,brand,deck,cast);

    const entry=element('section','home-entry');
    entry.setAttribute('aria-label','开始或继续');
    this.summary.setAttribute('aria-label','当前存档');
    this.notice.setAttribute('role','status');
    const copy=element('div','home-copy');
    copy.append(this.heading,this.hint,this.summary,this.notice);
    this.resume=action('title-continue','继续本局',actions.resume);
    this.start=action('title-start','开始新局',()=>actions.start());
    this.tutorial=action('tutorial-start','新手首战',actions.tutorial);
    this.skip=action('skip-tutorial','直接选角',actions.skipTutorial);
    this.skip.setAttribute('aria-label','跳过教程，直接选角');
    const buttons=element('div','home-actions');
    buttons.append(this.resume,this.start,this.tutorial,this.skip);
    entry.append(copy,buttons);
    sheet.append(art,entry);
    this.root.append(sheet);
    document.body.append(this.root);
  }

  update(model:HomePageModel):void {
    const first=model.playerStatus==='first';
    const entry=entryCopy[model.playerStatus];
    this.root.dataset.reducedMotion=String(!!model.reducedMotion);
    this.heading.textContent=model.summary?'续上这局':entry.heading;
    this.hint.hidden=!!model.summary;
    this.hint.textContent=model.checkingHistory?'正在准备牌桌，也可以直接选角。':entry.hint;
    this.summary.hidden=!model.summary;
    this.summary.replaceChildren(...(model.summary??[]).map(copy=>element('span','',copy)));
    this.notice.hidden=!model.notice;
    this.notice.textContent=model.message||'存档提示请查看右上菜单。';
    this.resume.hidden=!model.summary;
    this.resume.disabled=this.busy||!model.canContinue;
    this.resume.className='home-primary';
    this.start.textContent=entry.start;
    this.start.disabled=this.busy||!model.canStart;
    this.start.className=model.summary?'home-secondary':'home-primary';
    this.tutorial.hidden=first;
    this.tutorial.disabled=this.busy||!model.canTutorial;
    this.tutorial.className='home-secondary';
    this.skip.hidden=model.playerStatus==='returning';
    this.skip.disabled=this.busy||!model.canSkipTutorial;
    this.skip.className='home-secondary';
    this.pickHint.hidden=!first;
    for(const pick of this.picks){
      pick.hidden=!first;
      pick.disabled=this.busy||!model.canStart;
    }
  }

  confirm():void {
    this.busy=true;
    for(const button of [this.start,this.tutorial,this.resume,this.skip,...this.picks])button.disabled=true;
    this.root.setAttribute('aria-busy','true');
  }

  destroy():void {this.root.remove();}
}
