(() => {
  'use strict';

  const MAX_BYTES = 5 * 1024 * 1024 * 1024;
  const t = (key, vars) => window.SendZeroI18n.t(key, vars);
  const RESUME_STORAGE_KEY = 'sendzero_upload_sessions_v1';
  const LOCAL_SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

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
  let selectedFingerprint = null;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KiB';
    if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MiB';
    return (bytes / 1024 ** 3).toFixed(2) + ' GiB';
  }

  function hex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function base64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeBase64Url(value) {
    value = value.replace(/-/g, '+').replace(/_/g, '/');
    while (value.length % 4) value += '=';
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
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

  function loadSessions() {
    try {
      const data = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || '{}');
      const now = Date.now();
      let changed = false;

      Object.keys(data).forEach(key => {
        if (!data[key] || !data[key].saved_at || now - data[key].saved_at > LOCAL_SESSION_MAX_AGE) {
          delete data[key];
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(data));
      }

      return data;
    } catch (e) {
      return {};
    }
  }

  function getSession(fingerprint) {
    if (!fingerprint) return null;
    const sessions = loadSessions();
    return sessions[fingerprint] || null;
  }

  function saveSession(fingerprint, session) {
    const sessions = loadSessions();
    session.saved_at = Date.now();
    sessions[fingerprint] = session;
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(sessions));
  }

  function removeSession(fingerprint) {
    if (!fingerprint) return;
    const sessions = loadSessions();
    delete sessions[fingerprint];
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(sessions));
  }

  async function fingerprintFile(file) {
    const sampleSize = 64 * 1024;
    const positions = [
      0,
      Math.max(0, Math.floor(file.size / 2) - Math.floor(sampleSize / 2)),
      Math.max(0, file.size - sampleSize)
    ];

    const unique = [];
    positions.forEach(pos => {
      if (unique.indexOf(pos) === -1) unique.push(pos);
    });

    const parts = [
      new TextEncoder().encode(JSON.stringify({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified
      }))
    ];

    for (const pos of unique) {
      const end = Math.min(file.size, pos + sampleSize);
      parts.push(new Uint8Array(await file.slice(pos, end).arrayBuffer()));
    }

    const digest = await crypto.subtle.digest('SHA-256', concat(parts));
    return hex(new Uint8Array(digest));
  }

  function syncTtlPicker() {
    document.querySelectorAll('[data-ttl]').forEach(button => {
      const active = button.getAttribute('data-ttl') === String(ttl.value);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function setFile(file) {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      selectedFile = null;
      selectedFingerprint = null;
      sendBtn.disabled = true;
      sendBtn.textContent = t('encrypt_upload');
      dropTitle.textContent = t('file_too_large');
      dropText.textContent = t('max_size');
      return;
    }

    selectedFile = file;
    selectedFingerprint = null;
    sendBtn.disabled = true;
    sendBtn.textContent = t('checking_file');
    dropTitle.textContent = file.name;
    dropText.textContent = formatBytes(file.size) + ' · ' + t('checking_interrupted');

    try {
      selectedFingerprint = await fingerprintFile(file);
      const session = getSession(selectedFingerprint);

      if (session && session.file_size === file.size && session.last_modified === file.lastModified) {
        ttl.value = String(session.ttl);
        once.checked = !!session.once;
        syncTtlPicker();
        sendBtn.textContent = t('resume_upload');
        dropText.textContent = formatBytes(file.size) + ' · ' + t('interrupted_upload_found');
      } else {
        sendBtn.textContent = t('encrypt_upload');
        dropText.textContent = formatBytes(file.size);
      }

      sendBtn.disabled = false;
    } catch (err) {
      selectedFile = null;
      sendBtn.disabled = true;
      sendBtn.textContent = t('encrypt_upload');
      dropText.textContent = t('could_not_prepare');
    }
  }

  function apiErrorMessage(code) {
    const keys = {
      too_many_transfers: 'error_too_many_transfers',
      daily_transfer_limit: 'error_daily_transfer_limit',
      too_many_active_uploads: 'error_too_many_active_uploads',
      node_insufficient_space: 'error_node_insufficient_space',
      no_storage_node_available: 'error_no_storage_node',
      rate_limit_unavailable: 'error_service_busy',
      rate_limit_busy: 'error_service_busy'
    };

    return keys[code] ? t(keys[code]) : code;
  }

  async function postForm(url, values, fileBlob) {
    const form = new FormData();
    Object.keys(values).forEach(key => form.append(key, String(values[key])));
    if (fileBlob) form.append('payload', fileBlob, 'payload.bin');

    const response = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
    let data = null;
    try { data = await response.json(); } catch (e) {}

    if (!response.ok || !data || !data.ok) {
      const code = data && data.error ? data.error : null;
      const err = new Error(code ? apiErrorMessage(code) : ('HTTP ' + response.status));
      err.status = response.status;
      err.code = code;
      err.retryAfter = data && data.retry_after ? Number(data.retry_after) : 0;
      throw err;
    }

    return data;
  }

  function apiUrl(base, path) {
    if (!base) return path;
    return new URL(path, String(base).replace(/\/+$/, '') + '/').toString();
  }

  async function resolveNode(nodeId) {
    const response = await fetch('api/node.php?n=' + encodeURIComponent(nodeId), {
      cache: 'no-store'
    });

    let data = null;
    try { data = await response.json(); } catch (e) {}

    if (!response.ok || !data || !data.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + response.status));
      err.status = response.status;
      throw err;
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

        if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
          break;
        }

        if (n + 1 < attempts) {
          await new Promise(resolve => setTimeout(resolve, 700 * (n + 1)));
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

  function plainChunkSize(fileSize, chunkSize, index) {
    const start = index * chunkSize;
    return Math.max(0, Math.min(chunkSize, fileSize - start));
  }

  async function createNewSession() {
    let lastError = null;
    const allocationRequestId = hex(crypto.getRandomValues(new Uint8Array(16)));

    /*
     * Allocation and init are intentionally separate. If a node disappears
     * after the master's health check but before init.php, request a fresh
     * allocation so another healthy child can take the transfer.
     */
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const allocation = await postForm('api/allocate.php', {
          file_size: selectedFile.size,
          ttl: ttl.value,
          once: once.checked ? '1' : '0',
          request_id: allocationRequestId
        });

        const init = await postForm(apiUrl(allocation.api_base, 'api/init.php'), {
          file_size: selectedFile.size,
          ttl: ttl.value,
          once: once.checked ? '1' : '0',
          allocation: allocation.allocation_token
        });

        const keyBytes = crypto.getRandomValues(new Uint8Array(32));

        const session = {
          id: init.id,
          node_id: allocation.node_id,
          api_base: allocation.api_base || '',
          upload_token: init.upload_token,
          key: base64Url(keyBytes),
          chunk_size: init.chunk_size,
          chunk_count: init.chunk_count,
          file_size: selectedFile.size,
          last_modified: selectedFile.lastModified,
          ttl: Number(ttl.value),
          once: once.checked
        };

        saveSession(selectedFingerprint, session);

        return {
          session,
          keyBytes,
          uploadedChunks: [],
          manifestUploaded: false,
          resumed: false
        };
      } catch (err) {
        lastError = err;

        /*
         * Do not route around client-side abuse limits. Retry only failures
         * where another node may genuinely help (5xx/network errors).
         */
        if (err && err.status >= 400 && err.status < 500) {
          break;
        }

        if (attempt + 1 < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('No storage node available');
  }

  async function resumeExistingSession(session) {
    try {
      const nodeId = session.node_id || 'local';
      const resolved = await resolveNode(nodeId);
      session.node_id = resolved.node_id;
      session.api_base = resolved.api_base || '';

      const state = await postForm(apiUrl(session.api_base, 'api/resume.php'), {
        id: session.id,
        token: session.upload_token
      });

      if (
        state.file_size !== selectedFile.size ||
        state.chunk_size !== session.chunk_size ||
        state.chunk_count !== session.chunk_count
      ) {
        removeSession(selectedFingerprint);
        return null;
      }

      session.ttl = state.retention_ttl;
      session.once = !!state.once;
      saveSession(selectedFingerprint, session);

      return {
        session,
        keyBytes: decodeBase64Url(session.key),
        uploadedChunks: state.uploaded_chunks || [],
        manifestUploaded: !!state.manifest_uploaded,
        resumed: true
      };
    } catch (err) {
      if ([403, 404, 409, 410].indexOf(err.status) !== -1) {
        removeSession(selectedFingerprint);
        return null;
      }
      throw err;
    }
  }

  async function getUploadContext() {
    const stored = getSession(selectedFingerprint);

    if (stored && stored.file_size === selectedFile.size && stored.last_modified === selectedFile.lastModified) {
      const resumed = await resumeExistingSession(stored);
      if (resumed) return resumed;

      status.textContent = t('previous_upload_expired');
    }

    return createNewSession();
  }

  async function runUpload() {
    if (!selectedFile || !selectedFingerprint || !window.crypto || !crypto.subtle) return;

    sendBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '1%';
    status.textContent = t('preparing_transfer');

    try {
      const context = await getUploadContext();
      const session = context.session;

      if (context.keyBytes.length !== 32) {
        removeSession(selectedFingerprint);
        throw new Error(t('saved_key_invalid'));
      }

      const key = await crypto.subtle.importKey(
        'raw',
        context.keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const uploadedSet = new Set(context.uploadedChunks.map(Number));
      let uploadedBytes = 0;

      uploadedSet.forEach(index => {
        uploadedBytes += plainChunkSize(selectedFile.size, session.chunk_size, index);
      });

      if (context.resumed) {
        const resumePct = Math.max(1, Math.min(98, Math.round((uploadedBytes / selectedFile.size) * 98)));
        progressBar.style.width = resumePct + '%';
        status.textContent = t('resuming_upload_existing', {
          done: uploadedSet.size,
          total: session.chunk_count
        });
      }

      if (!context.manifestUploaded) {
        const manifest = await encryptManifest(key, selectedFile, session.chunk_size, session.chunk_count);
        await uploadWithRetry(apiUrl(session.api_base, 'api/manifest_upload.php'), {
          id: session.id,
          token: session.upload_token
        }, manifest);
      }

      for (let index = 0; index < session.chunk_count; index++) {
        if (uploadedSet.has(index)) {
          continue;
        }

        const start = index * session.chunk_size;
        const end = Math.min(selectedFile.size, start + session.chunk_size);
        const plainBuffer = await selectedFile.slice(start, end).arrayBuffer();
        const encryptedChunk = await encryptChunk(key, index, plainBuffer);

        await uploadWithRetry(apiUrl(session.api_base, 'api/chunk.php'), {
          id: session.id,
          token: session.upload_token,
          index
        }, encryptedChunk);

        uploadedSet.add(index);
        uploadedBytes += end - start;

        const pct = Math.max(1, Math.min(98, Math.round((uploadedBytes / selectedFile.size) * 98)));
        progressBar.style.width = pct + '%';
        status.textContent = t('uploading_progress', {
          mode: context.resumed ? t('mode_resuming') : t('mode_uploading'),
          pct,
          done: uploadedSet.size,
          total: session.chunk_count
        });
      }

      status.textContent = t('finalizing_transfer');

      const complete = await postForm(apiUrl(session.api_base, 'api/complete.php'), {
        id: session.id,
        token: session.upload_token
      });

      progressBar.style.width = '100%';

      const base = new URL('download.html', window.location.href);
      base.search =
        '?n=' + encodeURIComponent(session.node_id) +
        '&id=' + encodeURIComponent(session.id);
      base.hash = 'k=' + session.key;
      shareUrl.value = base.toString();

      const expiry = new Date(complete.expires_at * 1000);
      resultMeta.textContent =
        formatBytes(selectedFile.size) + ' · ' +
        t('expires', { date: expiry.toLocaleString() }) +
        (complete.once ? ' · ' + t('one_time_enabled') : '');

      removeSession(selectedFingerprint);

      uploadCard.classList.add('hidden');
      resultCard.classList.remove('hidden');
    } catch (err) {
      sendBtn.disabled = false;
      sendBtn.textContent = getSession(selectedFingerprint) ? t('resume_upload') : t('encrypt_upload');

      const session = getSession(selectedFingerprint);
      if (session) {
        status.textContent = t('upload_paused', { error: err.message });
      } else {
        status.textContent = t('error', { error: err.message });
      }
    }
  }

  document.querySelectorAll('[data-ttl]').forEach(button => {
    button.addEventListener('click', () => {
      ttl.value = button.getAttribute('data-ttl');
      syncTtlPicker();
    });
  });

  syncTtlPicker();

  window.addEventListener('sendzero:languagechange', () => {
    syncTtlPicker();
    if (selectedFile && !sendBtn.disabled) {
      setFile(selectedFile);
    }
  });

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
      copyBtn.textContent = t('copied');
      setTimeout(() => copyBtn.textContent = t('copy'), 1400);
    } catch (e) {
      shareUrl.select();
      document.execCommand('copy');
    }
  });

  newBtn.addEventListener('click', () => window.location.reload());
})();
