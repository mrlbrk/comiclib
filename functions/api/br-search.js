function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function normISBN(s){return String(s||'').replace(/[^0-9Xx]/g,'').toUpperCase()}
function proxyImage(url){return url?'https://images.weserv.nl/?url='+encodeURIComponent(url)+'&w=900&output=jpg':''}
async function fetchText(url){try{const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; ComicCollection/5.27)','Accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'}});if(!r.ok)return '';return await r.text()}catch(_){return ''}}
async function fetchJson(url){try{const r=await fetch(url,{redirect:'follow',headers:{'Accept':'application/json','User-Agent':'ComicCollection/5.27'}});if(!r.ok)return null;return await r.json()}catch(_){return null}}
function strip(s){return clean(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' '))}
function meta(s,name){const re=new RegExp('<meta[^>]+(?:property|name)=["\\\']'+name+'["\\\'][^>]+content=["\\\']([^"\\\']+)','i');const re2=new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']'+name+'["\\\']','i');const m=s.match(re)||s.match(re2);return m?m[1].replace(/&amp;/g,'&'):''}
function jsonLd(s){const out=[];const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(s))){try{const x=JSON.parse(m[1]);for(const o of (Array.isArray(x)?x:[x]))if(o)out.push(o)}catch(_){}}return out}
function parsePage(s,url,q){
 const ld=jsonLd(s);const book=ld.find(x=>/Book|Product/i.test(String(x['@type']||'')))||{};
 const author=book.author;const authors=author?(Array.isArray(author)?author.map(x=>typeof x==='string'?x:x.name||''):[typeof author==='string'?author:author.name||'']):[];
 const isbn=normISBN(book.isbn)||normISBN((s.match(/(?:ISBN(?:-13)?|EAN|GTIN-13)[^0-9]{0,30}(97[89][0-9 -]{10,20})/i)||[])[1]||'');
 const title=book.name||meta(s,'og:title')||'';const image=book.image||meta(s,'og:image');
 const pub=book.publisher&&(typeof book.publisher==='string'?book.publisher:book.publisher.name||'');
 const date=book.datePublished||((s.match(/(?:Data de publicação|Ano de Publicação|Ano de publicação)[^0-9]{0,20}((?:19|20)\d{2})/i)||[])[1]||'');
 return {title:strip(title),authors:authors.filter(Boolean),publisher:clean(pub),publishedDate:date,language:'pt-BR',isbn:isbn||(/^(978|979)\d{10}$/.test(q)?q:''),cover:proxyImage(image),url,source:'Brazil catalogue'};
}
function resultLinks(s){const out=[];const seen=new Set();const re=/<a[^>]+href=["']([^"']+)["'][^>]*>/gi;let m;while((m=re.exec(s))){let u=m[1];if(u.startsWith('/l/?kh=-1&uddg=')){try{u=decodeURIComponent(u.split('uddg=')[1])}catch(_){}} if(/^https?:\/\//i.test(u)&&!seen.has(u)){seen.add(u);out.push(u)}if(out.length>=20)break}return out}
async function searchEngine(base,q){const s=await fetchText(base+encodeURIComponent(q));return resultLinks(s)}
async function searchPages(q){
 const exact=normISBN(q);const query=exact?'"'+exact+'"':'"'+q+'"';
 const domains=['orelhadelivro.com.br','estantevirtual.com.br','magazineluiza.com.br','mercadolivre.com.br','leiturapramim.com.br','panini.com.br'];
 const urls=[];const seen=new Set();
 const engines=[
  'https://www.bing.com/search?q=',
  'https://html.duckduckgo.com/html/?q='
 ];
 for(const base of engines){const links=await searchEngine(base,query+' ('+domains.map(d=>'site:'+d).join(' OR ')+')');for(const u of links){if(domains.some(d=>u.includes(d))&&!seen.has(u)){seen.add(u);urls.push(u)}}}
 return urls.slice(0,12);
}
export async function onRequestGet({request}){
 const q=clean(new URL(request.url).searchParams.get('q'));if(!q)return Response.json({items:[]},{status:400});
 const exact=normISBN(q);const items=[];const seen=new Set();
 // Structured Google Books BR lookup. Do not require langRestrict because some Brazilian editions are indexed with missing language metadata.
 const gbQueries=exact?['isbn:'+exact,'"'+exact+'"']:['"'+q+'"','intitle:'+q];
 for(const qq of gbQueries){const d=await fetchJson('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(qq)+'&maxResults=20&country=BR');for(const it of (d&&d.items)||[]){const v=it.volumeInfo||{};const ids=v.industryIdentifiers||[];const isbn=normISBN((ids.find(x=>/^97[89]/.test(String(x.identifier||'')))||{}).identifier||'');const key=isbn||clean(v.title);if(!key||seen.has(key))continue;seen.add(key);const l=v.imageLinks||{};items.push({title:v.title||'',subtitle:v.subtitle||'',authors:v.authors||[],publisher:v.publisher||'',publishedDate:v.publishedDate||'',language:v.language||'pt-BR',isbn,cover:proxyImage(l.extraLarge||l.large||l.medium||l.thumbnail||l.smallThumbnail||''),url:'https://books.google.com/books?id='+encodeURIComponent(it.id),source:'Google Books BR'});}}
 // Brazilian catalogues through search engines, including ISBN-first lookup.
 for(const u of await searchPages(q)){const s=await fetchText(u);if(!s)continue;const x=parsePage(s,u,exact);if(!x.title)continue;const key=x.isbn||x.title;if(!seen.has(key)){seen.add(key);items.push(x)}}
 return Response.json({items:items.slice(0,20),source:'Brazilian edition search'},{headers:{'Cache-Control':'public,max-age=300'}});
}
