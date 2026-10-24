import './HeroSkillDialog.css';

/** Table skill workspaces size to their copy; the generic detail dialog is untouched. */
export function fitHeroSkillDialog(dialog:HTMLDialogElement):void {
 dialog.classList.add('hero-skill-compact');
 const actions=dialog.querySelector('.dialog-actions'),close=actions?.querySelector<HTMLButtonElement>('.dialog-close');
 if(close&&actions!.firstElementChild!==close){
  const focused=document.activeElement===close;actions!.prepend(close);
  if(focused)close.focus({preventScroll:true});
 }
}
