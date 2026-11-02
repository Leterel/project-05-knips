const placements=new Set(['feed-sponsor','support-link']);
// A provider is an explicit future integration; creating/configuring the server
// never invokes it. No SDK, network request, identifier or telemetry is supplied.
export function createCommercialExtension(provider=null){
 if(provider!==null&&typeof provider!=='function')throw Error('Commercial provider must be a function or null.');
 return Object.freeze({
  publicState:()=>({configured:provider!==null,automaticTracking:false,placements:[...placements]}),
  async offer(placement){if(!placements.has(placement))throw Error('Unknown commercial placement.');if(provider===null)return null;const value=await provider(Object.freeze({placement}));if(value===null)return null;
   if(!value||!['sponsor','support'].includes(value.kind)||typeof value.text!=='string'||!value.text.trim()||value.text.length>120)throw Error('Invalid commercial offer.');
   let url;try{url=new URL(value.href);}catch{throw Error('Invalid offer destination.');}if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw Error('Invalid offer destination.');
   return {kind:value.kind,text:value.text.trim(),href:url.href,disclosure:value.kind==='sponsor'?'Werbung / Sponsor':'Freiwillige Unterstützung'};
  }
 });
}
