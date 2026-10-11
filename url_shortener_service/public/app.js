/**
 * ShortPulse Frontend Logic
 * Full interactive experience: Token bucket tracking, QR codes, link history, analytics
 */

(function() {
  'use strict';

  // API Base - relative to current location
  const API_BASE = window.location.origin;

  // DOM Elements
  const urlInput = document.getElementById('url-input');
  const btnClearInput = document.getElementById('btn-clear-input');
  const btnPasteClipboard = document.getElementById('btn-paste-clipboard');
  const shortenForm = document.getElementById('shorten-form');
  const btnShortenSubmit = document.getElementById('btn-shorten-submit');
  const btnSpinner = document.getElementById('btn-spinner');

  const aliasToggleBtn = document.getElementById('alias-toggle-btn');
  const aliasDrawer = document.getElementById('alias-drawer');
  const customAliasInput = document.getElementById('custom-alias-input');
  const aliasDomainPrefix = document.getElementById('alias-domain-prefix');

  // Rate Limiter Elements
  const navTokensCount = document.getElementById('nav-tokens-count');
  const stripTokensNum = document.getElementById('strip-tokens-num');
  const openQuotaBtn = document.getElementById('open-quota-btn');
  const quotaModal = document.getElementById('quota-modal');
  const closeQuotaModal = document.getElementById('close-quota-modal');
  const modalTokensCount = document.getElementById('modal-tokens-count');
  const tokenSlotsContainer = document.getElementById('token-slots-container');
  const btnSimulateReq = document.getElementById('btn-simulate-req');

  // Result Card Elements
  const resultCard = document.getElementById('result-card');
  const resultShortUrl = document.getElementById('result-short-url');
  const resultOrigUrl = document.getElementById('result-orig-url');
  const resultTimestamp = document.getElementById('result-timestamp');
  const btnCopyShortUrl = document.getElementById('btn-copy-short-url');
  const copyText = document.getElementById('copy-text');
  const btnVisitUrl = document.getElementById('btn-visit-url');
  const btnToggleQr = document.getElementById('btn-toggle-qr');
  const toggleQrText = document.getElementById('toggle-qr-text');
  const qrDisplayContainer = document.getElementById('qr-display-container');
  const qrCodeElement = document.getElementById('qr-code-element');
  const btnDownloadQr = document.getElementById('btn-download-qr');
  const btnShareUrl = document.getElementById('btn-share-url');

  // QR Modal Elements
  const qrModal = document.getElementById('qr-modal');
  const closeQrModal = document.getElementById('close-qr-modal');
  const modalQrCanvasWrap = document.getElementById('modal-qr-canvas-wrap');
  const modalQrUrlText = document.getElementById('modal-qr-url-text');
  const modalDownloadQrBtn = document.getElementById('modal-download-qr-btn');

  // History & Metrics Elements
  const linksContainer = document.getElementById('links-container');
  const emptyState = document.getElementById('empty-state');
  const historyTotalBadge = document.getElementById('history-total-badge');
  const searchHistoryInput = document.getElementById('search-history-input');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Status Indicators
  const systemStatusBadge = document.getElementById('system-status-badge');
  const statusLabel = document.getElementById('status-label');
  const toastContainer = document.getElementById('toast-container');

  // State
  let currentTokens = 10;
  const CAPACITY = 10;
  let activeQrInstance = null;
  let activeModalQrInstance = null;
  let currentActiveShortUrl = '';
  let linksHistory = [];

  // Setup prefix on load
  const host = window.location.host || 'localhost:5000';
  aliasDomainPrefix.textContent = `${host}/`;

  /* ==========================================================================
     Toast Notifications
     ========================================================================== */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  /* ==========================================================================
     Token Bucket Telemetry & Visualization
     ========================================================================== */
  function updateTokenDisplay(tokens) {
    currentTokens = Math.max(0, Math.min(CAPACITY, Math.floor(tokens)));
    navTokensCount.textContent = currentTokens;
    stripTokensNum.textContent = currentTokens;
    modalTokensCount.textContent = currentTokens;

    // Render 10 visual token slots in modal
    tokenSlotsContainer.innerHTML = '';
    for (let i = 0; i < CAPACITY; i++) {
      const slot = document.createElement('div');
      slot.className = `token-slot-dot ${i < currentTokens ? 'filled' : 'empty'}`;
      slot.title = `Token ${i + 1}: ${i < currentTokens ? 'Ready' : 'Depleted'}`;
      tokenSlotsContainer.appendChild(slot);
    }
  }

  // Refill tokens by 1 every second up to 10
  setInterval(() => {
    if (currentTokens < CAPACITY) {
      updateTokenDisplay(currentTokens + 1);
    }
  }, 1000);

  async function fetchTokenStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/url/tokens`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.tokens === 'number') {
          updateTokenDisplay(data.tokens);
        }
      }
    } catch (e) {
      // Local counter will maintain fallback
    }
  }

  /* ==========================================================================
     Health & System Status
     ========================================================================== */
  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        statusLabel.textContent = data.database ? data.database : 'Online';
        systemStatusBadge.classList.remove('offline');
      } else {
        statusLabel.textContent = 'Degraded';
      }
    } catch (e) {
      statusLabel.textContent = 'Offline';
      systemStatusBadge.classList.add('offline');
    }
  }

  /* ==========================================================================
     Clipboard & Input Helpers
     ========================================================================== */
  urlInput.addEventListener('input', () => {
    btnClearInput.classList.toggle('hidden', urlInput.value.length === 0);
  });

  btnClearInput.addEventListener('click', () => {
    urlInput.value = '';
    btnClearInput.classList.add('hidden');
    urlInput.focus();
  });

  btnPasteClipboard.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          btnClearInput.classList.remove('hidden');
          showToast('URL pasted from clipboard!', 'success');
        }
      } else {
        urlInput.focus();
        showToast('Use Ctrl+V / Cmd+V to paste into the input.', 'info');
      }
    } catch (err) {
      urlInput.focus();
      showToast('Clipboard permission needed. Use Ctrl+V / Cmd+V.', 'info');
    }
  });

  aliasToggleBtn.addEventListener('click', () => {
    const isExpanded = aliasDrawer.classList.contains('hidden');
    aliasDrawer.classList.toggle('hidden');
    aliasToggleBtn.classList.toggle('open', isExpanded);
    aliasToggleBtn.setAttribute('aria-expanded', isExpanded);
    if (isExpanded) {
      customAliasInput.focus();
    }
  });

  /* ==========================================================================
     URL Shortening Form Submission
     ========================================================================== */
  shortenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawUrl = urlInput.value.trim();
    const customCode = customAliasInput.value.trim();

    if (!rawUrl) {
      showToast('Please enter a destination URL', 'error');
      return;
    }

    // Set UI Loading State
    btnShortenSubmit.disabled = true;
    btnSpinner.classList.remove('hidden');
    const originalBtnText = btnShortenSubmit.querySelector('.btn-text').textContent;
    btnShortenSubmit.querySelector('.btn-text').textContent = 'Shortening...';

    try {
      const payload = { longUrl: rawUrl };
      if (customCode) {
        payload.customCode = customCode;
      }

      const res = await fetch(`${API_BASE}/api/url/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Track Rate Limit Headers
      const limitRemaining = res.headers.get('X-RateLimit-Remaining');
      if (limitRemaining !== null) {
        updateTokenDisplay(parseInt(limitRemaining, 10));
      } else {
        updateTokenDisplay(currentTokens - 1);
      }

      if (res.status === 429) {
        showToast('⚡ Rate limit reached (Token Bucket empty)! Refilling in 1s...', 'error', 4500);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to shorten URL');
      }

      // Display Result
      displayShortenedResult(data);
      showToast('✨ Short link generated successfully!', 'success');

      // Update link history
      await addLinkToHistory(data);

      // Auto-scroll slightly to result card
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      showToast(err.message || 'Error communicating with server', 'error');
    } finally {
      btnShortenSubmit.disabled = false;
      btnSpinner.classList.add('hidden');
      btnShortenSubmit.querySelector('.btn-text').textContent = originalBtnText;
    }
  });

  /* ==========================================================================
     Display Shortened Result & QR Code
     ========================================================================== */
  function displayShortenedResult(urlData) {
    currentActiveShortUrl = urlData.shortUrl;
    resultShortUrl.textContent = urlData.shortUrl;
    resultOrigUrl.textContent = urlData.longUrl;
    resultOrigUrl.href = urlData.longUrl;
    btnVisitUrl.href = urlData.shortUrl;
    resultTimestamp.textContent = 'Just now';

    resultCard.classList.remove('hidden');

    // Pre-render QR Code
    if (window.QRCode) {
      qrCodeElement.innerHTML = '';
      activeQrInstance = new window.QRCode(qrCodeElement, {
        text: urlData.shortUrl,
        width: 130,
        height: 130,
        colorDark: '#080C14',
        colorLight: '#FFFFFF',
        correctLevel: 2
      });
    }

    // Reset copy button state
    btnCopyShortUrl.classList.remove('copied');
    copyText.textContent = 'Copy';
  }

  // Copy Short URL
  btnCopyShortUrl.addEventListener('click', async () => {
    if (!currentActiveShortUrl) return;
    try {
      await navigator.clipboard.writeText(currentActiveShortUrl);
      btnCopyShortUrl.classList.add('copied');
      copyText.textContent = 'Copied!';
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => {
        btnCopyShortUrl.classList.remove('copied');
        copyText.textContent = 'Copy';
      }, 2500);
    } catch (err) {
      showToast('Failed to copy. Please manually select and copy.', 'error');
    }
  });

  // Toggle QR Code Display
  btnToggleQr.addEventListener('click', () => {
    const isHidden = qrDisplayContainer.classList.contains('hidden');
    qrDisplayContainer.classList.toggle('hidden');
    toggleQrText.textContent = isHidden ? 'Hide QR Code' : 'Show QR Code';
  });

  // Download QR Code PNG
  btnDownloadQr.addEventListener('click', () => {
    downloadQrFromCanvas(qrCodeElement.querySelector('canvas'), 'shortpulse-qrcode.png');
  });

  function downloadQrFromCanvas(canvas, filename) {
    if (!canvas) {
      showToast('QR code not ready to download', 'error');
      return;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('QR code downloaded!', 'success');
  }

  // Share Short URL (Web Share API fallback to copy)
  btnShareUrl.addEventListener('click', async () => {
    if (!currentActiveShortUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ShortPulse Link',
          text: 'Here is your shortened link:',
          url: currentActiveShortUrl
        });
      } catch (e) {
        // user aborted or not supported
      }
    } else {
      await navigator.clipboard.writeText(currentActiveShortUrl);
      showToast('Share link copied to clipboard!', 'success');
    }
  });

  /* ==========================================================================
     Link History & Management
     ========================================================================== */
  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/url/recent`);
      if (res.ok) {
        const serverData = await res.json();
        // Merge with local storage
        const localData = getLocalLinks();
        const map = new Map();
        [...serverData, ...localData].forEach(item => {
          if (item && item.urlCode) {
            map.set(item.urlCode, item);
          }
        });
        linksHistory = Array.from(map.values());
      } else {
        linksHistory = getLocalLinks();
      }
    } catch (e) {
      linksHistory = getLocalLinks();
    }

    renderHistory(linksHistory);
  }

  function getLocalLinks() {
    try {
      return JSON.parse(localStorage.getItem('shortpulse_links') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveLocalLinks(links) {
    try {
      localStorage.setItem('shortpulse_links', JSON.stringify(links.slice(0, 50)));
    } catch (e) {}
  }

  async function addLinkToHistory(newLink) {
    linksHistory = [newLink, ...linksHistory.filter(l => l.urlCode !== newLink.urlCode)];
    saveLocalLinks(linksHistory);
    renderHistory(linksHistory);
  }

  function renderHistory(linksToRender) {
    linksContainer.innerHTML = '';
    const filtered = filterLinks(linksToRender, searchHistoryInput.value);

    historyTotalBadge.textContent = `${linksToRender.length} Link${linksToRender.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'link-row-card';
      card.id = `link-card-${item.urlCode}`;

      const dateStr = item.date ? formatRelativeTime(new Date(item.date)) : 'Recently';

      card.innerHTML = `
        <div class="link-info-col">
          <div class="link-urls-line">
            <a href="${item.shortUrl}" target="_blank" rel="noopener noreferrer" class="link-short-url">${item.shortUrl}</a>
            <span class="link-clicks-badge" title="Total clicks">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline></svg>
              <span>${item.clicks || 0} clicks</span>
            </span>
          </div>
          <a href="${item.longUrl}" target="_blank" rel="noopener noreferrer" class="link-long-url" title="${item.longUrl}">${item.longUrl}</a>
          <div class="link-meta-line">
            <span>Created ${dateStr}</span>
            <span>&bull;</span>
            <code>/${item.urlCode}</code>
          </div>
        </div>

        <div class="link-actions-col">
          <button type="button" class="action-icon-btn btn-copy-item" data-url="${item.shortUrl}" title="Copy short link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <button type="button" class="action-icon-btn btn-qr-item" data-url="${item.shortUrl}" title="View QR Code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          <button type="button" class="action-icon-btn btn-delete btn-delete-item" data-code="${item.urlCode}" title="Delete link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      // Event listeners for action buttons
      card.querySelector('.btn-copy-item').addEventListener('click', async (e) => {
        const u = e.currentTarget.getAttribute('data-url');
        await navigator.clipboard.writeText(u);
        showToast('Link copied to clipboard!', 'success');
      });

      card.querySelector('.btn-qr-item').addEventListener('click', (e) => {
        const u = e.currentTarget.getAttribute('data-url');
        openQrModal(u);
      });

      card.querySelector('.btn-delete-item').addEventListener('click', async (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        await deleteLink(code);
      });

      linksContainer.appendChild(card);
    });
  }

  function filterLinks(links, query) {
    if (!query) return links;
    const q = query.toLowerCase();
    return links.filter(l => 
      (l.urlCode && l.urlCode.toLowerCase().includes(q)) ||
      (l.shortUrl && l.shortUrl.toLowerCase().includes(q)) ||
      (l.longUrl && l.longUrl.toLowerCase().includes(q))
    );
  }

  searchHistoryInput.addEventListener('input', () => {
    renderHistory(linksHistory);
  });

  async function deleteLink(code) {
    if (!confirm(`Are you sure you want to delete short link /${code}?`)) return;

    try {
      await fetch(`${API_BASE}/api/url/${code}`, { method: 'DELETE' });
    } catch (e) {}

    linksHistory = linksHistory.filter(l => l.urlCode !== code);
    saveLocalLinks(linksHistory);
    renderHistory(linksHistory);
    showToast('Link deleted', 'info');
  }

  btnClearHistory.addEventListener('click', () => {
    if (linksHistory.length === 0) return;
    if (confirm('Clear local history list?')) {
      linksHistory = [];
      saveLocalLinks([]);
      renderHistory([]);
      showToast('History cleared', 'info');
    }
  });

  // Export Links to CSV
  btnExportCsv.addEventListener('click', () => {
    if (linksHistory.length === 0) {
      showToast('No links to export.', 'info');
      return;
    }

    const headers = ['URL Code', 'Short URL', 'Destination URL', 'Clicks', 'Date'];
    const rows = linksHistory.map(l => [
      `"${l.urlCode || ''}"`,
      `"${l.shortUrl || ''}"`,
      `"${l.longUrl || ''}"`,
      l.clicks || 0,
      `"${l.date || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shortpulse-links-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Exported links to CSV!', 'success');
  });

  /* ==========================================================================
     Modal Handlers
     ========================================================================== */
  // Open Token Bucket Quota Modal
  openQuotaBtn.addEventListener('click', () => {
    quotaModal.classList.remove('hidden');
    updateTokenDisplay(currentTokens);
  });

  closeQuotaModal.addEventListener('click', () => {
    quotaModal.classList.add('hidden');
  });

  quotaModal.addEventListener('click', (e) => {
    if (e.target === quotaModal) quotaModal.classList.add('hidden');
  });

  // Simulate Request in Modal
  btnSimulateReq.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/api/url/tokens`);
      updateTokenDisplay(Math.max(0, currentTokens - 1));
      showToast(`⚡ Consumed 1 Token! Tokens remaining: ${currentTokens}`, 'info');
    } catch (e) {
      updateTokenDisplay(Math.max(0, currentTokens - 1));
    }
  });

  // Open Dedicated QR Modal
  function openQrModal(url) {
    qrModal.classList.remove('hidden');
    modalQrUrlText.textContent = url;
    modalQrCanvasWrap.innerHTML = '';
    if (window.QRCode) {
      activeModalQrInstance = new window.QRCode(modalQrCanvasWrap, {
        text: url,
        width: 180,
        height: 180,
        colorDark: '#080C14',
        colorLight: '#FFFFFF',
        correctLevel: 2
      });
    }
  }

  closeQrModal.addEventListener('click', () => {
    qrModal.classList.add('hidden');
  });

  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.classList.add('hidden');
  });

  modalDownloadQrBtn.addEventListener('click', () => {
    downloadQrFromCanvas(modalQrCanvasWrap.querySelector('canvas'), 'shortpulse-qr.png');
  });

  // Keyboard accessibility: ESC closes open modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      quotaModal.classList.add('hidden');
      qrModal.classList.add('hidden');
    }
  });

  /* ==========================================================================
     Utilities
     ========================================================================== */
  function formatRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // Initialize on page load
  checkHealth();
  fetchTokenStatus();
  loadHistory();

  // Periodic health check
  setInterval(checkHealth, 15000);

})();
