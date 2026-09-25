(() => {
  'use strict';

  const BLOB_FALLBACK_LIMIT = 512 * 1024 * 1024;
  const RESUME_DB_NAME = 'sendzero';
  const RESUME_DB_VERSION = 1;
  const RESUME_STORE = 'downloads';

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
  let keyFingerprint = null;
  let resumeState = null;

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

  function hex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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

  async function fingerprintKey(keyBytes) {
    const digest = await crypto.subtle.digest('SHA-256', keyBytes);
    return hex(new Uint8Array(digest));
  }

  function openResumeDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }

      const request = indexedDB.open(RESUME_DB_NAME, RESUME_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RESUME_STORE)) {
          db.createObjectStore(RESUME_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB error'));
    });
  }

  async function getDownloadState(transferId) {
    try {
      const db = await openResumeDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(RESUME_STORE, 'readonly');
        const request = tx.objectStore(RESUME_STORE).get(transferId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
    } catch (e) {
      return null;
    }
  }

  async function saveDownloadState(state) {
    try {
      state.updated_at = Date.now();
      const db = await openResumeDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(RESUME_STORE, 'readwrite');
        tx.objectStore(RESUME_STORE).put(state);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn('Could not persist download resume state:', e);
    }
  }

  async function deleteDownloadState(transferId) {
    try {
      const db = await openResumeDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(RESUME_STORE, 'readwrite');
        tx.objectStore(RESUME_STORE).delete(transferId);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    } catch (e) {}
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
      error.code = data && data.error ? data.error : null;
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

  function expectedBytesForIndex(nextIndex) {
    return Math.min(manifest.size, nextIndex * remoteInfo.chunk_size);
  }

  function stateMatchesTransfer(state) {
    return !!(
      state &&
      state.handle &&
      state.id === id &&
      state.key_fingerprint === keyFingerprint &&
      state.size === manifest.size &&
      state.chunk_size === remoteInfo.chunk_size &&
      state.chunk_count === remoteInfo.chunk_count &&
      Number.isInteger(state.next_index) &&
      state.next_index >= 0 &&
      state.next_index <= remoteInfo.chunk_count &&
      Number.isFinite(state.bytes_written) &&
      state.bytes_written >= 0 &&
      state.bytes_written <= manifest.size &&
      state.bytes_written === expectedBytesForIndex(state.next_index)
    );
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

      keyFingerprint = await fingerprintKey(keyBytes);
      cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const infoResponse = await fetch('api/info.php?id=' + encodeURIComponent(id), { cache: 'no-store' });
      const info = await infoResponse.json();

      if (!infoResponse.ok || !info.ok) {
        if (infoResponse.status === 410 || infoResponse.status === 404) {
          await deleteDownloadState(id);
        }
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

      const stored = await getDownloadState(id);
      if (stateMatchesTransfer(stored) && stored.next_index > 0) {
        resumeState = stored;

        const pct = Math.floor((stored.next_index / remoteInfo.chunk_count) * 100);
        title.textContent = 'Interrupted download found';
        description.textContent =
          'SendZero can continue writing to the same local file from the last verified encrypted chunk.';
        downloadBtn.textContent = 'Resume download';
        fileMeta.textContent =
          formatBytes(manifest.size) + ' · ' + pct + '% already saved · next chunk ' +
          (stored.next_index + 1) + '/' + remoteInfo.chunk_count;
      } else {
        if (stored) await deleteDownloadState(id);
        resumeState = null;

        title.textContent = 'Encrypted file ready';
        description.textContent = info.once
          ? 'This is a one-time transfer. The server copy is removed after a completed download.'
          : 'The file will be decrypted chunk by chunk in this browser.';

        downloadBtn.textContent = 'Decrypt & save';
        fileMeta.textContent =
          formatBytes(manifest.size) + ' · ' + info.chunk_count + ' encrypted chunks · expires ' +
          new Date(info.expires_at * 1000).toLocaleString();
      }

      fileName.textContent = manifest.name || 'download';
      filePanel.classList.remove('hidden');
      downloadBtn.classList.remove('hidden');
    } catch (err) {
      showError(err.message || 'Could not open this transfer.');
    }
  }

  async function requestHandlePermission(handle) {
    const options = { mode: 'readwrite' };

    if (handle.queryPermission) {
      const current = await handle.queryPermission(options);
      if (current === 'granted') return true;
    }

    if (handle.requestPermission) {
      return (await handle.requestPermission(options)) === 'granted';
    }

    return true;
  }

  async function makeFileSystemSink(existingState) {
    if (!window.showSaveFilePicker) return null;

    let handle = existingState && existingState.handle ? existingState.handle : null;
    let state = existingState || null;
    let writable = null;

    if (handle) {
      const granted = await requestHandlePermission(handle);
      if (!granted) {
        const err = new Error('Permission to the partial local file is required to resume.');
        err.name = 'ResumePermissionError';
        throw err;
      }

      const partialFile = await handle.getFile();
      if (partialFile.size < state.bytes_written) {
        const err = new Error(
          'The partial local file is shorter than the last verified checkpoint.'
        );
        err.name = 'ResumeFileMismatchError';
        throw err;
      }

      writable = await handle.createWritable({ keepExistingData: true });

      /*
       * If the browser died after writing a chunk but before IndexedDB was
       * updated, discard any unconfirmed tail before continuing.
       */
      await writable.truncate(state.bytes_written);
      await writable.seek(state.bytes_written);
    } else {
      handle = await window.showSaveFilePicker({
        suggestedName: manifest.name || 'download'
      });
      writable = await handle.createWritable();

      state = {
        id,
        handle,
        key_fingerprint: keyFingerprint,
        size: manifest.size,
        chunk_size: remoteInfo.chunk_size,
        chunk_count: remoteInfo.chunk_count,
        next_index: 0,
        bytes_written: 0,
        download_token: '',
        once: !!remoteInfo.once
      };

      await saveDownloadState(state);
    }

    return {
      kind: 'filesystem',
      resumable: true,
      state,
      startIndex: state.next_index,
      async start() {},
      async write(bytes) {
        await writable.write(bytes);
      },
      async checkpoint(nextIndex, bytesWritten, downloadToken) {
        state.next_index = nextIndex;
        state.bytes_written = bytesWritten;
        state.download_token = downloadToken || '';
        await saveDownloadState(state);
      },
      async close() {
        await writable.truncate(manifest.size);
        await writable.close();
      },
      async abort() {
        /*
         * Do not call writable.abort() here: it can roll back writes depending
         * on the browser. Closing preserves verified chunks for a later resume.
         */
        try { await writable.close(); } catch (e) {}
      }
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
      resumable: false,
      startIndex: 0,
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
      async checkpoint() {},
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
      resumable: false,
      startIndex: 0,
      async start() {},
      async write(bytes) {
        chunks.push(bytes);
      },
      async checkpoint() {},
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
      async abort() {
        chunks.length = 0;
      }
    };
  }

  async function chooseSink() {
    if (resumeState) {
      return makeFileSystemSink(resumeState);
    }

    try {
      const fsSink = await makeFileSystemSink(null);
      if (fsSink) return fsSink;
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      if (err && err.name === 'ResumePermissionError') throw err;
    }

    try {
      const swSink = await makeServiceWorkerSink();
      if (swSink) return swSink;
    } catch (err) {
      console.warn('Service worker streaming unavailable:', err);
    }

    const blobSink = makeBlobSink();
    if (blobSink) return blobSink;

    throw new Error(
      'This browser cannot stream a file this large to disk. ' +
      'Use a current browser with File System Access support.'
    );
  }

  async function downloadAndDecrypt() {
    downloadBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    status.textContent = resumeState ? 'Reopening partial local file…' : 'Preparing local save…';

    let sink = null;
    let downloadToken = '';
    let sessionStarted = false;

    try {
      sink = await chooseSink();

      const previousToken =
        sink.resumable && sink.state && sink.state.download_token
          ? sink.state.download_token
          : '';

      const session = await postForm('api/start.php', {
        id,
        token: previousToken
      });

      downloadToken = session.token || '';
      sessionStarted = true;
      let lastSessionRefresh = Date.now();

      if (sink.resumable) {
        await sink.checkpoint(
          sink.startIndex,
          sink.state.bytes_written,
          downloadToken
        );
      }

      await sink.start();

      let bytesWritten = sink.resumable ? sink.state.bytes_written : 0;
      const startIndex = sink.startIndex || 0;

      if (startIndex > 0) {
        const pct = Math.max(1, Math.floor((startIndex / remoteInfo.chunk_count) * 100));
        progressBar.style.width = pct + '%';
        status.textContent =
          'Resuming download… ' + pct + '% · chunk ' +
          (startIndex + 1) + '/' + remoteInfo.chunk_count;
      } else {
        progressBar.style.width = '1%';
      }

      for (let index = startIndex; index < remoteInfo.chunk_count; index++) {
        if (downloadToken && Date.now() - lastSessionRefresh > 20 * 60 * 1000) {
          const refreshed = await postForm('api/start.php', {
            id,
            token: downloadToken
          });

          downloadToken = refreshed.token || downloadToken;
          lastSessionRefresh = Date.now();

          if (sink.resumable) {
            await sink.checkpoint(index, bytesWritten, downloadToken);
          }
        }

        const url = new URL('api/chunk_get.php', location.href);
        url.searchParams.set('id', id);
        url.searchParams.set('index', String(index));

        if (downloadToken) {
          url.searchParams.set('token', downloadToken);
        }

        const response = await fetch(url.toString(), { cache: 'no-store' });

        if (!response.ok) {
          const err = new Error('Chunk ' + (index + 1) + ' could not be downloaded.');
          err.status = response.status;
          throw err;
        }

        const encrypted = new Uint8Array(await response.arrayBuffer());
        const plain = await decryptChunk(encrypted, index);

        await sink.write(plain);
        bytesWritten += plain.byteLength;

        /*
         * The checkpoint is written only after the decrypted chunk has been
         * successfully written. On resume, the local file is truncated to this
         * exact confirmed byte position before continuing.
         */
        await sink.checkpoint(index + 1, bytesWritten, downloadToken);

        const pct = Math.max(1, Math.round(((index + 1) / remoteInfo.chunk_count) * 100));
        progressBar.style.width = pct + '%';
        status.textContent =
          (startIndex > 0 ? 'Resuming' : 'Downloading & decrypting') +
          '… ' + pct + '% · chunk ' + (index + 1) + '/' + remoteInfo.chunk_count;
      }

      await sink.close();

      await postForm('api/finish.php', {
        id,
        token: downloadToken
      });

      if (sink.resumable) {
        await deleteDownloadState(id);
        resumeState = null;
      }

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

      /*
       * A File System Access download is intentionally NOT aborted server-side.
       * Its token and verified byte offset are kept so the same browser can
       * continue later. Non-resumable sinks release a one-time session.
       */
      if (
        sessionStarted &&
        remoteInfo &&
        remoteInfo.once &&
        downloadToken &&
        (!sink || !sink.resumable)
      ) {
        try {
          await postForm('api/abort.php', { id, token: downloadToken });
        } catch (e) {}
      }

      if (err && (err.status === 404 || err.status === 410)) {
        await deleteDownloadState(id);
        resumeState = null;
      } else if (sink && sink.resumable) {
        resumeState = await getDownloadState(id);
      }

      if (err && err.name === 'AbortError') {
        status.textContent = 'Save cancelled.';
      } else if (err && err.name === 'ResumePermissionError') {
        status.textContent = err.message;
      } else if (err && err.name === 'ResumeFileMismatchError') {
        await deleteDownloadState(id);
        resumeState = null;
        status.textContent =
          err.message + ' The saved resume state was cleared; start the download again.';
        downloadBtn.textContent = 'Start download again';
      } else if (sink && sink.resumable && resumeState && resumeState.next_index > 0) {
        const pct = Math.floor((resumeState.next_index / remoteInfo.chunk_count) * 100);
        status.textContent =
          'Download paused at ' + pct + '%. Open this link again and choose Resume download.';
        downloadBtn.textContent = 'Resume download';
      } else {
        status.textContent = 'Error: ' + (err.message || 'Download failed');
      }

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
