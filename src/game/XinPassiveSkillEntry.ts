import type {SceneView} from './SceneView';
import type {Box} from './layout';
import {PAPER_CSS as C} from './theme';
/** Plain information in the existing skill slot; no interactive target or button skin. */
export function renderXinPassiveSkillEntry(view:SceneView,box:Box,cue:{label:string;detail:string;ariaLabel:string},portrait=false){
 const inset=portrait?42:0,room=box.width-inset,center=box.x+inset+room/2,titleWidth=cue.label.length*14,left=center-(titleWidth+34)/2;
 const anchor=view.rect(box).setFillStyle(0,0).setStrokeStyle().setName('hero/passive-skill').setData('ariaLabel',cue.ariaLabel);
 view.text(left,box.y+2,cue.label,14,C.ink).setFontStyle('bold').setName('hero/passive-name');
 view.text(left+titleWidth+6,box.y+3,'被动',11,C.jade).setBackgroundColor('#e5eee5').setPadding(3,1).setName('hero/passive-badge');
 const description=view.text(center,box.y+box.height-17,cue.detail,12,C.ink,room-4).setOrigin(.5,0).setName('hero/passive-description');
 return {anchor,description};
}
