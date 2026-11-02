export function createMessenger({api,getUser,notice,confirm}){
 const $=id=>document.getElementById(id),root=$('direct-messages');
 let epoch=0,owner=null,selected=null,lastSend=null,sending=null;
 const current=(version,id)=>epoch===version&&getUser()?.id===id&&!root.hidden;
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const labels={pending:'Anfrage offen',accepted:'Verbunden',closed:'Beendet · neue Zustimmung nötig'};
 function clear(){epoch++;owner=null;selected=null;lastSend=null;sending=null;$('dm-lines').replaceChildren();$('dm-threads').replaceChildren();$('dm-request').reset();$('dm-send-form').reset();$('dm-conversation').hidden=true;for(const id of ['dm-heading','dm-introduction','dm-state'])$(id).textContent='';$('dm-older').hidden=true;$('dm-older').dataset.before='';}
 async function open(thread){
  const changed=selected?.id!==thread.id;selected=thread;const version=++epoch,id=owner;
  if(changed||thread.status!=='accepted'){$('dm-body').value='';lastSend=null;}
  $('dm-conversation').hidden=false;$('dm-heading').textContent=`@${thread.other.username}`;$('dm-introduction').textContent=thread.introduction;$('dm-state').textContent=labels[thread.status];$('dm-lines').replaceChildren();$('dm-send-form').hidden=thread.status!=='accepted';
  $('dm-accept').hidden=$('dm-decline').hidden=thread.status!=='pending'||thread.outgoing;$('dm-close').hidden=thread.status==='closed';$('dm-send').disabled=!!sending;$('dm-older').hidden=true;
  if(thread.status!=='accepted')return;
  try{const result=await api(`/api/dm/threads/${thread.id}/messages`);if(!current(version,id))return;renderMessages(result.messages,false);$('dm-older').hidden=!result.next;$('dm-older').dataset.before=result.next||'';}catch(error){if(current(version,id))notice(error.message,true);}
 }
 function renderMessages(messages,prepend){const rows=messages.map(m=>{const row=node('li','');row.className='dm-line'+(m.mine?' mine':'');row.append(node('strong',m.mine?'Du':`@${selected.other.username}`),node('p',m.body));return row;});if(prepend)$('dm-lines').prepend(...rows);else $('dm-lines').replaceChildren(...rows);}
 async function show(){
  const user=getUser();if(!user)return;if(owner!==user.id)clear();owner=user.id;const version=++epoch,id=owner;
  try{const result=await api('/api/dm/threads');if(!current(version,id))return;$('dm-threads').replaceChildren();
   for(const thread of result.threads){const button=node('button',`@${thread.other.username} · ${labels[thread.status]}${thread.status==='pending'?(thread.outgoing?' · gesendet':' · empfangen'):''}`);button.type='button';button.className='dm-thread';button.dataset.threadId=thread.id;button.onclick=()=>open(thread);$('dm-threads').append(button);}
   if(!result.threads.length)$('dm-threads').append(node('p','Noch keine Gespräche. Frage ein anderes Demokonto an.'));
   const existing=result.threads.find(t=>t.id===selected?.id);if(existing)await open(existing);else{selected=null;$('dm-conversation').hidden=true;$('dm-lines').replaceChildren();$('dm-body').value='';lastSend=null;}
  }catch(error){if(current(version,id))notice(error.message,true);}
 }
 async function mutation(path,body){const id=owner;await api(path,{method:'POST',body});if(getUser()?.id===id&&!root.hidden)await show();}
 $('dm-request').onsubmit=async event=>{event.preventDefault();const button=$('dm-request-send'),id=owner;button.disabled=true;try{await mutation('/api/dm/requests',{username:$('dm-username').value.trim().toLowerCase(),introduction:$('dm-note').value});if(getUser()?.id===id){$('dm-request').reset();notice('Kontaktanfrage lokal gespeichert. Die andere Person muss sie annehmen.');}}catch(error){if(getUser()?.id===id)notice(error.message,true);}finally{button.disabled=false;}};
 for(const [id,answer]of [['dm-accept','accept'],['dm-decline','decline']])$(id).onclick=async()=>{const thread=selected,ownerId=owner;try{if(thread)await mutation(`/api/dm/threads/${thread.id}/answer`,{answer});}catch(error){if(getUser()?.id===ownerId)notice(error.message,true);}};
 $('dm-close').onclick=async()=>{const thread=selected,ownerId=owner;try{if(thread&&await confirm('Gespräch beenden? Für weitere Nachrichten ist eine neue angenommene Anfrage nötig.'))await mutation(`/api/dm/threads/${thread.id}/close`,{});}catch(error){if(getUser()?.id===ownerId)notice(error.message,true);}};
 $('dm-block').onclick=async()=>{const thread=selected,ownerId=owner;try{if(!thread||!await confirm(`@${thread.other.username} blockieren? Auch Direktnachrichten werden beidseitig gesperrt.`))return;await api(`/api/blocks/${thread.other.username}`,{method:'PUT',body:{}});if(getUser()?.id===ownerId)await show();}catch(error){if(getUser()?.id===ownerId)notice(error.message,true);}};
 $('dm-send-form').onsubmit=async event=>{
  event.preventDefault();const thread=selected,text=$('dm-body').value.trim(),id=owner,version=epoch;if(!thread||sending||!text)return;
  if(!lastSend||lastSend.thread!==thread.id||lastSend.text!==text)lastSend={thread:thread.id,text,key:crypto.randomUUID()};
  const operation=Symbol('send');sending=operation;$('dm-send').disabled=true;
  try{await api(`/api/dm/threads/${thread.id}/messages`,{method:'POST',body:{body:text,clientKey:lastSend.key}});if(current(version,id)){if($('dm-body').value.trim()===text)$('dm-body').value='';lastSend=null;await show();}}
  catch(error){if(current(version,id))notice(error.message,true);}finally{if(sending===operation){sending=null;if(getUser()?.id===id)$('dm-send').disabled=false;}}
 };
 $('dm-older').onclick=async()=>{const thread=selected,version=epoch,id=owner,before=$('dm-older').dataset.before;if(!thread||!before)return;$('dm-older').disabled=true;try{const result=await api(`/api/dm/threads/${thread.id}/messages?before=${encodeURIComponent(before)}`);if(!current(version,id))return;renderMessages(result.messages,true);$('dm-older').hidden=!result.next;$('dm-older').dataset.before=result.next||'';}catch(error){if(current(version,id))notice(error.message,true);}finally{$('dm-older').disabled=false;}};
 return {show,clear,suspend(){epoch++;}};
}
