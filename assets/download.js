(() => {
  'use strict';

  const BLOB_FALLBACK_LIMIT = 512 * 1024 * 1024;

  const title = document.getElementById('title');
  const description = document.getElementById('description');
  const filePanel = document.getElementById('filePanel');
  const fileName = document.getElementById('fileName');
  const fileMeta = document.getElementById('fileMeta');
  const downloadBtn = document.getElementById('downloadBtn');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('status');
  const notice = document.getElementById('notice');

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const encodedKey = hash.get('k') || '';

  let remoteInfo = null;
  let manifest = null;
  let cryptoKey = null;

  function showError(message) {
    title.textContent = 'This transfer cannot be opened';
    description.textContent = message;
    filePanel.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    progressWrap.classList.add('hidden');
    notice.textContent = 'SendZero cannot recover a missing or incorrect decryption key.';
    notice.classList.remove('hidden');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KiB';
    if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MiB';
    return (bytes / 1024 ** 3).toFixed(2) + ' GiB';
  }

  function decodeBase64Url(value) {
    value = value.replace(/-/g, '+').replace(/_/g, '/');
    while (value.length % 4) value += '=';
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function uint32From(bytes, offset) {
    return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
  }

  async function postForm(url, values) {
    const form = new FormData();
    Object.keys(values).forEach(key => form.append(key, String(values[key])));
    const response = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
    let data = null;
    try { data = await response.json(); } catch (e) {}
    if (!response.ok || !data || !data.ok) {
      const error = new Error((data && data.error) || ('HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function decryptManifest(bytes) {
    if (bytes.length < 32) throw new Error('Invalid manifest');
    const magicBytes = bytes.slice(0, 4);
    const magic = new TextDecoder().decode(magicBytes);
    if (magic !== 'SZM2') throw new Error('Unsupported SendZero manifest');

    const iv = bytes.slice(4, 16);
    const cipher = bytes.slice(16);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: magicBytes },
      cryptoKey,
      cipher
    );

    return JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
  }

  async function decryptChunk(bytes, expectedIndex) {
    if (bytes.length < 36) throw new Error('Invalid encrypted chunk');
    const magic = new TextDecoder().decode(bytes.slice(0, 4));
    if (magic !== 'SZC2') throw new Error('Unsupported encrypted chunk');

    const index = uint32From(bytes, 4);
    if (index !== expectedIndex) throw new Error('Chunk order mismatch');

    const header = bytes.slice(0, 8);
    const iv = bytes.slice(8, 20);
    const cipher = bytes.slice(20);

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: header },
      cryptoKey,
      cipher
    );

    return new Uint8Array(plain);
  }

  async function loadInfo() {
    if (!/^[a-f0-9]{32}$/.test(id)) {
      showError('The transfer ID is invalid.');
      return;
    }

    if (!encodedKey) {
      showError('The decryption key is missing from the link.');
      return;
    }

    try {
      const keyBytes = decodeBase64Url(encodedKey);
      if (keyBytes.length !== 32) throw new Error('Invalid decryption key');
      cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);

      const infoResponse = await fetch('api/info.php?id=' + encodeURIComponent(id), { cache: 'no-store' });
      const info = await infoResponse.json();
      if (!infoResponse.ok || !info.ok) {
        if (infoResponse.status === 410) throw new Error('This transfer has expired.');
        throw new Error('This transfer no longer exists.');
      }
      remoteInfo = info;

      const manifestResponse = await fetch('api/manifest.php?id=' + encodeURIComponent(id), { cache: 'no-store' });
      if (!manifestResponse.ok) throw new Error('The encrypted manifest is unavailable.');
      manifest = await decryptManifest(new Uint8Array(await manifestResponse.arrayBuffer()));

      if (manifest.size !== info.file_size || manifest.chunk_count !== info.chunk_count) {
        throw new Error('Transfer metadata does not match.');
      }

      title.textContent = 'Encrypted file ready';
      description.textContent = info.once
        ? 'This is a one-time transfer. The server copy is removed after a completed download.'
        : 'The file will be decrypted chunk by chunk in this browser.';

      fileName.textContent = manifest.name || 'download';
      fileMeta.textContent =
        formatBytes(manifest.size) + ' · ' + info.chunk_count + ' encrypted chunks · expires ' +
        new Date(info.expires_at * 1000).toLocaleString();

      filePanel.classList.remove('hidden');
      downloadBtn.classList.remove('hidden');
    } catch (err) {
      showError(err.message || 'Could not open this transfer.');
    }
  }

  async function makeFileSystemSink() {
    if (!window.showSaveFilePicker) return null;

    const handle = await window.showSaveFilePicker({
      suggestedName: manifest.name || 'download'
    });
    const writable = await handle.createWritable();

    return {
      kind: 'filesystem',
      async start() {},
      async write(bytes) { await writable.write(bytes); },
      async close() { await writable.close(); },
      async abort() { try { await writable.abort(); } catch (e) {} }
    };
  }

  async function makeServiceWorkerSink() {
    if (!('serviceWorker' in navigator) || !window.ReadableStream || !window.MessageChannel) return null;

    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    const worker = reg.active || reg.waiting || reg.installing;
    if (!worker) return null;

    const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
    const streamToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const channel = new MessageChannel();
    const port = channel.port1;
    port.start();

    let waiter = null;
    const queue = [];
    port.onmessage = event => {
      if (waiter) {
        const w = waiter;
        waiter = null;
        w(event.data || {});
      } else {
        queue.push(event.data || {});
      }
    };

    function nextMessage() {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise(resolve => { waiter = resolve; });
    }

    worker.postMessage({
      type: 'prepare-download',
      token: streamToken,
      filename: manifest.name || 'download',
      mime: manifest.type || 'application/octet-stream',
      size: manifest.size
    }, [channel.port2]);

    const prepared = await nextMessage();
    if (prepared.type !== 'prepared') throw new Error('Streaming download could not be prepared.');

    return {
      kind: 'serviceworker',
      async start() {
        const iframe = document.createElement('iframe');
        iframe.hidden = true;
        iframe.src = './__sendzero_stream/' + streamToken;
        document.body.appendChild(iframe);
        const ready = await nextMessage();
        if (ready.type !== 'ready') throw new Error('Streaming download did not start.');
        this.iframe = iframe;
      },
      async write(bytes) {
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        port.postMessage({ type: 'chunk', data: buffer }, [buffer]);
        const ack = await nextMessage();
        if (ack.type !== 'chunk-accepted') throw new Error('Streaming download interrupted.');
      },
      async close() {
        port.postMessage({ type: 'end' });
        const ack = await nextMessage();
        if (ack.type !== 'closed') throw new Error('Streaming download did not close cleanly.');
        setTimeout(() => {
          if (this.iframe) this.iframe.remove();
          port.close();
        }, 15000);
      },
      async abort() {
        try { port.postMessage({ type: 'abort' }); } catch (e) {}
        if (this.iframe) this.iframe.remove();
        try { port.close(); } catch (e) {}
      }
    };
  }

  function makeBlobSink() {
    if (manifest.size > BLOB_FALLBACK_LIMIT) return null;
    const chunks = [];
    return {
      kind: 'blob',
      async start() {},
      async write(bytes) { chunks.push(bytes); },
      async close() {
        const blob = new Blob(chunks, { type: manifest.type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = manifest.name || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      async abort() { chunks.length = 0; }
    };
  }

  async function chooseSink() {
    try {
      const fsSink = await makeFileSystemSink();
      if (fsSink) return fsSink;
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
    }

    try {
      const swSink = await makeServiceWorkerSink();
      if (swSink) return swSink;
    } catch (err) {
      console.warn('Service worker streaming unavailable:', err);
    }

    const blobSink = makeBlobSink();
    if (blobSink) return blobSink;

    throw new Error('This browser cannot stream a file this large to disk. Use a current browser with File System Access or Service Worker streaming support.');
  }

  async function downloadAndDecrypt() {
    downloadBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '1%';
    status.textContent = 'Preparing local save…';

    let sink = null;
    let downloadToken = '';
    let sessionStarted = false;

    try {
      sink = await chooseSink();
      const session = await postForm('api/start.php', { id });
      downloadToken = session.token || '';
      sessionStarted = true;

      await sink.start();

      for (let index = 0; index < remoteInfo.chunk_count; index++) {
        const url = new URL('api/chunk_get.php', location.href);
        url.searchParams.set('id', id);
        url.searchParams.set('index', String(index));
        if (downloadToken) url.searchParams.set('token', downloadToken);

        const response = await fetch(url.toString(), { cache: 'no-store' });
        if (!response.ok) throw new Error('Chunk ' + (index + 1) + ' could not be downloaded.');

        const encrypted = new Uint8Array(await response.arrayBuffer());
        const plain = await decryptChunk(encrypted, index);
        await sink.write(plain);

        const pct = Math.max(1, Math.round(((index + 1) / remoteInfo.chunk_count) * 100));
        progressBar.style.width = pct + '%';
        status.textContent = 'Downloading & decrypting… ' + pct + '% · chunk ' + (index + 1) + '/' + remoteInfo.chunk_count;
      }

      await sink.close();
      await postForm('api/finish.php', { id, token: downloadToken });

      progressBar.style.width = '100%';
      status.textContent = 'Decrypted. Your file has been saved.';
      title.textContent = 'Transfer complete';
      description.textContent = remoteInfo.once
        ? 'The one-time encrypted server copy has been removed.'
        : 'The file was decrypted only in this browser.';
      downloadBtn.classList.add('hidden');
      fileName.textContent = manifest.name || 'download';
      fileMeta.textContent = formatBytes(manifest.size);
    } catch (err) {
      if (sink) {
        try { await sink.abort(); } catch (e) {}
      }
      if (sessionStarted && remoteInfo && remoteInfo.once && downloadToken) {
        try { await postForm('api/abort.php', { id, token: downloadToken }); } catch (e) {}
      }

      if (err && err.name === 'AbortError') {
        status.textContent = 'Save cancelled.';
      } else {
        status.textContent = 'Error: ' + (err.message || 'Download failed');
      }
      progressBar.style.width = '0%';
      downloadBtn.disabled = false;
    }
  }

  downloadBtn.addEventListener('click', downloadAndDecrypt);

  if (!window.crypto || !crypto.subtle) {
    showError('This browser does not support the Web Crypto API.');
  } else {
    loadInfo();
  }
})();
