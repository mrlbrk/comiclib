function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(url) {
  if (!url) return '';
  try {
    return new URL(url, 'https://www.amazon.es').toString();
  } catch (_) {
    return '';
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function parseJsonLd(html) {
  const results = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while ((match = regex.exec(html))) {
    try {
      const data = JSON.parse(match[1].trim());

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.itemListElement)
          ? data.itemListElement
          : [data];

      for (const item of items) {
        const product = item && item.item ? item.item : item;

        if (!product || typeof product !== 'object') continue;

        const title = firstNonEmpty(
          product.name,
          product.headline
        );

        if (!title) continue;

        const authors = [];

        if (product.author) {
          const authorList = Array.isArray(product.author)
            ? product.author
            : [product.author];

          for (const author of authorList) {
            const name =
              typeof author === 'object'
                ? author.name
                : author;

            if (cleanText(name)) {
              authors.push(cleanText(name));
            }
          }
        }

        results.push({
          title,
          subtitle: cleanText(product.description),
          authors,
          publisher: cleanText(
            product.publisher && product.publisher.name
              ? product.publisher.name
              : product.publisher
          ),
          isbn: cleanText(product.isbn),
          cover: absoluteUrl(product.image),
          url: absoluteUrl(product.url),
          price: cleanText(
            product.offers && product.offers.price
              ? product.offers.price
              : ''
          )
        });
      }
    } catch (_) {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return results;
}

function parseAsinBlocks(html) {
  const results = [];

  const regex =
    /data-asin=["']([A-Z0-9]{10})["'][^>]*>([\s\S]{0,12000}?)(?=data-asin=["']|$)/gi;

  let match;

  while ((match = regex.exec(html))) {
    const asin = match[1];
    const block = match[2];

    const titleMatch = block.match(
      /(?:class=["'][^"']*(?:a-text-normal|a-size-medium|a-size-base-plus)[^"']*["'][^>]*>)([\s\S]*?)<\/[^>]+>/i
    );

    const title = cleanText(
      titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, ' ')
        : ''
    );

    if (!title) continue;

    const imageMatch = block.match(
      /<img[^>]+(?:src|data-src)=["']([^"']+)["']/i
    );

    const hrefMatch = block.match(
      /<a[^>]+href=["']([^"']+)["']/i
    );

    const priceMatch = block.match(
      /class=["'][^"']*(?:a-price-whole|a-offscreen)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
    );

    results.push({
      title,
      isbn: '',
      cover: absoluteUrl(
        imageMatch ? imageMatch[1] : ''
      ),
      url: absoluteUrl(
        hrefMatch ? hrefMatch[1] : ''
      ),
      price: cleanText(
        priceMatch ? priceMatch[1] : ''
      ),
      asin
    });
  }

  return results;
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const query = cleanText(
    requestUrl.searchParams.get('q')
  );

  if (!query) {
    return Response.json(
      {
        items: [],
        error: 'Missing query'
      },
      { status: 400 }
    );
  }

  const amazonUrl =
    'https://www.amazon.es/s?k=' +
    encodeURIComponent(query) +
    '&i=stripbooks';

  try {
    const response = await fetch(amazonUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language':
          'es-ES,es;q=0.9,en;q=0.7',
        'Cache-Control':
          'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(
        'Amazon returned HTTP ' + response.status
      );
    }

    const html = await response.text();

    let items = [
      ...parseJsonLd(html),
      ...parseAsinBlocks(html)
    ];

    const seen = new Set();

    items = items
      .filter(item => {
        const key =
          (item.title || '').toLowerCase() +
          '|' +
          (item.isbn || '') +
          '|' +
          (item.asin || '');

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, 10);

    return Response.json(
      {
        items,
        source: 'Amazon.es'
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=300'
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        items: [],
        source: 'Amazon.es',
        error: String(
          error && error.message
            ? error.message
            : error
        )
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
