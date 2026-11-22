/** Keep closing punctuation with its preceding character without crossing authored line breaks. */
export function keepChinesePunctuation(
  value:string,
  wrap:(paragraph:string)=>string,
  fits:(line:string)=>boolean,
):string {
  return value.split('\n').map(paragraph=>{
    const lines=wrap(paragraph).split('\n');
    for(let i=1;i<lines.length;i++){
      const mark=lines[i].match(/^[，。！？；：、）》】」』〕”’…]+/)?.[0];
      if(!mark||!lines[i-1])continue;
      if(fits(lines[i-1]+mark)){
        lines[i-1]+=mark;
        lines[i]=lines[i].slice(mark.length);
      }else{
        const previous=Array.from(lines[i-1]);
        const last=previous.pop();
        if(last&&previous.length&&fits(last+lines[i])){
          lines[i-1]=previous.join('');
          lines[i]=last+lines[i];
        }
      }
    }
    return lines.filter((line,index)=>line!==''||index===0).join('\n');
  }).join('\n');
}
