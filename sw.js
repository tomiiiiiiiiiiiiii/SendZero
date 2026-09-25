/* SendZero same-origin streaming download service worker. */
const downloads = new Map();

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function safeAsciiFilename(name) {
  return String(name || 'download')
    .replace(/[\\\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 160) || 'download';
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'prepare-download' || !data.token || !event.ports || !event.ports[0]) return;

  const port = event.ports[0];
  downloads.set(data.token, {
    port,
    filename: String(data.filename || 'download'),
    mime: String(data.mime || 'application/octet-stream'),
    size: Number(data.size || 0)
  });
  port.postMessage({ type: 'prepared' });
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const marker = '/__sendzero_stream/';
  const pos = url.pathname.lastIndexOf(marker);
  if (pos === -1) return;

  const token = url.pathname.slice(pos + marker.length);
  const item = downloads.get(token);
  if (!item) {
    event.respondWith(new Response('Download stream expired.', { status: 404 }));
    return;
  }

  downloads.delete(token);

  const stream = new ReadableStream({
    start(controller) {
      item.port.onmessage = messageEvent => {
        const msg = messageEvent.data || {};
        if (msg.type === 'chunk' && msg.data) {
          try {
            controller.enqueue(new Uint8Array(msg.data));
            item.port.postMessage({ type: 'chunk-accepted' });
          } catch (e) {
            try { controller.error(e); } catch (_) {}
          }
        } else if (msg.type === 'end') {
          try { controller.close(); } catch (e) {}
          item.port.postMessage({ type: 'closed' });
        } else if (msg.type === 'abort') {
          try { controller.error(new Error('Download aborted')); } catch (e) {}
        }
      };
      item.port.postMessage({ type: 'ready' });
    },
    cancel() {
      try { item.port.postMessage({ type: 'cancelled' }); } catch (e) {}
    }
  });

  const ascii = safeAsciiFilename(item.filename);
  const utf8 = encodeURIComponent(item.filename)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
  const headers = new Headers({
    'Content-Type': item.mime,
    'Content-Disposition': 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + utf8,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  if (item.size > 0) headers.set('Content-Length', String(item.size));

  event.respondWith(new Response(stream, { status: 200, headers }));
});
