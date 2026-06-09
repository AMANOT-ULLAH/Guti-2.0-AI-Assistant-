/* ═══════════════════════════════════════════════
   GUTI 2.0 — Data Analysis Module
   ═══════════════════════════════════════════════ */

const DataView = {
  sessionId: null,
  analysis: null,
  currentModel: 'deepseek-v3',

  init() {
    this.sessionId = 'data_' + Math.random().toString(36).slice(2, 11);
    this.bindEvents();
  },

  bindEvents() {
    // Upload zone
    const zone = document.getElementById('data-upload-zone');
    const fileInput = document.getElementById('csv-file-input');

    zone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.uploadCSV(file);
      e.target.value = '';
    });

    // Drag & drop
    zone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone?.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith('.csv')) this.uploadCSV(file);
      else Toast.error('Only CSV files allowed');
    });

    // Ask question
    document.getElementById('data-ask-btn')?.addEventListener('click', () => this.askQuestion());
    document.getElementById('data-question-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.askQuestion(); }
    });

    // Auto insights
    document.getElementById('auto-insights-btn')?.addEventListener('click', () => this.getAutoInsights());

    // New dataset
    document.getElementById('new-dataset-btn')?.addEventListener('click', () => this.reset());
  },

  async uploadCSV(file) {
    const zone = document.getElementById('data-upload-zone');
    if (zone) {
      zone.innerHTML = `
        <div class="spinner lg" style="margin: 0 auto 12px"></div>
        <p style="color:var(--text-secondary)">Analyzing ${file.name}…</p>`;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('session_id', this.sessionId);

    try {
      const res = await API.post('/data/upload', fd);
      this.analysis = res.analysis;
      this.showWorkspace();
      this.renderStats();
      this.renderColumns();
      Toast.success(`✅ ${file.name} loaded — ${res.analysis.total_rows.toLocaleString()} rows`);
    } catch (err) {
      Toast.error('Upload failed: ' + err.message);
      this.resetUploadZone();
    }
  },

  showWorkspace() {
    document.getElementById('data-upload-zone')?.classList.add('hidden');
    document.getElementById('data-workspace')?.classList.remove('hidden');

    const filenameEl = document.getElementById('data-filename');
    if (filenameEl) filenameEl.textContent = this.analysis.filename;
  },

  resetUploadZone() {
    const zone = document.getElementById('data-upload-zone');
    if (zone) {
      zone.innerHTML = `
        <div style="font-size:40px;margin-bottom:12px">📊</div>
        <h3>Drop your CSV file here</h3>
        <p>or click to browse • Max 50MB</p>
        <input type="file" id="csv-file-input" accept=".csv" style="display:none">`;
    }
  },

  renderStats() {
    const a = this.analysis;
    const bar = document.getElementById('data-stats-bar');
    if (!bar) return;

    const chips = [
      { label: 'Rows',        value: a.total_rows.toLocaleString(), color: 'var(--accent)' },
      { label: 'Columns',     value: a.total_cols,                  color: 'var(--accent)' },
      { label: 'Numerical',   value: a.numerical_cols.length,       color: 'var(--success)' },
      { label: 'Categorical', value: a.categorical_cols.length,     color: 'var(--warning)' },
      { label: 'Quality',     value: a.quality_score + '/100',      color: this.qualityColor(a.quality_score) },
    ];

    if (a.has_missing) chips.push({ label: 'Missing', value: '⚠', color: 'var(--accent-3)' });
    if (a.is_large_dataset) chips.push({ label: 'Large Dataset', value: '10k sample', color: 'var(--warning)' });

    bar.innerHTML = chips.map(c => `
      <div class="stat-chip">
        <span class="stat-value" style="color:${c.color}">${c.value}</span>
        <span class="stat-label">${c.label}</span>
      </div>`).join('');
  },

  qualityColor(score) {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--accent-3)';
  },

  renderColumns() {
    const sidebar = document.getElementById('data-col-list');
    if (!sidebar || !this.analysis) return;

    const cols = this.analysis.columns;
    sidebar.innerHTML = `
      <div class="section-label" style="margin-bottom:8px">Columns (${cols.length})</div>
      ${cols.map(col => `
        <div style="padding:6px 8px;border-radius:var(--radius-md);margin-bottom:4px;
                    background:var(--bg-elevated);border:1px solid var(--border);
                    cursor:pointer;transition:var(--transition)"
             onclick="DataView.askAboutColumn('${col.name}')"
             onmouseover="this.style.borderColor='var(--border-strong)'"
             onmouseout="this.style.borderColor='var(--border)'">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:12px;font-weight:500;color:var(--text-primary);
                         overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px"
                  title="${col.name}">${col.name}</span>
            <span class="badge ${col.type === 'numerical' ? 'badge-green' : 'badge-orange'}" style="font-size:9px">
              ${col.type === 'numerical' ? 'NUM' : 'CAT'}
            </span>
          </div>
          ${col.type === 'numerical'
            ? `<div style="font-size:10px;color:var(--text-muted)">
                min: ${col.min} · max: ${col.max} · mean: ${col.mean}
               </div>`
            : `<div style="font-size:10px;color:var(--text-muted)">
                ${col.unique_values} unique values
               </div>`
          }
          ${col.missing > 0
            ? `<div style="font-size:10px;color:var(--accent-3)">⚠ ${col.missing_pct}% missing</div>`
            : ''}
        </div>`).join('')}`;
  },

  askAboutColumn(colName) {
    const input = document.getElementById('data-question-input');
    if (input) {
      input.value = `${colName} column এর distribution দেখাও`;
      input.focus();
    }
  },

  async askQuestion() {
    const input = document.getElementById('data-question-input');
    const question = input?.value.trim();
    if (!question) return;
    if (!this.analysis) { Toast.error('Upload a CSV first'); return; }

    input.value = '';

    // Show user question
    this.appendDataMessage('user', question);

    // Show loading
    const loadingId = 'loading_' + Date.now();
    this.appendDataMessage('loading', '', loadingId);

    try {
      const fd = new FormData();
      fd.append('question',   question);
      fd.append('session_id', this.sessionId);
      fd.append('model_key',  this.currentModel);

      const res = await API.post('/data/ask', fd);

      // Remove loading
      document.getElementById(loadingId)?.remove();

      // Show result
      this.appendDataResult(question, res);

    } catch (err) {
      document.getElementById(loadingId)?.remove();
      this.appendDataMessage('error', 'Analysis failed: ' + err.message);
    }
  },

  async getAutoInsights() {
    if (!this.analysis) { Toast.error('Upload a CSV first'); return; }

    const btn = document.getElementById('auto-insights-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyzing…'; }

    try {
      const fd = new FormData();
      fd.append('session_id', this.sessionId);
      fd.append('model_key',  this.currentModel);

      const res = await API.post('/data/auto-insights', fd);

      if (btn) { btn.disabled = false; btn.textContent = '✨ Auto Insights'; }

      if (!res.insights?.length) { Toast.error('No insights generated'); return; }

      // Show insights as clickable chips
      const container = document.getElementById('data-messages');
      if (!container) return;

      const el = document.createElement('div');
      el.className = 'fade-in';
      el.style.cssText = 'margin-bottom:12px';
      el.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          ✨ <strong style="color:var(--text-secondary)">AI suggested ${res.insights.length} insights:</strong>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${res.insights.map((ins, i) => `
            <div style="padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border);
                        border-radius:var(--radius-md);cursor:pointer;transition:var(--transition)"
                 onclick="DataView.runInsight('${ins.question.replace(/'/g, "\\'")}')"
                 onmouseover="this.style.borderColor='var(--accent)'"
                 onmouseout="this.style.borderColor='var(--border)'">
              <div style="font-size:12px;color:var(--text-primary);font-weight:500">${i+1}. ${ins.question}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${ins.why_interesting}</div>
              <span class="badge badge-blue" style="margin-top:4px;font-size:9px">${ins.chart_type} chart</span>
            </div>`).join('')}
        </div>`;
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;

    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Auto Insights'; }
      Toast.error('Failed: ' + err.message);
    }
  },

  runInsight(question) {
    const input = document.getElementById('data-question-input');
    if (input) { input.value = question; this.askQuestion(); }
  },

  appendDataMessage(type, content, id = '') {
    const container = document.getElementById('data-messages');
    if (!container) return;

    const el = document.createElement('div');
    if (id) el.id = id;
    el.className = 'fade-in';

    if (type === 'user') {
      el.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <div style="background:var(--accent);color:white;padding:8px 14px;
                      border-radius:var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
                      font-size:13px;max-width:75%">${content}</div>
        </div>`;
    } else if (type === 'loading') {
      el.innerHTML = `
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px">
          <div style="width:28px;height:28px;background:var(--bg-elevated);border:1px solid var(--border);
                      border-radius:50%;display:flex;align-items:center;justify-content:center;
                      font-size:12px;flex-shrink:0">⚡</div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);
                      border-radius:var(--radius-md);padding:12px">
            <div class="typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>`;
    } else if (type === 'error') {
      el.innerHTML = `
        <div style="background:rgba(247,106,106,0.1);border:1px solid rgba(247,106,106,0.3);
                    border-radius:var(--radius-md);padding:10px 14px;font-size:13px;
                    color:var(--accent-3);margin-bottom:8px">⚠ ${content}</div>`;
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  appendDataResult(question, res) {
    const container = document.getElementById('data-messages');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'result-card fade-in';
    el.style.marginBottom = '16px';

    let innerHtml = `
      <div class="result-card-header">
        <span>📊 ${question.slice(0, 60)}${question.length > 60 ? '…' : ''}</span>
        <span class="badge badge-blue" style="font-size:10px">${res.model_used?.split('/').pop() || 'AI'}</span>
      </div>
      <div class="result-card-body">`;

    // Answer text
    if (res.answer) {
      innerHtml += `<div class="markdown" style="font-size:13px;margin-bottom:12px">${renderMarkdown(res.answer)}</div>`;
    }

    // Chart
    if (res.chart) {
      innerHtml += `
        <div class="chart-container" style="margin-bottom:12px">
          <img src="data:image/png;base64,${res.chart}" alt="Chart" style="width:100%;border-radius:var(--radius-md)">
        </div>`;
    }

    // Output
    if (res.output) {
      innerHtml += `
        <div class="exec-output" style="margin-bottom:10px">${res.output}</div>`;
    }

    // Error
    if (res.error) {
      innerHtml += `
        <div class="exec-output exec-error">⚠ ${res.error}</div>`;
    }

    // Code (collapsible)
    if (res.code) {
      const codeId = 'code_' + Date.now();
      innerHtml += `
        <details style="margin-top:8px">
          <summary style="cursor:pointer;font-size:12px;color:var(--text-muted);
                          padding:4px 0;user-select:none">
            🔍 View generated code
          </summary>
          <div class="code-block" style="margin-top:8px">
            <div class="code-block-header">
              <span>python</span>
              <button class="btn btn-ghost btn-sm" onclick="copyCode(this)">Copy</button>
            </div>
            <pre id="${codeId}">${res.code}</pre>
          </div>
        </details>`;
    }

    innerHtml += '</div>';
    el.innerHTML = innerHtml;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  reset() {
    this.analysis = null;
    this.sessionId = 'data_' + Math.random().toString(36).slice(2, 11);

    document.getElementById('data-workspace')?.classList.add('hidden');
    document.getElementById('data-upload-zone')?.classList.remove('hidden');
    document.getElementById('data-messages').innerHTML = '';
    this.resetUploadZone();
    this.bindEvents();
  },
};
