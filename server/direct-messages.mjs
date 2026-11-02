// Additive local-demo schema. No paid services, push delivery or third-party SDK.
export function installDirectMessages(db){db.exec(`
 CREATE TABLE IF NOT EXISTS dm_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  low_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  high_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  introduction TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','closed')),
  updated_at INTEGER NOT NULL,
  UNIQUE(low_id,high_id), CHECK(low_id<high_id), CHECK(initiated_by IN (low_id,high_id))
 );
 CREATE TABLE IF NOT EXISTS dm_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_key TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(thread_id,sender_id,client_key)
 );
 CREATE INDEX IF NOT EXISTS dm_messages_thread ON dm_messages(thread_id,id);
 CREATE INDEX IF NOT EXISTS dm_threads_high ON dm_threads(high_id,updated_at);
`);}

export async function handleDirectMessages({db,path,req,user,readJson,cleanText,fail,rate,assertSession,blocked,now}){
 const response=(status,data)=>({status,data});
 const serialize=t=>({id:t.id,status:t.status,introduction:t.introduction,outgoing:t.initiated_by===user.id,updatedAt:t.updated_at,other:{username:t.username,displayName:t.display_name}});
 function targetThread(id){
  const thread=db.prepare('SELECT * FROM dm_threads WHERE id=? AND (low_id=? OR high_id=?)').get(id,user.id,user.id);
  if(!thread||blocked(thread.low_id,thread.high_id))fail(404,'Gespräch nicht verfügbar.');
  return thread;
 }
 function enriched(id){return db.prepare('SELECT t.*,u.username,u.display_name FROM dm_threads t JOIN users u ON u.id=CASE WHEN t.low_id=? THEN t.high_id ELSE t.low_id END WHERE t.id=?').get(user.id,id);}
 if(path==='/api/dm/threads'&&req.method==='GET'){
  const rows=db.prepare(`SELECT t.*,u.username,u.display_name FROM dm_threads t JOIN users u ON u.id=CASE WHEN t.low_id=? THEN t.high_id ELSE t.low_id END
   WHERE (t.low_id=? OR t.high_id=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=t.low_id AND b.blocked_id=t.high_id) OR (b.user_id=t.high_id AND b.blocked_id=t.low_id)) ORDER BY t.updated_at DESC,t.id DESC LIMIT 100`).all(user.id,user.id,user.id);
  return response(200,{threads:rows.map(serialize)});
 }
 if(path==='/api/dm/requests'&&req.method==='POST'){
  rate(req,'dm-request',20);const data=await readJson(req),introduction=cleanText(data.introduction,500,'Vorstellung');assertSession();
  if(typeof data.username!=='string'||!/^[a-z0-9_]{3,24}$/.test(data.username))fail(400,'Ungültiger Nutzername.');
  const other=db.prepare('SELECT id FROM users WHERE username=?').get(data.username);
  if(!other||blocked(user.id,other.id))fail(404,'Profil nicht verfügbar.');
  if(other.id===user.id)fail(400,'Wähle eine andere Person.');
  const [low,high]=[user.id,other.id].sort((a,b)=>a-b),existing=db.prepare('SELECT * FROM dm_threads WHERE low_id=? AND high_id=?').get(low,high);
  if(existing&&existing.status!=='closed')fail(409,'Kontakt wurde bereits angefragt oder angenommen.');
  if(db.prepare("SELECT COUNT(*) AS n FROM dm_threads WHERE initiated_by=? AND status='pending'").get(user.id).n>=10)fail(429,'Höchstens zehn offene Kontaktanfragen.');
  if(!existing&&(db.prepare('SELECT COUNT(*) AS n FROM dm_threads').get().n>=2000||db.prepare('SELECT COUNT(*) AS n FROM dm_threads WHERE low_id=? OR high_id=?').get(user.id,user.id).n>=100))fail(429,'Gesprächsbudget der lokalen Demo erreicht.');
  let id;
  if(existing){id=existing.id;db.prepare("UPDATE dm_threads SET initiated_by=?,introduction=?,status='pending',updated_at=? WHERE id=?").run(user.id,introduction,now(),id);}
  else id=Number(db.prepare("INSERT INTO dm_threads(low_id,high_id,initiated_by,introduction,status,updated_at) VALUES (?,?,?,?,'pending',?)").run(low,high,user.id,introduction,now()).lastInsertRowid);
  return response(201,{thread:serialize(enriched(id))});
 }
 const match=path.match(/^\/api\/dm\/threads\/([1-9]\d{0,14})\/(answer|close|messages)$/);
 if(!match)return null;
 const id=Number(match[1]),action=match[2];let thread=targetThread(id);
 if(action==='answer'&&req.method==='POST'){
  const data=await readJson(req);assertSession();thread=targetThread(id);
  if(thread.status!=='pending'||thread.initiated_by===user.id)fail(403,'Nur die empfangende Person kann eine offene Anfrage beantworten.');
  if(!['accept','decline'].includes(data.answer))fail(400,'Annehmen oder ablehnen auswählen.');
  db.prepare('UPDATE dm_threads SET status=?,updated_at=? WHERE id=?').run(data.answer==='accept'?'accepted':'closed',now(),id);
  return response(200,{thread:serialize(enriched(id))});
 }
 if(action==='close'&&req.method==='POST'){
  db.prepare("UPDATE dm_threads SET status='closed',updated_at=? WHERE id=?").run(now(),id);return response(200,{ok:true});
 }
 if(action==='messages'&&req.method==='GET'){
  if(thread.status!=='accepted')fail(403,'Nachrichten erst nach angenommener Kontaktanfrage.');
  const before=new URL(req.url,'http://127.0.0.1').searchParams.get('before');
  if(before!==null&&!/^[1-9]\d{0,14}$/.test(before))fail(400,'Ungültige Nachrichtenseite.');
  const rows=db.prepare('SELECT m.id,m.body,m.created_at,m.sender_id FROM dm_messages m WHERE m.thread_id=? AND m.id<? ORDER BY m.id DESC LIMIT 51').all(id,before?Number(before):Number.MAX_SAFE_INTEGER);
  const more=rows.length>50;if(more)rows.pop();const next=more?rows.at(-1).id:null;
  return response(200,{messages:rows.reverse().map(m=>({id:m.id,body:m.body,createdAt:m.created_at,mine:m.sender_id===user.id})),next});
 }
 if(action==='messages'&&req.method==='POST'){
  rate(req,'dm-message',120);const data=await readJson(req),body=cleanText(data.body,2000,'Nachricht');assertSession();thread=targetThread(id);
  if(thread.status!=='accepted')fail(403,'Nachrichten erst nach angenommener Kontaktanfrage.');
  if(typeof data.clientKey!=='string'||!/^[a-f0-9-]{36}$/.test(data.clientKey))fail(400,'Gültige Nachrichtenkennung erforderlich.');
  const duplicate=db.prepare('SELECT id,body FROM dm_messages WHERE thread_id=? AND sender_id=? AND client_key=?').get(id,user.id,data.clientKey);
  if(duplicate){if(duplicate.body!==body)fail(409,'Nachrichtenkennung wurde für anderen Text benutzt.');return response(200,{id:duplicate.id,duplicate:true});}
  if(db.prepare('SELECT COUNT(*) AS n FROM dm_messages WHERE thread_id=?').get(id).n>=200||db.prepare('SELECT COUNT(*) AS n FROM dm_messages').get().n>=5000)fail(429,'Nachrichtenbudget der lokalen Demo erreicht.');
  db.exec('BEGIN IMMEDIATE');
  try{const messageId=Number(db.prepare('INSERT INTO dm_messages(thread_id,sender_id,client_key,body,created_at) VALUES (?,?,?,?,?)').run(id,user.id,data.clientKey,body,now()).lastInsertRowid);db.prepare('UPDATE dm_threads SET updated_at=? WHERE id=?').run(now(),id);db.exec('COMMIT');return response(201,{id:messageId,duplicate:false});}catch(error){db.exec('ROLLBACK');throw error;}
 }
 return null;
}
