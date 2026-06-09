/* ═══════════════════════════════════════════════
   GUTI 2.0 — Research & Writing Tools Module
   ═══════════════════════════════════════════════ */

const ToolsView = {
  activeTab: 'humanizer',
  currentModel: 'deepseek-v3',

  init() {
    this.bindEvents();
  },

  bindEvents() {
    document.querySelectorAll('.tool-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    document.getElementById('humanize-btn')?.addEventListener('click', () => this.humanize());
    document.getElementById('detect-btn')?.addEventListener('click',   () => this.detectAI());
    document.getElementById('copy-humanized-btn')?.addEventListener('click', () => this.copyHumanized());
    document.getElementById('clear-tools-btn')?.addEventListener('click',   () => this.clearAll());
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tool-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.tool-workspace').forEach(w => {
      w.classList.toggle('hidden', w.id !== `${tab}-workspace`);
    });
  },

  async humanize() {
    const input = document.getElementById('humanize-input')?.value.trim();
    if (!input) { Toast.error('Paste some text first'); return; }
    if (input.length < 20) { Toast.error('Text too short'); return; }

    const btn = document.getElementById('humanize-btn');
    const output = document.getElementById('humanize-output');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Humanizing…'; }
    if (output) output.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    try {
      const fd = new FormData();
      fd.append('text',      input);
      fd.append('model_key', this.currentModel);

      const res = await API.post('/humanize', fd);

      if (output) {
        output.innerHTML = `
          <div style="font-size:14px;line-height:1.7;color:var(--text-primary)">${res.humanized}</div>
          <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">
            Model: ${res.model_used?.split('/').pop()}
          </div>`;
      }

      document.getElementById('copy-humanized-btn')?.removeAttribute('disabled');
      Toast.success('Text humanized!');

    } catch (err) {
      if (output) output.innerHTML = `<span style="color:var(--accent-3)">⚠ Failed: ${err.message}</span>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Humanize'; }
    }
  },

  copyHumanized() {
    const output = document.getElementById('humanize-output');
    if (output) {
      navigator.clipboard.writeText(output.innerText).then(() => Toast.success('Copied!'));
    }
  },

  async detectAI() {
    const input = document.getElementById('detect-input')?.value.trim();
    if (!input) { Toast.error('Paste some text first'); return; }
    if (input.length < 50) { Toast.error('Text too short (min 50 chars)'); return; }

    const btn = document.getElementById('detect-btn');
    const output = document.getElementById('detect-output');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyzing…'; }
    if (output) output.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    try {
      const fd = new FormData();
      fd.append('text',      input);
      fd.append('model_key', this.currentModel);

      const res = await API.post('/detect-ai', fd);
      const d = res.detection;

      if (!d) {
        if (output) output.innerHTML = `<pre style="font-size:12px">${res.raw}</pre>`;
        return;
      }

      // Score color
      const scoreColor = d.score >= 70 ? 'var(--accent-3)'
                       : d.score >= 40 ? 'var(--warning)'
                       : 'var(--success)';

      if (output) {
        output.innerHTML = `
          <div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:13px;font-weight:600;color:var(--text-primary)">AI Score</span>
              <span style="font-size:24px;font-weight:700;color:${scoreColor}">${d.score}%</span>
            </div>
            <div class="ai-score-bar">
              <div class="ai-score-fill" style="width:${d.score}%;background:${scoreColor}"></div>
            </div>
            <div style="margin-top:6px">
              <span class="badge ${d.score >= 70 ? 'badge-red' : d.score >= 40 ? 'badge-orange' : 'badge-green'}"
                    style="font-size:12px;padding:4px 12px">${d.verdict}</span>
            </div>
          </div>

          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">
              Detected Signals
            </div>
            ${d.signals?.map(s => `
              <div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;color:var(--text-secondary)">
                <span style="color:var(--accent-3)">▸</span> ${s}
              </div>`).join('') || ''}
          </div>

          <div style="padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-md);
                      font-size:13px;color:var(--text-secondary);line-height:1.6">
            ${d.explanation}
          </div>

          <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">
            Model: ${res.model_used?.split('/').pop()}
          </div>`;
      }

      Toast.success('Analysis complete!');

    } catch (err) {
      if (output) output.innerHTML = `<span style="color:var(--accent-3)">⚠ Failed: ${err.message}</span>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Detect AI'; }
    }
  },

  clearAll() {
    ['humanize-input', 'detect-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['humanize-output', 'detect-output'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Result will appear here…</span>';
    });
  },
};
