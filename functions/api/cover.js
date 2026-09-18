function normalizeISBN(value){return String(value||'').replace(/[^0-9Xx]/g,'').toUpperCase()}
async function json(url){try{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ComicCollection/5.27'}});if(!r.ok)return null;return await r.json()}catch(_){return null}}
async function fetchImage(url){try{const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; ComicCollection/5.27)','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}});if(!r.ok)return null;const ct=r.headers.get('content-type')||'';if(!ct.toLowerCase().startsWith('image/'))return null;return new Response(r.body,{status:200,headers:{'Content-Type':ct,'Cache-Control':'public,max-age=86400'}})}catch(_){return null}}
async function fetchText(url){try{const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (compatible; ComicCollection/5.27)','Accept':'text/html,application/xhtml+xml,*/*;q=0.8'}});if(!r.ok)return '';return await r.text()}catch(_){return ''}}
function metaImage(s){const m=s.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)/i)||s.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);return m?m[1].replace(/&amp;/g,'&'):''}
function resultLinks(s){const out=[];const seen=new Set();const re=/<a[^>]+href=["']([^"']+)["'][^>]*>/gi;let m;while((m=re.exec(s))){let u=m[1];if(u.startsWith('/l/?kh=-1&uddg=')){try{u=decodeURIComponent(u.split('uddg=')[1])}catch(_){}}if(/^https?:\/\//i.test(u)&&!seen.has(u)){seen.add(u);out.push(u)}if(out.length>=20)break}return out}
async function searchBrazilImage(isbn){
 const q=encodeURIComponent('"'+isbn+'"');
 const bases=['https://www.bing.com/search?q=','https://html.duckduckgo.com/html/?q='];
 const domains=['orelhadelivro.com.br','estantevirtual.com.br','magazineluiza.com.br','mercadolivre.com.br','leiturapramim.com.br','panini.com.br'];
 for(const base of bases){const s=await fetchText(base+q+'%20('+domains.map(d=>'site:'+d).join('%20OR%20')+')');for(const u of resultLinks(s)){if(!domains.some(d=>u.includes(d)))continue;const h=await fetchText(u);const img=metaImage(h);if(img){const full=img.startsWith('//')?'https:'+img:img;const ok=await fetchImage(full);if(ok)return ok;}}}
 return null;
}
export async function onRequestGet({request}){
 const isbn=normalizeISBN(new URL(request.url).searchParams.get('isbn'));if(!/^(978|979)\d{10}$/.test(isbn))return new Response('Invalid ISBN',{status:400});
 const candidates=[];
 const gb=await json('https://www.googleapis.com/books/v1/volumes?q=isbn:'+encodeURIComponent(isbn)+'&maxResults=10&country=BR');
 const items=(gb&&gb.items)||[];const exact=items.find(item=>((item.volumeInfo||{}).industryIdentifiers||[]).some(id=>normalizeISBN(id.identifier)===isbn));const item=exact||items[0];const info=item&&item.volumeInfo;
 if(item&&item.id)candidates.push('https://books.google.com/books/content?id='+encodeURIComponent(item.id)+'&printsec=frontcover&img=1&zoom=2&source=gbs_api');
 const l=(info&&info.imageLinks)||{};candidates.push(l.extraLarge||l.large||l.medium||l.thumbnail||l.smallThumbnail||'');
 const ol=await json('https://openlibrary.org/isbn/'+encodeURIComponent(isbn)+'.json');if(ol&&ol.covers&&ol.covers[0])candidates.push('https://covers.openlibrary.org/b/id/'+ol.covers[0]+'-L.jpg');
 candidates.push('https://m.media-amazon.com/images/P/'+isbn+'.01.LZZZZZZZ.jpg');
 candidates.push('https://images-na.ssl-images-amazon.com/images/P/'+isbn+'.01.LZZZZZZZ.jpg');
 for(const c of candidates){if(!c)continue;const image=await fetchImage(String(c).replace(/^http:/,'https:'));if(image)return image;}
 const br=await searchBrazilImage(isbn);if(br)return br;
 return new Response('Cover not found',{status:404,headers:{'Cache-Control':'no-store'}});
}
