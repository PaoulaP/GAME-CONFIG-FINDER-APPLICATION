import http from 'node:http';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./Game-Finder-Profils.html', import.meta.url), 'utf8');
const ids = [...page.matchAll(/\["(\d+)","/g)].map(match=>match[1]);
let cache;
let loading;
function plain(html = '') {
 return html.replace(/<br\s*\/?\s*>|<\/li>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
async function catalogue() {
 if(cache && Date.now()-cache.at < 3600000) return cache.games;
 if(loading) return loading;
 loading = (async()=>{
  const games=[];
  for(let offset=0;offset<ids.length;offset+=4){
   const batch=await Promise.allSettled(ids.slice(offset,offset+4).map(async id=>{
    const response=await fetch('https://store.steampowered.com/api/appdetails?appids='+id+'&l=french',{signal:AbortSignal.timeout(6000)});
    if(!response.ok) throw new Error('Steam HTTP '+response.status);
    const payload=await response.json();
    const data=payload[id]?.data;
    if(!payload[id]?.success || !data) return null;
    return {id,summary:plain(data.short_description),requirements:plain(data.pc_requirements?.minimum),image:data.header_image};
   }));
   games.push(...batch.filter(item=>item.status==='fulfilled' && item.value).map(item=>item.value));
  }
  if(!games.length){if(cache) return cache.games;throw new Error('Steam indisponible');}
  cache={at:Date.now(),games};
  return games;
 })().finally(()=>{loading=null;});
 return loading;
}
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 if(path==='/api/steam'){
  try{const games=await catalogue();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({games}));}
  catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Steam indisponible'}));}
  return;
 }
 if(path==='/' || path==='/Game-Finder-Profils.html'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return;
 }
 res.writeHead(404);res.end('Page introuvable');
}).listen(3000,'127.0.0.1',()=>console.log('Game Finder disponible sur http://localhost:3000'));
