/** Wrap compact rack copy without splitting a signed number, multiplier or percentage. */
export function wrapPcJokerSummary(copy:string,width:number,maxLines:number,measure:(text:string)=>number):string {
 const tokens=copy.match(/[+\-×−]?\d+(?:[.,]\d+)*(?:%|倍)?|[^\d]/gu)??[];
 const lines:string[][]=[[]];let omitted=false;
 for(const token of tokens){
  const line=lines[lines.length-1],candidate=line.join('')+token;
  if(measure(candidate)<=width){line.push(token);continue;}
  if(lines.length>=maxLines||measure(token)>width){omitted=true;break;}
  lines.push([token]);
 }
 if(omitted){
  const line=lines[lines.length-1];
  while(line.length&&measure(line.join('')+'…')>width)line.pop();
  line.push('…');
 }
 return lines.map(line=>line.join('')).join('\n');
}
