/** Read-only browser observer. Rotated cards cover their faces, not their AABB corners. */
export function handIndexOcclusion(scene=window.__harness.game.scene.getScene('game')){
  const signedArea=points=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
  const corners=object=>['getTopLeft','getTopRight','getBottomRight','getBottomLeft'].map(method=>{
    const {x,y}=object[method](undefined,true);return {x,y};
  });
  const intersectArea=(subject,clip)=>{
    let points=subject;
    const direction=Math.sign(signedArea(clip));
    for(let i=0;i<clip.length&&points.length;i++){
      const a=clip[i],b=clip[(i+1)%clip.length],side=p=>direction*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));
      const input=points;points=[];
      let previous=input.at(-1),previousSide=side(previous);
      for(const current of input){
        const currentSide=side(current),inside=currentSide>=0,previousInside=previousSide>=0;
        if(inside!==previousInside){const t=previousSide/(previousSide-currentSide);points.push({x:previous.x+(current.x-previous.x)*t,y:previous.y+(current.y-previous.y)*t});}
        if(inside)points.push(current);
        previous=current;previousSide=currentSide;
      }
    }
    return Math.abs(signedArea(points));
  };
  const views=scene.cardViews.filter(card=>card.container.visible),layer=card=>scene.view.root.getIndex(card.container);
  return views.filter(card=>card.container.getData('selected')).map(card=>{
    const body=card.container.getData('cardBodyRoot')??card.container,index=body.list.find(object=>object.name==='rank-index');
    const indexCorners=corners(index),area=Math.abs(signedArea(indexCorners));
    if(!Number.isFinite(area)||area<=0)throw Error('rank/suit index has no measurable area: '+card.card.id);
    const occluders=views.filter(other=>other!==card&&layer(other)>layer(card)).map(other=>({id:other.card.id,fraction:intersectArea(indexCorners,corners(other.background))/area}));
    return {id:card.card.id,coveredBy:occluders.filter(other=>other.fraction>.06),occluders};
  });
}
