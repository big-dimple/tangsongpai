/** Browser-held locks expire with the page. Every save also checks the IndexedDB revision. */
export class WriteLease {
  writable=false;
  elsewhere=false;
  private release?:()=>void;
  private pending?:Promise<boolean>;
  private readonly channel:BroadcastChannel|undefined;
  private readonly owner=crypto.randomUUID();
  onChange:()=>void=()=>{};
  constructor(){
    try{this.channel=typeof BroadcastChannel==='undefined'?undefined:new BroadcastChannel('tangsongpai-writer');}catch{/* Revision checks still protect storage when messaging is unavailable. */}
    this.channel?.addEventListener('message',event=>{
      if(event.data?.type==='takeover'&&event.data.owner!==this.owner)this.drop(true);
    });
  }
  async claim(takeover=false):Promise<boolean> {
    if(this.writable)return true;
    if(this.pending)return this.pending;
    this.pending=this.acquire(takeover).finally(()=>{this.pending=undefined;});return this.pending;
  }
  private async acquire(takeover:boolean):Promise<boolean> {
    const available=()=>{this.writable=true;this.elsewhere=false;this.onChange();return true;};
    if(!navigator.locks)return available(); // Restricted browsers retain atomic revision checks.
    if(takeover)this.channel?.postMessage({type:'takeover',owner:this.owner});
    const abort=new AbortController(),timer=takeover?window.setTimeout(()=>abort.abort(),2000):undefined;
    return new Promise<boolean>(resolve=>{
      void Promise.resolve().then(()=>navigator.locks.request('tangsongpai-writer',takeover?{signal:abort.signal}:{ifAvailable:true},async lock=>{
        if(!lock){this.elsewhere=true;this.onChange();resolve(false);return;}
        if(timer!==undefined)clearTimeout(timer);
        available();resolve(true);
        await new Promise<void>(r=>this.release=r);
      })).catch(()=>{
        // A denied lock API is not evidence that a different page is playing.
        if(abort.signal.aborted){this.elsewhere=true;this.onChange();resolve(false);}else resolve(available());
      }).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
    });
  }
  drop(elsewhere=false):void {this.writable=false;this.elsewhere=elsewhere;this.release?.();this.release=undefined;this.onChange();}
}
