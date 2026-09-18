function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function abs(u,base='https://www.google.com'){try{return new URL(u,base).toString()}catch(_){return ''}}
function strip(s){return clean(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' '))}
function first(re,s){const m=s.match(re);return m?clean(m[1]):''}
function proxyImage(url){return url?'https://wsrv.nl/?url='+encodeURIComponent(url)+'&w=700&output=jpg':''}
async function fetchText(url,headers={}){try{const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml,*/*;q=0.8',...headers}});if(!r.ok)return '';return await r.text()}catch(_){return ''}}
function parseGoogle(html){
 const out=[];
 const blocks=html.split(/<div[^>]+class="[^\"]*(?:MjjYud|tF2Cxc)[^\"]*"[^>]*>/i).slice(1);
 for(const b of blocks.slice(0,12)){
  const href=first(/<a[^>]+href="([^"]+)"/i,b); if(!href||!/^https?:/i.test(href))continue;
  const title=first(/<h3[^>]*>([\s\S]*?)<\/h3>/i,b); if(!title)continue;
  const text=strip(b); const url=abs(href);
  if(/orelhadelivro\.com\.br|estantevirtual\.com\.br|magazineluiza\.com\.br|leia\.livrariacultura\.com\.br|amazon\.com\.br|panini\.com\.br|mercadolivre\.com\.br/i.test(url)) out.push({title:strip(title),url,snippet:text});
 }
 return out;
}
function parsePage(html,url,isbn){
 const title=first(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,html)||first(/<title[^>]*>([\s\S]*?)<\/title>/i,html);
 const image=first(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,html);
 const cleanText=strip(html);
 const authors=[];
 const am=cleanText.match(/(?:Autor(?:es)?|Author(?:s)?)\s*[:|]\s*([^|]{2,120})/i); if(am)authors.push(clean(am[1]));
 const pm=cleanText.match(/(?:Editora|Publisher)\s*[:|]\s*([^|]{2,120})/i);
 const ym=cleanText.match(/(?:Ano de Publica(?:ç|c)ão|Data de publica(?:ç|c)ão|Published)\s*[:|]\s*([^|]{4,40})/i);
 const lm=cleanText.match(/Idioma\s*[:|]\s*([^|]{2,40})/i);
 const im=cleanText.match(/(?:ISBN(?:-13)?|EAN)\s*[:|]\s*([^|\s]{10,20})/i);
 return {title:clean(title).replace(/\s*[|-]\s*(Orelha de Livro|Estante Virtual).*$/i,''),authors,publisher:pm?clean(pm[1]):'',publishedDate:ym?clean(ym[1]):'',language:lm?clean(lm[1]):'pt',isbn:im?im[1].replace(/[^0-9Xx]/g,''):isbn,cover:proxyImage(abs(image,url)),source:'Brazil web'};
}
export async function onRequestGet({request}){
 const u=new URL(request.url); const q=clean(u.searchParams.get('q')); if(!q)return Response.json({items:[]},{status:400});
 const search='site:orelhadelivro.com.br OR site:estantevirtual.com.br OR site:magazineluiza.com.br '+q+' quadrinhos HQ Panini';
 const url='https://www.google.com/search?q='+encodeURIComponent(search)+'&hl=pt-BR&num=10';
 const html=await fetchText(url); const hits=parseGoogle(html); const items=[];
 for(const h of hits.slice(0,6)){
   const page=await fetchText(h.url); if(!page)continue;
   const item=parsePage(page,h.url,/^97[89]\d{10}$/.test(q)?q:'');
   if(item.title||item.isbn){item.url=h.url;item.snippet=h.snippet;items.push(item)}
 }
 return Response.json({items,source:'Brazil web'},{headers:{'Cache-Control':'public,max-age=300'}});
}
