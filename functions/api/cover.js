function normalizeISBN(value) {
  return String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}
async function json(url) {
  try {
    const r = await fetch(url, {headers:{Accept:'application/json'}});
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}
function proxy(url) {
  return 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=900&output=jpg&maxage=30d';
}
async function html(url) {
  try {
    const r = await fetch(url, {redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml,*/*;q=0.8'}});
    if (!r.ok) return '';
    return await r.text();
  } catch (_) { return ''; }
}
function ogImage(s) {
  const m=s.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)/i) || s.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
  return m ? m[1].replace(/&amp;/g,'&') : '';
}
function googleImage(info) {
  const l=(info&&info.imageLinks)||{};
  return l.extraLarge||l.large||l.medium||l.thumbnail||l.smallThumbnail||'';
}
async function findBrazilianCover(isbn) {
  const queries=[
    '"'+isbn+'"',
    '"'+isbn+'" ZDM Panini'
  ];
  for (const q of queries) {
    const u='https://www.google.com/search?q='+encodeURIComponent(q)+'&hl=pt-BR&num=10';
    const s=await html(u);
    const urls=[];
    const re=/<a[^>]+href="(https?:\/\/[^"&]+)"/gi;
    let m; while((m=re.exec(s)) && urls.length<10) urls.push(m[1]);
    for(const page of urls){
      if(!/orelhadelivro\.com\.br|estantevirtual\.com\.br|magazineluiza\.com\.br|universohq\.com|panini\.com\.br/i.test(page)) continue;
      const h=await html(page); const img=ogImage(h);
      if(img) return img.startsWith('//')?'https:'+img:img;
    }
  }
  return '';
}
export async function onRequestGet({request}) {
  const u=new URL(request.url);
  const isbn=normalizeISBN(u.searchParams.get('isbn'));
  if(!/^(978|979)\d{10}$/.test(isbn)) return new Response('Invalid ISBN',{status:400});
  const candidates=[];
  const gb=await json('https://www.googleapis.com/books/v1/volumes?q=isbn:'+encodeURIComponent(isbn)+'&maxResults=10&country=BR');
  const items=(gb&&gb.items)||[];
  const exact=items.find(item=>((item.volumeInfo||{}).industryIdentifiers||[]).some(id=>normalizeISBN(id.identifier)===isbn));
  const item=exact||items[0];
  const info=item&&item.volumeInfo;
  if(item&&item.id) candidates.push('https://books.google.com/books/content?id='+encodeURIComponent(item.id)+'&printsec=frontcover&img=1&zoom=2&source=gbs_api');
  const g=googleImage(info); if(g)candidates.push(String(g).replace(/^http:/,'https:'));
  const ol=await json('https://openlibrary.org/isbn/'+encodeURIComponent(isbn)+'.json');
  if(ol&&ol.covers&&ol.covers[0]) candidates.push('https://covers.openlibrary.org/b/id/'+ol.covers[0]+'-L.jpg');
  candidates.push('https://m.media-amazon.com/images/P/'+isbn+'.01.LZZZZZZZ.jpg');
  candidates.push('https://images-na.ssl-images-amazon.com/images/P/'+isbn+'.01.LZZZZZZZ.jpg');
  for(const c of candidates){ if(c) return Response.redirect(proxy(c),302); }
  const br=await findBrazilianCover(isbn); if(br) return Response.redirect(proxy(br),302);
  return new Response('Cover not found',{status:404,headers:{'Cache-Control':'no-store'}});
}
