import type Phaser from 'phaser';
/** Semantic card carrier keeps layout/hit ownership; only its printed body moves. */
export function cardVisualRoot(card:{container:Phaser.GameObjects.Container;visual?:Phaser.GameObjects.Container}):Phaser.GameObjects.Container {
 const body=card.visual??card.container.getData?.('cardBodyRoot') as Phaser.GameObjects.Container|undefined;
 return body?.active?body:card.container;
}
export function cardFaceOwner(object:Phaser.GameObjects.GameObject):Phaser.GameObjects.Container|undefined {
 for(let node=object as Phaser.GameObjects.Container|undefined;node;node=node.parentContainer??undefined)if(node.getData?.('cardFace'))return node;
}
