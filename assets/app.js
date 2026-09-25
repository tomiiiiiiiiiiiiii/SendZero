(() => {
  'use strict';

  const MAX_BYTES = 5 * 1024 * 1024 * 1024;

  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const dropTitle = document.getElementById('dropTitle');
  const dropText = document.getElementById('dropText');
  const sendBtn = document.getElementById('sendBtn');
  const ttl = document.getElementById('ttl');
  const once = document.getElementById('once');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('status');
  const uploadCard = document.getElementById('uploadCard');
  const resultCard = document.getElementById('resultCard');
  const shareUrl = document.getElementById('shareUrl');
  const copyBtn = document.getElementById('copyBtn');
  const newBtn = document.getElementById('newBtn');
  const resultMeta = document.getElementById('resultMeta');

  let selectedFile = null;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KiB';
    if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MiB';
    return (bytes / 1024 ** 3).toFixed(2) + ' GiB';
  }

  function setFile(file) {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      selectedFile = null;
      sendBtn.disabled = true;
      dropTitle.textContent = 'File is too large';
      dropText.textContent = 'Maximum size is 5 GiB.';
      return;
    }

    selectedFile = file;
    sendBtn.disabled = false;
    dropTitle.textContent = file.name;
    dropText.textContent = formatBytes(file.size);
  }

  function base64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function uint32be(n) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, n, false);
    return out;
  }

  function concat(parts) {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach(p => {
      out.set(p, offset);
      offset += p.length;
    });
    return out;
  }

  async function postForm(url, values, fileBlob) {
    const form = new FormData();
    Object.keys(values).forEach(key => form.append(key, String(values[key])));
    if (fileBlob) form.append('payload', fileBlob, 'payload.bin');

    const response = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
    let data = null;
    try { data = await response.json(); } catch (e) {}
    if (!response.ok || !data || !data.ok) {
      throw new Error((data && data.error) || ('HTTP ' + response.status));
    }
    return data;
  }

  async function uploadWithRetry(url, values, blob, attempts = 3) {
    let lastError = null;
    for (let n = 0; n < attempts; n++) {
      try {
        return await postForm(url, values, blob);
      } catch (err) {
        lastError = err;
        if (n + 1 < attempts) {
          await new Promise(resolve => setTimeout(resolve, 600 * (n + 1)));
        }
      }
    }
    throw lastError;
  }

  async function encryptManifest(key, file, chunkSize, chunkCount) {
    const meta = new TextEncoder().encode(JSON.stringify({
      version: 2,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      chunk_size: chunkSize,
      chunk_count: chunkCount
    }));

    const magic = new TextEncoder().encode('SZM2');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: magic },
      key,
      meta
    ));

    return new Blob([magic, iv, cipher], { type: 'application/octet-stream' });
  }

  async function encryptChunk(key, index, plainBuffer) {
    const magic = new TextEncoder().encode('SZC2');
    const indexBytes = uint32be(index);
    const header = concat([magic, indexBytes]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: header },
      key,
      plainBuffer
    ));

    return new Blob([header, iv, cipher], { type: 'application/octet-stream' });
  }

  async function runUpload() {
    if (!selectedFile || !window.crypto || !crypto.subtle) return;

    sendBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '1%';
    status.textContent = 'Creating encrypted transfer…';

    try {
      const init = await postForm('api/init.php', {
        file_size: selectedFile.size,
        ttl: ttl.value,
        once: once.checked ? '1' : '0'
      });

      const keyBytes = crypto.getRandomValues(new Uint8Array(32));
      const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);

      const manifest = await encryptManifest(key, selectedFile, init.chunk_size, init.chunk_count);
      await uploadWithRetry('api/manifest_upload.php', {
        id: init.id,
        token: init.upload_token
      }, manifest);

      for (let index = 0; index < init.chunk_count; index++) {
        const start = index * init.chunk_size;
        const end = Math.min(selectedFile.size, start + init.chunk_size);
        const plainBuffer = await selectedFile.slice(start, end).arrayBuffer();
        const encryptedChunk = await encryptChunk(key, index, plainBuffer);

        await uploadWithRetry('api/chunk.php', {
          id: init.id,
          token: init.upload_token,
          index
        }, encryptedChunk);

        const done = end;
        const pct = Math.max(1, Math.min(98, Math.round((done / selectedFile.size) * 98)));
        progressBar.style.width = pct + '%';
        status.textContent = 'Encrypting & uploading… ' + pct + '% · chunk ' + (index + 1) + '/' + init.chunk_count;
      }

      status.textContent = 'Finalizing transfer…';
      const complete = await postForm('api/complete.php', {
        id: init.id,
        token: init.upload_token
      });

      progressBar.style.width = '100%';

      const base = new URL('download.html', window.location.href);
      base.search = '?id=' + encodeURIComponent(init.id);
      base.hash = 'k=' + base64Url(keyBytes);
      shareUrl.value = base.toString();

      const expiry = new Date(complete.expires_at * 1000);
      resultMeta.textContent =
        formatBytes(selectedFile.size) + ' · expires ' + expiry.toLocaleString() +
        (complete.once ? ' · one-time download enabled' : '');

      uploadCard.classList.add('hidden');
      resultCard.classList.remove('hidden');
    } catch (err) {
      sendBtn.disabled = false;
      progressBar.style.width = '0%';
      status.textContent = 'Error: ' + err.message;
    }
  }

  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach(type => {
    dropzone.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.add('drag');
    });
  });

  ['dragleave', 'drop'].forEach(type => {
    dropzone.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.remove('drag');
    });
  });

  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    setFile(file);
  });

  sendBtn.addEventListener('click', runUpload);

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      copyBtn.textContent = 'Copied';
      setTimeout(() => copyBtn.textContent = 'Copy', 1400);
    } catch (e) {
      shareUrl.select();
      document.execCommand('copy');
    }
  });

  newBtn.addEventListener('click', () => window.location.reload());
})();
