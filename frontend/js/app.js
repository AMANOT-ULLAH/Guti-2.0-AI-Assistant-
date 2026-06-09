/* ═══════════════════════════════════════════════
   GUTI 2.0 — Config & API Helper
   ═══════════════════════════════════════════════ */

const CONFIG = {
  API_BASE: 'http://127.0.0.1:8000',
  APP_NAME: 'Guti 2.0',
};

// ── API Helper ──────────────────────────────────
const API = {
  token: null,

  setToken(t) { this.token = t; },
  clearToken() { this.token = null; },

  headers(extra = {}) {
    const h = { ...extra };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async get(path) {
    const r = await fetch(CONFIG.API_BASE + path, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async post(path, formData) {
    const r = await fetch(CONFIG.API_BASE + path, {
      method: 'POST',
      headers: this.headers(),
      body: formData,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async postJSON(path, data) {
    const r = await fetch(CONFIG.API_BASE + path, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async delete(path) {
    const r = await fetch(CONFIG.API_BASE + path, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  streamChat(path, formData, onChunk, onDone, onError) {
    const controller = new AbortController();

    fetch(CONFIG.API_BASE + path, {
      method: 'POST',
      headers: this.headers(),
      body: formData,
      signal: controller.signal,
    }).then(async res => {
      if (!res.ok) {
        onError('Server error: ' + res.status);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { onDone(); return; }
          try {
            const d = JSON.parse(raw);
            if (d.text) onChunk(d.text);
            else if (d.error) onError(d.message || 'Error');
            else if (d.model_used) {} // model info, ignore
          } catch {}
        }
      }
      onDone();
    }).catch(err => {
      if (err.name !== 'AbortError') onError(err.message);
    });

    return controller;
  },
};

// ── Toast Notifications ─────────────────────────
const Toast = {
  show(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || icons.info}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toast-in 0.3s ease reverse';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  info(msg)    { this.show(msg, 'info'); },
};

// ── Simple Markdown Renderer ─────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<div class="code-block">
        <div class="code-block-header">
          <span>${lang || 'code'}</span>
          <button class="btn btn-ghost btn-sm copy-code-btn" onclick="copyCode(this)">Copy</button>
        </div>
        <pre>${code.trimEnd()}</pre>
      </div>`)
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    // numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // horizontal rule
    .replace(/^---$/gm, '<hr>')
    // line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

function copyCode(btn) {
  const pre = btn.closest('.code-block').querySelector('pre');
  navigator.clipboard.writeText(pre.textContent).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

// ── Format time ─────────────────────────────────
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
