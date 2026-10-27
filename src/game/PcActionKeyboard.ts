import type Phaser from 'phaser';
import type {TableLayout} from './layout';
import './PcActionKeyboard.css';

interface Entry {id:string;target:Phaser.GameObjects.Rectangle;activate:()=>void}

/** Native keyboard targets mirror the canvas without intercepting pointer input. */
export function mountPcActionKeyboard(scene:Phaser.Scene,layout:TableLayout,entries:Entry[],restoreId?:string){
 const layer=document.createElement('div');layer.className='pc-action-keyboard';layer.setAttribute('aria-label','牌桌操作');layer.setAttribute('role','group');
 const rect=scene.game.canvas.getBoundingClientRect();
 const buttons=entries.map(entry=>{
  const button=document.createElement('button'),bounds=entry.target.getBounds();button.type='button';button.className='pc-keyboard-action';button.dataset.pcKeyboardAction=entry.id;
  Object.assign(button.style,{left:rect.left+bounds.x*rect.width/layout.width+'px',top:rect.top+bounds.y*rect.height/layout.height+'px',width:bounds.width*rect.width/layout.width+'px',height:bounds.height*rect.height/layout.height+'px'});
  button.addEventListener('keydown',event=>{if(event.repeat&&(event.key==='Enter'||event.key===' '))event.preventDefault();});
  button.addEventListener('click',()=>{if(scene.scene.isActive()&&entry.target.active&&entry.target.visible&&entry.target.input?.enabled&&!document.querySelector('dialog[open]'))entry.activate();});
  layer.append(button);return {entry,button};
 });
 document.body.append(layer);
 let pendingFocus:string|undefined;
 const userPointer=()=>{pendingFocus=undefined;};
 const userTab=(event:KeyboardEvent)=>{if(event.key==='Tab')pendingFocus=undefined;};
 const otherFocus=(event:FocusEvent)=>{if(pendingFocus&&event.target!==buttons.find(({entry})=>entry.id===pendingFocus)?.button)pendingFocus=undefined;};
 window.addEventListener('pointerdown',userPointer,true);window.addEventListener('keydown',userTab,true);document.addEventListener('focusin',otherFocus,true);
 const update=()=>{for(const {entry,button} of buttons){
  const target=entry.target,label=target.getData('label') as Phaser.GameObjects.Text|undefined,status=target.getData('skillStatus') as Phaser.GameObjects.Text|undefined,count=target.getData('buttonCount') as Phaser.GameObjects.Text|undefined;
  const disabled=!target.active||!target.visible||!target.input?.enabled;
  if(disabled&&!button.disabled&&document.activeElement===button)pendingFocus=entry.id;
  button.disabled=disabled;
  button.setAttribute('aria-label',target.getData('ariaLabel')||[label?.text,status?.visible?status.text:undefined,count?.visible?count.text:undefined].filter(Boolean).join(' · ')||entry.id);
 }
 if(pendingFocus&&!document.querySelector('dialog[open]')&&document.hasFocus()&&document.activeElement===document.body){const target=buttons.find(({entry,button})=>entry.id===pendingFocus&&!button.disabled);if(target){pendingFocus=undefined;target.button.focus({preventScroll:true});}}
 };
 update();
 if(restoreId&&!document.querySelector('dialog[open]'))buttons.find(({entry,button})=>entry.id===restoreId&&!button.disabled)?.button.focus({preventScroll:true});
 return {update,focusedId:()=>buttons.find(({button})=>document.activeElement===button)?.entry.id??pendingFocus,destroy:()=>{window.removeEventListener('pointerdown',userPointer,true);window.removeEventListener('keydown',userTab,true);document.removeEventListener('focusin',otherFocus,true);layer.remove();}};
}
