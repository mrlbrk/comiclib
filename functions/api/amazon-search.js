function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(url) {
  if (!url) return '';
  try { return new URL(url, 'https://www.amazon.es').toString(); } catch (_) { return ''; }
}

function firstNonEmpty(...values) {
  for (const v of values) {
    const t = cleanText(v);
    if (t) return t;
  }
  return '';
}

function parseJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\\s\\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const items = Array.isArray(data) ? data : (Array.isArray(data.itemListElement) ? data.itemListElement : [data]);
      for (const item of items) {
        const x = item && item.item ? item.item : item;
        if (!x || typeof x !== 'object') continue;
        const title = firstNonEmpty(x.name, x.headline);
        if (!title) continue;
        out.push({
          title,
          subtitle: cleanText(x.description),
          authors: x.author ? (Array.isArray(x.author) ? x.author.map(a => cleanText(a && a.name ? a.name : a)).filter(Boolean) : [cleanText(x.author.name || x.author)].filter(Boolean)) : [],
          publisher: cleanText(x.publisher && x.publisher.name ? x.publisher.name : x.publisher),
          isbn: cleanText(x.isbn),
          cover: absoluteUrl(x.image),
          url: absoluteUrl(x.url),
          price: cleanText(x.offers && x.offers.price ? x.offers.price : '')
        });
      }
    } catch (_) {}
  }
  return out;
}

function parseAsinBlocks(html) {
  const out = [];
  const re = /data-asin=["']([A-Z0-9]{10})["'][^>]*>([\s\S]{0,12000}?)(?=data-asin=["']|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const asin = m[1];
    const block = m[2];
    const titleMatch = block.match(/(?:class=["'][^"']*(?:a-text-normal|a-size-medium|a-size-base-plus)[^"']*["'][^>]*>)([\s\S]*?)<\/[^>]+>/i);
    const title = cleanText(titleMatch ? titleMatch[1].replace(/<[^>]+>/g, ' ') : '');
    if (!title) continue;
    const img = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
    const href = block.match(/<a[^>]+href=["']([^"']+)["']/i);
    const price = block.match(/class=["'][^"']*(?:a-price-whole|a-offscreen)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    out.push({title, isbn:'', cover:absoluteUrl(img && img[1]), url:absoluteUrl(href && href[1]), price:cleanText(price && price[1]), asin});
  }
  return out;
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const q = cleanText(url.searchParams.get('q'));
  if (!q) return Response.json({items: [], error: 'Missing query'}, {status: 400});

  const amazonUrl = 'https://www.amazon.es/s?k=' + encodeURIComponent(q) + '&i=stripbooks';
  try {
    const response = await fetch(amazonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7',
        'Cache-Control': 'no-cache'
      }
    });
    if (!response.ok) throw new Error('Amazon returned HTTP ' + response.status);
    const html = await response.text();
    let items = parseJsonLd(html).concat(parseAsinBlocks(html));
    const seen = new Set();
    items = items.filter(x => {
      const key = (x.title || '').toLowerCase() + '|' + (x.isbn || '') + '|' + (x.asin || '');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 10);
    return Response.json({items, source:'Amazon.es'} , {
      headers: {'Cache-Control':'public, max-age=300'}
    });
  } catch (error) {
    return Response.json({items: [], source:'Amazon.es', error:String(error && error.message || error)}, {
      status: 200,
      headers: {'Cache-Control':'no-store'}
    });
  }
}
