(() => {
  // ---------- Auth: reuse the session established at /apps/ ----------
  // This page shares the same origin (rflabs.in) as /apps/, so the session
  // saved there in localStorage is readable here too — no second login
  // screen needed. If there's no valid session, send the person back to
  // /apps/ to log in before they can use any of this.
  const SESSION_KEY = 'rflabs_identity_session';

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  const session = loadSession();
  if (!session || !session.access_token) {
    window.location.href = '/apps/';
    return;
  }

  // Wraps fetch() to attach the logged-in user's token, so every call to
  // this tool's Netlify Functions can be verified server-side.
  async function authedFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers, {
      Authorization: 'Bearer ' + session.access_token,
    });
    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      // Session expired or invalid — clear it and send back to login.
      localStorage.removeItem(SESSION_KEY);
      window.location.href = '/apps/';
      throw new Error('Session expired');
    }
    return res;
  }

  const steps = {
    upload: document.getElementById('step-upload'),
    loading: document.getElementById('step-loading'),
    review: document.getElementById('step-review'),
    result: document.getElementById('step-result'),
  };
  const statusBadge = document.getElementById('statusBadge');

  function showStep(name) {
    Object.values(steps).forEach((el) => el.classList.remove('active'));
    steps[name].classList.add('active');
  }

  // ---------- Sidebar navigation ----------

  const navButtons = {
    intake: document.getElementById('navIntake'),
    payables: document.getElementById('navPayables'),
    receivables: document.getElementById('navReceivables'),
    topitems: document.getElementById('navTopItems'),
    turnover: document.getElementById('navTurnover'),
    lapsed: document.getElementById('navLapsed'),
  };
  const views = {
    intake: document.getElementById('view-intake'),
    payables: document.getElementById('view-payables'),
    receivables: document.getElementById('view-receivables'),
    topitems: document.getElementById('view-topitems'),
    turnover: document.getElementById('view-turnover'),
    lapsed: document.getElementById('view-lapsed'),
  };

  const loadedOnce = { payables: false, receivables: false, turnover: false, lapsed: false };

  Object.entries(navButtons).forEach(([key, btn]) => {
    btn.addEventListener('click', () => {
      Object.values(navButtons).forEach((b) => b.classList.remove('active'));
      Object.values(views).forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      views[key].classList.add('active');
      if (key === 'payables' && !loadedOnce.payables) {
        loadedOnce.payables = true;
        loadOutstanding('payables');
      }
      if (key === 'receivables' && !loadedOnce.receivables) {
        loadedOnce.receivables = true;
        loadOutstanding('receivables');
      }
      if (key === 'turnover' && !loadedOnce.turnover) {
        loadedOnce.turnover = true;
        loadTurnover();
      }
      if (key === 'lapsed' && !loadedOnce.lapsed) {
        loadedOnce.lapsed = true;
        loadLapsedClients();
      }
    });
  });

  document.getElementById('runTopItemsBtn').addEventListener('click', loadTopItems);

  async function loadTopItems() {
    const box = document.getElementById('topItemsContent');
    const range = document.getElementById('topItemsRange').value;
    box.innerHTML = '<p class="hint">Reading invoices in range… this can take a moment for longer ranges.</p>';
    try {
      const res = await authedFetch(`/.netlify/functions/get-top-items?range=${encodeURIComponent(range)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      renderTopItems(json);
    } catch (err) {
      box.innerHTML = `<p class="result-detail">Could not load this.<br/><code>${escapeHtml(err.message)}</code></p>`;
    }
  }

  function renderTopItems(data) {
    const box = document.getElementById('topItemsContent');

    if (!data.items || data.items.length === 0) {
      box.innerHTML = `<div class="dash-empty">No sales found in this range.</div>`;
      return;
    }

    const truncatedNote = data.truncated
      ? `<p class="hint">Showing results from the first ${data.invoicesProcessed} of ${data.totalInvoicesInRange} invoices in range (capped to keep this fast) — pick a shorter range for a complete picture.</p>`
      : `<p class="hint">Based on ${data.invoicesProcessed} invoice${data.invoicesProcessed === 1 ? '' : 's'} since ${data.sinceDate}.</p>`;

    const top = data.items[0];
    const summaryHtml = `
      <div class="dash-summary">
        <span class="dash-summary-label">Most sold item</span>
        <span class="dash-summary-value" style="font-size:20px;">${escapeHtml(top.name || 'Unnamed item')} — ${formatMoney(top.quantitySold)} units</span>
      </div>
    `;

    const rowsHtml = data.items
      .slice(0, 25)
      .map(
        (it, i) => `
        <div class="vendor-bill-line" style="padding:11px 4px;">
          <span class="bill-info">#${i + 1} ${escapeHtml(it.name || 'Unnamed item')}</span>
          <span class="bill-amount">${formatMoney(it.quantitySold)} units — ₹${formatMoney(it.totalAmount)}</span>
        </div>`
      )
      .join('');

    box.innerHTML = summaryHtml + truncatedNote + `<div class="vendor-row expanded"><div class="vendor-bills" style="display:block;">${rowsHtml}</div></div>`;
  }

  document.getElementById('refreshPayablesBtn').addEventListener('click', () => loadOutstanding('payables'));
  document.getElementById('refreshReceivablesBtn').addEventListener('click', () => loadOutstanding('receivables'));
  document.getElementById('printReceivablesBtn').addEventListener('click', () => window.print());

  const OUTSTANDING_CONFIG = {
    payables: {
      endpoint: '/.netlify/functions/get-overdue-payables',
      contentId: 'payablesContent',
      entityLabel: 'vendor',
      loadingText: 'Loading overdue bills…',
      docLabel: 'Bill',
    },
    receivables: {
      endpoint: '/.netlify/functions/get-overdue-receivables',
      contentId: 'receivablesContent',
      entityLabel: 'customer',
      loadingText: 'Loading overdue invoices…',
      docLabel: 'Invoice',
      printGeneratedAtId: 'receivablesPrintGeneratedAt',
    },
  };

  async function loadOutstanding(kind) {
    const cfg = OUTSTANDING_CONFIG[kind];
    const box = document.getElementById(cfg.contentId);
    box.innerHTML = `<p class="hint">${cfg.loadingText}</p>`;
    try {
      const res = await authedFetch(cfg.endpoint);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      renderOutstanding(cfg, json);
    } catch (err) {
      box.innerHTML = `<p class="result-detail">Could not load this. <br/><code>${escapeHtml(err.message)}</code></p>`;
    }
  }

  function formatMoney(n) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Fills a print-only "Generated <date>, <time>" line for a given element
  // id — shared by every dashboard view's "Save as PDF" print header.
  function renderGeneratedAt(elementId, generatedAt) {
    const el = document.getElementById(elementId);
    if (!el || !generatedAt) return;
    const generated = new Date(generatedAt);
    el.textContent = `Generated ${generated.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}, ${generated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  }

  function renderOutstanding(cfg, data) {
    const box = document.getElementById(cfg.contentId);

    if (cfg.printGeneratedAtId) renderGeneratedAt(cfg.printGeneratedAtId, data.generatedAt);

    if (!data.vendors || data.vendors.length === 0) {
      const diagHtml = data.diagnostic
        ? `<div class="warning-list"><p>Diagnostic (raw API check):</p><ul><li>${escapeHtml(
            JSON.stringify(data.diagnostic)
          )}</li></ul></div>`
        : '';
      box.innerHTML = `
        <div class="dash-summary">
          <span class="dash-summary-label">Total overdue</span>
          <span class="dash-summary-value">₹0.00</span>
        </div>
        <div class="dash-empty">Nothing overdue right now.</div>
        ${diagHtml}
      `;
      return;
    }

    const summaryHtml = `
      <div class="dash-summary">
        <span class="dash-summary-label">Total overdue across ${data.vendors.length} ${cfg.entityLabel}${data.vendors.length === 1 ? '' : 's'}</span>
        <span class="dash-summary-value">₹${formatMoney(data.grandTotal)}</span>
      </div>
    `;

    const rowsHtml = data.vendors
      .map((v, i) => {
        const billsHtml = v.bills
          .map(
            (b) => `
            <div class="vendor-bill-line">
              <span class="bill-info">${cfg.docLabel} ${escapeHtml(b.billNumber || '(no number)')} — due ${escapeHtml(b.dueDate || '')} — ${b.daysOverdue} day${b.daysOverdue === 1 ? '' : 's'} overdue</span>
              <span class="bill-amount">₹${formatMoney(b.balance)}</span>
            </div>`
          )
          .join('');

        return `
          <div class="vendor-row" id="${cfg.contentId}-row-${i}">
            <div class="vendor-row-head" data-index="${i}">
              <div>
                <div class="vendor-name">${escapeHtml(v.vendorName || 'Unknown')}</div>
                <div class="vendor-meta">${v.bills.length} overdue ${cfg.docLabel.toLowerCase()}${v.bills.length === 1 ? '' : 's'}</div>
              </div>
              <div class="vendor-amount">₹${formatMoney(v.totalOverdue)} <span class="vendor-caret">&#9656;</span></div>
            </div>
            <div class="vendor-bills">${billsHtml}</div>
          </div>
        `;
      })
      .join('');

    box.innerHTML = summaryHtml + rowsHtml;

    box.querySelectorAll('.vendor-row-head').forEach((head) => {
      head.addEventListener('click', () => {
        head.closest('.vendor-row').classList.toggle('expanded');
      });
    });
  }

  async function loadTurnover() {
    const box = document.getElementById('turnoverContent');
    box.innerHTML = '<p class="hint">Loading turnover…</p>';
    try {
      const res = await authedFetch('/.netlify/functions/get-turnover-report');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      renderTurnover(json);
    } catch (err) {
      box.innerHTML = `<p class="result-detail">Could not load this. <br/><code>${escapeHtml(err.message)}</code></p>`;
    }
  }

  function renderTurnover(data) {
    const box = document.getElementById('turnoverContent');

    const deltaHtml =
      data.percentChange === null
        ? ''
        : `<span class="turnover-delta ${data.percentChange >= 0 ? 'up' : 'down'}">${
            data.percentChange >= 0 ? '↑' : '↓'
          }${Math.abs(data.percentChange).toFixed(1)}%</span>`;

    const cardsHtml = `
      <div class="turnover-cards">
        <div class="dash-summary turnover-card">
          <span class="dash-summary-label">${escapeHtml(data.currentMonth.label)}</span>
          <span class="dash-summary-value">₹${formatMoney(data.currentMonth.total)}${deltaHtml}</span>
        </div>
        <div class="dash-summary turnover-card">
          <span class="dash-summary-label">Last 3 months (${escapeHtml(data.last3Months.label)})</span>
          <span class="dash-summary-value">₹${formatMoney(data.last3Months.total)}</span>
        </div>
      </div>
    `;

    box.innerHTML = cardsHtml + renderTurnoverChart(data.chartMonths);
    wireTurnoverTooltips(data.chartMonths);
  }

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // "Aug 25" — used only for the x-axis label under each bar; the shared
  // month `label` field (e.g. "Aug 2025") keeps its full year everywhere
  // else, including the tooltip.
  function shortMonthLabel(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    return `${MONTH_ABBR[month - 1]} ${String(year).slice(-2)}`;
  }

  // Lakh/crore shorthand for y-axis labels only — formatMoney (full rupee
  // figures) stays untouched everywhere else, including the tooltip.
  function formatAxisShort(n) {
    const value = Number(n || 0);
    const unit = (divided) => {
      const rounded = Math.round(divided * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    };
    if (value >= 10000000) return `₹${unit(value / 10000000)}Cr`;
    if (value >= 100000) return `₹${unit(value / 100000)}L`;
    if (value >= 1000) return `₹${unit(value / 1000)}K`;
    return `₹${Math.round(value)}`;
  }

  // Rounds a raw max value up to a "nice" round number for the axis ceiling
  // (e.g. 1/2/2.5/5/10 x a power of ten — so 437000 becomes 500000, not an
  // arbitrary raw max), so gridline labels read as clean amounts.
  function niceAxisMax(rawMax) {
    if (rawMax <= 0) return 100000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const step of steps) {
      const candidate = step * magnitude;
      if (candidate >= rawMax) return candidate;
    }
    return 10 * magnitude;
  }

  function renderTurnoverChart(months) {
    if (!months || months.length === 0) {
      return '<div class="dash-empty">No invoices found in this window.</div>';
    }

    const width = 720;
    const height = 220;
    const labelAreaHeight = 24;
    const yAxisWidth = 58;
    const barGap = 8;
    const barAreaTopPad = 10;

    const plotWidth = width - yAxisWidth;
    const barWidth = (plotWidth - barGap * (months.length - 1)) / months.length;
    const barAreaHeight = height - labelAreaHeight;

    const rawMax = Math.max(...months.map((m) => m.total), 0);
    const maxValue = niceAxisMax(rawMax);

    // Maps a turnover value onto the bar area's y-axis, shared by both the
    // bars and the gridlines so they line up exactly.
    const valueToY = (value) => barAreaHeight - (value / maxValue) * (barAreaHeight - barAreaTopPad);

    const gridLineCount = 4; // + the 0 baseline = 5 lines (baseline left unlabeled)
    const gridHtml = Array.from({ length: gridLineCount + 1 }, (_, g) => {
      const value = (maxValue / gridLineCount) * g;
      const y = valueToY(value);
      const labelHtml =
        g === 0
          ? ''
          : `<text x="${yAxisWidth - 8}" y="${y + 4}" text-anchor="end" class="turnover-axis-label">${escapeHtml(formatAxisShort(value))}</text>`;
      return `
        <line x1="${yAxisWidth}" y1="${y}" x2="${width}" y2="${y}" stroke="var(--hairline)" stroke-width="1" />
        ${labelHtml}
      `;
    }).join('');

    const bars = months
      .map((m, i) => {
        const y = valueToY(m.total);
        const barHeight = barAreaHeight - y;
        const x = yAxisWidth + i * (barWidth + barGap);
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="var(--mint)" rx="2"></rect>
          <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" class="turnover-chart-label">${escapeHtml(shortMonthLabel(m.yearMonth))}</text>
        `;
      })
      .join('');

    return `<svg class="turnover-chart" viewBox="0 0 ${width} ${height}" width="100%" height="220" role="img">${gridHtml}${bars}</svg>`;
  }

  function wireTurnoverTooltips(months) {
    const tooltip = document.getElementById('chartTooltip');
    const rects = document.querySelectorAll('#turnoverContent .turnover-chart rect');

    rects.forEach((rect, i) => {
      const m = months[i];
      const show = (e) => {
        tooltip.textContent = `${m.label} — ₹${formatMoney(m.total)}`;
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY - 28}px`;
        tooltip.style.display = 'block';
      };
      rect.addEventListener('mouseenter', show);
      rect.addEventListener('mousemove', show);
      rect.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });
  }

  document.getElementById('printLapsedBtn').addEventListener('click', () => window.print());

  async function loadLapsedClients() {
    const box = document.getElementById('lapsedContent');
    box.innerHTML = '<p class="hint">Reading invoices from the last 12 months…</p>';
    try {
      const res = await authedFetch('/.netlify/functions/get-lapsed-clients');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      renderLapsedClients(json);
    } catch (err) {
      box.innerHTML = `<p class="result-detail">Could not load this. <br/><code>${escapeHtml(err.message)}</code></p>`;
    }
  }

  function formatDatePlain(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    return `${day} ${MONTH_ABBR[month - 1]} ${year}`;
  }

  function updateLapsedSummary(remaining) {
    const summary = document.getElementById('lapsedSummary');
    if (!summary) return;
    if (remaining === 0) {
      summary.textContent = 'All caught up — every lapsed client has been visited.';
      return;
    }
    summary.textContent = `${remaining} client${remaining === 1 ? '' : 's'} haven't ordered in over 30 days`;
  }

  function renderLapsedClients(data) {
    const box = document.getElementById('lapsedContent');

    renderGeneratedAt('lapsedPrintGeneratedAt', data.generatedAt);

    if (!data.clients || data.clients.length === 0) {
      box.innerHTML = `
        <div class="dash-summary">
          <span class="dash-summary-label">Lapsed clients</span>
          <span class="dash-summary-value">0</span>
        </div>
        <div class="dash-empty">No lapsed clients — everyone's ordered recently.</div>
      `;
      return;
    }

    const summaryHtml = `
      <div class="dash-summary">
        <span class="dash-summary-label" id="lapsedSummary">${data.clients.length} client${data.clients.length === 1 ? '' : 's'} haven't ordered in over 30 days</span>
      </div>
    `;

    const rowsHtml = data.clients
      .map(
        (c, i) => `
        <div class="lapsed-row" id="lapsedRow-${i}">
          <span class="lapsed-name">${escapeHtml(c.customerName || 'Unknown')}</span>
          <span class="lapsed-date">${escapeHtml(formatDatePlain(c.lastOrderDate))}</span>
          <label class="lapsed-visited">
            <input type="checkbox" data-row-id="lapsedRow-${i}" />
            Visited
          </label>
          <span class="lapsed-print-check" aria-hidden="true">&#9744;</span>
        </div>`
      )
      .join('');

    box.innerHTML = summaryHtml + `<div id="lapsedList">${rowsHtml}</div>`;

    let remaining = data.clients.length;
    box.querySelectorAll('#lapsedList input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const row = document.getElementById(checkbox.dataset.rowId);
        row.style.transition = 'opacity 0.25s ease';
        row.style.opacity = '0';
        setTimeout(() => {
          row.style.display = 'none';
        }, 250);
        remaining -= 1;
        updateLapsedSummary(remaining);
        if (remaining === 0) {
          setTimeout(() => {
            document.getElementById('lapsedList').innerHTML = '';
          }, 250);
        }
      });
    });
  }

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filePicked = document.getElementById('filePicked');
  const extractBtn = document.getElementById('extractBtn');

  let selectedFile = null;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    selectedFile = file;
    filePicked.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    extractBtn.disabled = false;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  let currentFileBase64 = null;
  let currentMimeType = null;

  extractBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    showStep('loading');
    document.getElementById('loadingLabel').textContent = 'Reading the bill…';
    statusBadge.textContent = '';

    try {
      currentFileBase64 = await fileToBase64(selectedFile);
      currentMimeType = selectedFile.type || 'application/pdf';

      const res = await authedFetch('/.netlify/functions/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: currentFileBase64, mimeType: currentMimeType }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || 'Extraction failed');
        const diag = [];
        if (json.detail) diag.push(JSON.stringify(json.detail));
        if (json.keyLengthSeen !== undefined) diag.push(`Gemini key length seen by function: ${json.keyLengthSeen} characters`);
        err.diagnostics = diag.length ? diag : undefined;
        throw err;
      }

      populateReview(json.extracted);
      showStep('review');
      checkForDuplicates(json.extracted);
    } catch (err) {
      showResult(false, err.message, null, err.diagnostics);
    }
  });

  async function checkForDuplicates(extracted) {
    const box = document.getElementById('duplicateWarning');
    box.innerHTML = '';
    try {
      const res = await authedFetch('/.netlify/functions/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_name: extracted.vendor_name,
          invoice_number: extracted.invoice_number,
          invoice_date: extracted.invoice_date,
          total: extracted.total,
        }),
      });
      const json = await res.json();
      if (json.duplicates && json.duplicates.length) {
        box.innerHTML = `
          <div class="warning-list">
            <p>This looks like it might already be in Zoho:</p>
            <ul>${json.duplicates
              .map(
                (d) =>
                  `<li>Bill ${escapeHtml(d.billNumber || '(no number)')} — ${escapeHtml(d.date || '')} — ₹${escapeHtml(
                    String(d.total ?? '')
                  )} — status: ${escapeHtml(d.status || '')}</li>`
              )
              .join('')}</ul>
            <p>Double-check before confirming, to avoid entering it twice.</p>
          </div>`;
      }
    } catch (e) {
      // Duplicate check is a courtesy — say nothing if it fails, don't block the flow.
    }
  }

  // ---------- Step 3: Review ----------

  const itemsBody = document.getElementById('itemsBody');

  function makeRow(item = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-desc"><input type="text" value="${escapeAttr(item.description || '')}" data-field="description" /></td>
      <td class="col-hsn"><input type="text" value="${escapeAttr(item.hsn_sac || '')}" data-field="hsn_sac" /></td>
      <td class="col-qty"><input type="number" step="0.01" value="${item.quantity ?? ''}" data-field="quantity" /></td>
      <td class="col-unit"><input type="text" value="${escapeAttr(item.unit || '')}" data-field="unit" /></td>
      <td class="col-rate"><input type="number" step="0.01" value="${item.rate ?? ''}" data-field="rate" /></td>
      <td class="col-amount"><input type="number" step="0.01" value="${item.amount ?? ''}" data-field="amount" /></td>
      <td class="col-del"><button type="button" class="row-del" title="Remove line">×</button></td>
    `;
    tr.querySelector('.row-del').addEventListener('click', () => tr.remove());
    return tr;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }

  document.getElementById('addRowBtn').addEventListener('click', () => {
    itemsBody.appendChild(makeRow());
  });

  function populateReview(data) {
    document.getElementById('f_vendor_name').value = data.vendor_name || '';
    document.getElementById('f_vendor_gstin').value = data.vendor_gstin || '';
    document.getElementById('f_invoice_number').value = data.invoice_number || '';
    document.getElementById('f_invoice_date').value = data.invoice_date || '';
    document.getElementById('f_cgst_percent').value = data.cgst_percent ?? '';
    document.getElementById('f_cgst_amount').value = data.cgst_amount ?? '';
    document.getElementById('f_sgst_percent').value = data.sgst_percent ?? '';
    document.getElementById('f_sgst_amount').value = data.sgst_amount ?? '';
    document.getElementById('f_round_off').value = data.round_off ?? '';
    document.getElementById('f_total').value = data.total ?? '';

    itemsBody.innerHTML = '';
    (data.line_items || []).forEach((item) => itemsBody.appendChild(makeRow(item)));
    if (!data.line_items || data.line_items.length === 0) itemsBody.appendChild(makeRow());
  }

  function collectReviewData() {
    const lineItems = Array.from(itemsBody.querySelectorAll('tr')).map((tr) => {
      const get = (field) => tr.querySelector(`[data-field="${field}"]`).value;
      return {
        description: get('description'),
        hsn_sac: get('hsn_sac'),
        quantity: parseFloat(get('quantity')) || 0,
        unit: get('unit'),
        rate: parseFloat(get('rate')) || 0,
        amount: parseFloat(get('amount')) || 0,
      };
    }).filter((li) => li.description.trim() !== '');

    return {
      vendor_name: document.getElementById('f_vendor_name').value.trim(),
      vendor_gstin: document.getElementById('f_vendor_gstin').value.trim(),
      invoice_number: document.getElementById('f_invoice_number').value.trim(),
      invoice_date: document.getElementById('f_invoice_date').value,
      cgst_percent: parseFloat(document.getElementById('f_cgst_percent').value) || 0,
      cgst_amount: parseFloat(document.getElementById('f_cgst_amount').value) || 0,
      sgst_percent: parseFloat(document.getElementById('f_sgst_percent').value) || 0,
      sgst_amount: parseFloat(document.getElementById('f_sgst_amount').value) || 0,
      round_off: parseFloat(document.getElementById('f_round_off').value) || 0,
      total: parseFloat(document.getElementById('f_total').value) || 0,
      line_items: lineItems,
    };
  }

  document.getElementById('cancelBtn').addEventListener('click', resetTool);

  document.getElementById('confirmBtn').addEventListener('click', async () => {
    const data = collectReviewData();
    if (!data.vendor_name || data.line_items.length === 0) {
      alert('Vendor name and at least one line item are required.');
      return;
    }

    showStep('loading');
    document.getElementById('loadingLabel').textContent = 'Sending to Zoho…';

    try {
      const res = await authedFetch('/.netlify/functions/submit-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          fileBase64: currentFileBase64,
          fileName: selectedFile.name,
          mimeType: currentMimeType,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || 'Submission failed');
        err.diagnostics = json.diagnostics;
        throw err;
      }

      showResult(true, null, json);
    } catch (err) {
      showResult(false, err.message, null, err.diagnostics);
    } finally {
      // Discard the file/data from memory regardless of outcome — nothing persists client-side either.
      currentFileBase64 = null;
      selectedFile = null;
    }
  });

  // ---------- Step 4: Result ----------

  function showResult(success, errorMessage, payload, diagnostics) {
    const block = document.getElementById('resultBlock');
    statusBadge.textContent = success ? 'Sent' : 'Failed';

    if (success) {
      let warningsHtml = '';
      if (payload.warnings && payload.warnings.length) {
        warningsHtml = `
          <div class="warning-list">
            <p>Check these before approving the bill in Zoho:</p>
            <ul>${payload.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
          </div>`;
      }
      block.innerHTML = `
        <div class="result-title"><span class="result-stamp ok">Draft created</span></div>
        <p class="result-detail">
          Bill <strong>${escapeHtml(payload.billId)}</strong> was created in Zoho Inventory as a draft, with the original file attached.
          <br/>Open it in Zoho to review and approve: <a href="${payload.billUrl}" target="_blank" rel="noopener">${payload.billUrl}</a>
        </p>
        ${warningsHtml}
      `;
    } else {
      let diagnosticsHtml = '';
      if (diagnostics && diagnostics.length) {
        diagnosticsHtml = `
          <div class="warning-list">
            <p>Diagnostic info collected before the failure:</p>
            <ul>${diagnostics.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
          </div>`;
      }
      block.innerHTML = `
        <div class="result-title"><span class="result-stamp err">Not sent</span></div>
        <p class="result-detail">The bill was not created. Nothing was saved. Error detail:<br/><code>${escapeHtml(errorMessage)}</code></p>
        ${diagnosticsHtml}
      `;
    }
    showStep('result');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById('newBillBtn').addEventListener('click', resetTool);

  function resetTool() {
    selectedFile = null;
    currentFileBase64 = null;
    currentMimeType = null;
    fileInput.value = '';
    filePicked.textContent = '';
    extractBtn.disabled = true;
    statusBadge.textContent = '';
    document.getElementById('duplicateWarning').innerHTML = '';
    showStep('upload');
  }
})();
