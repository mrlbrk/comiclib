function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function normISBN(s){return String(s||'').replace(/[^0-9Xx]/g,'').toUpperCase()}
function proxyImage(url){return url?'https://wsrv.nl/?url='+encodeURIComponent(url)+'&w=700&output=jpg&maxage=30d':''}
async function json(url){try{const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)return null;return await r.json()}catch(_){return null}}
async function html(url){try{const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml,*/*;q=0.8'}});if(!r.ok)return '';return await r.text()}catch(_){return ''}}
function strip(s){return clean(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' '))}
function ogImage(s){const m=s.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)/i)||s.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);return m?m[1].replace(/&amp;/g,'&'):''}
function jsonLd(s){const out=[];const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(s))){try{const x=JSON.parse(m[1]);const arr=Array.isArray(x)?x:[x];for(const o of arr)if(o)out.push(o)}catch(_){}}return out}
function parsePage(s,url,q){
 const ld=jsonLd(s);const book=ld.find(x=>/Book|Product/i.test(String(x['@type']||'')))||{};const offers=book.offers||{};const title=book.name||((s.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)||[])[1])||'';
 const author=book.author;const authors=author?(Array.isArray(author)?author.map(x=>typeof x==='string'?x:x.name||''): [typeof author==='string'?author:author.name||'']):[];
 const isbn=normISBN(book.isbn||'')||((s.match(/(?:ISBN(?:-13)?|EAN)[^0-9]{0,30}(97[89][0-9 -]{10,20})/i)||[])[1]||'');
 const pub=((s.match(/(?:Editora|Publisher)[^A-Za-z0-9]{0,20}([^<|\n]{2,80})/i)||[])[1]||'').trim();
 const year=((s.match(/(?:20|19)\d{2}/)||[])[0]||'');
 const img=book.image||ogImage(s);
 return {title:strip(title),authors:authors.filter(Boolean),publisher:clean(pub),publishedDate:year,language:'pt',isbn:normISBN(isbn)||q,cover:proxyImage(img),url,source:'Brazil catalogue'};
}
async function googleWeb(q){
 const s=await html('https://www.google.com/search?q='+encodeURIComponent('"'+q+'" (site:orelhadelivro.com.br OR site:estantevirtual.com.br OR site:magazineluiza.com.br OR site:mercadolivre.com.br OR site:panini.com.br)')+'&hl=pt-BR&num=10');
 const urls=[];const re=/<a[^>]+href="(https?:\/\/[^"&]+)"/gi;let m;while((m=re.exec(s))&&urls.length<10){if(!urls.includes(m[1]))urls.push(m[1])}return urls;
}
export async function onRequestGet({request}){
 const q=clean(new URL(request.url).searchParams.get('q'));if(!q)return Response.json({items:[]},{status:400});const items=[];const seen=new Set();
 // Google Books BR is a real API and gives much better structured edition data than scraping search pages.
 const queries=[q, 'intitle:'+q];
 for(const qq of queries){const d=await json('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(qq)+'&maxResults=20&country=BR&langRestrict=pt');for(const it of (d&&d.items)||[]){const v=it.volumeInfo||{};const ids=v.industryIdentifiers||[];const isbn=(ids.find(x=>/^97[89]/.test(String(x.identifier||'')))||{}).identifier||'';const key=normISBN(isbn)||clean(v.title);if(!key||seen.has(key))continue;seen.add(key);const l=v.imageLinks||{};items.push({title:v.title||'',authors:(v.authors||[]),publisher:v.publisher||'',publishedDate:v.publishedDate||'',language:v.language||'pt',isbn:normISBN(isbn),cover:proxyImage(l.extraLarge||l.large||l.medium||l.thumbnail||l.smallThumbnail||''),url:'https://books.google.com/books?id='+encodeURIComponent(it.id),source:'Google Books BR'});}}
 // Brazilian web catalogues as a second source.
 const urls=await googleWeb(q);for(const u of urls.slice(0,8)){if(!/orelhadelivro|estantevirtual|magazineluiza|mercadolivre|panini\.com\.br/i.test(u))continue;const s=await html(u);if(!s)continue;const x=parsePage(s,u,/^97[89]\d{10}$/.test(q)?q:'');if(x.title){const key=x.isbn||x.title;if(!seen.has(key)){seen.add(key);items.push(x)}}}
 return Response.json({items:items.slice(0,20),source:'Brazil catalogues'},{headers:{'Cache-Control':'public,max-age=300'}});
}
