function normalizeISBN(value) {
  const s = String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^(978|979)\d{10}$/.test(s)) return s;
  return s;
}

function pickGoogleCover(info) {
  const links = (info && info.imageLinks) || {};
  return links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail || '';
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (_) {
    return null;
  }
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const isbn = normalizeISBN(url.searchParams.get('isbn'));

  if (!/^(978|979)\d{10}$/.test(isbn)) {
    return new Response('Invalid ISBN', { status: 400 });
  }

  // Google Books first: it is the primary metadata/cover source used by the app.
  try {
    const api = await fetch(
      'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn) + '&maxResults=5',
      { headers: { Accept: 'application/json' } }
    );
    if (api.ok) {
      const data = await api.json();
      const items = data.items || [];
      const exact = items.find(item => {
        const ids = ((item.volumeInfo || {}).industryIdentifiers || []);
        return ids.some(id => normalizeISBN(id.identifier) === isbn);
      });
      const item = exact || items[0];
      const info = item && item.volumeInfo;

      if (item && item.id) {
        const contentUrl =
          'https://books.google.com/books/content?id=' + encodeURIComponent(item.id) +
          '&printsec=frontcover&img=1&zoom=2&source=gbs_api';
        const image = await fetchImage(contentUrl);
        if (image) return image;
      }

      const googleCover = pickGoogleCover(info).replace(/^http:\/\//, 'https://');
      const image = await fetchImage(googleCover);
      if (image) return image;
    }
  } catch (_) {}

  // Open Library fallback.
  try {
    const ol = await fetch('https://openlibrary.org/isbn/' + encodeURIComponent(isbn) + '.json', {
      headers: { Accept: 'application/json' }
    });
    if (ol.ok) {
      const data = await ol.json();
      if (data.covers && data.covers[0]) {
        const image = await fetchImage(
          'https://covers.openlibrary.org/b/id/' + data.covers[0] + '-L.jpg'
        );
        if (image) return image;
      }
    }
  } catch (_) {}

  return new Response('Cover not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' }
  });
}
