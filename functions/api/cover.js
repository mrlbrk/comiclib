function normalizeISBN(value) {
  return String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}
async function json(url) {
  try { const r = await fetch(url, {headers:{Accept:'application/json'}}); if (!r.ok) return null; return await r.json(); } catch (_) { return null; }
}
function wsrv(url) {
  return 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=700&output=jpg&maxage=30d';
}
async function imageProxyWorks(url) {
  try {
    const r = await fetch(url, {method:'HEAD', redirect:'follow', headers:{'User-Agent':'Mozilla/5.0','Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'}});
    const ct = r.headers.get('content-type') || '';
    return r.ok && ct.startsWith('image/');
  } catch (_) { return false; }
}
export async function onRequestGet({request}) {
  const u = new URL(request.url);
  const isbn = normalizeISBN(u.searchParams.get('isbn'));
  if (!/^(978|979)\d{10}$/.test(isbn)) return new Response('Invalid ISBN', {status:400});
  const candidates = [];
  const gb = await json('https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn) + '&maxResults=10&country=BR');
  const items = (gb && gb.items) || [];
  const exact = items.find(item => ((item.volumeInfo || {}).industryIdentifiers || []).some(id => normalizeISBN(id.identifier) === isbn));
  const item = exact || items[0];
  const info = item && item.volumeInfo;
  if (item && item.id) candidates.push('https://books.google.com/books/content?id=' + encodeURIComponent(item.id) + '&printsec=frontcover&img=1&zoom=2&source=gbs_api');
  const links = (info && info.imageLinks) || {};
  for (const k of ['extraLarge','large','medium','thumbnail','smallThumbnail']) if (links[k]) candidates.push(String(links[k]).replace(/^http:/,'https:'));
  const ol = await json('https://openlibrary.org/isbn/' + encodeURIComponent(isbn) + '.json');
  if (ol && ol.covers && ol.covers[0]) candidates.push('https://covers.openlibrary.org/b/id/' + ol.covers[0] + '-L.jpg');
  candidates.push('https://m.media-amazon.com/images/P/' + isbn + '.01.LZZZZZZZ.jpg');
  candidates.push('https://images-na.ssl-images-amazon.com/images/P/' + isbn + '.01.LZZZZZZZ.jpg');
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    const proxy = wsrv(candidate);
    if (await imageProxyWorks(proxy)) return Response.redirect(proxy, 302);
  }
  return new Response('Cover not found', {status:404, headers:{'Cache-Control':'no-store'}});
}
