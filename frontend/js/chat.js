/* ═══════════════════════════════════════════════
   GUTI 2.0 — Chat Module
   ═══════════════════════════════════════════════ */

const ChatView = {
  sessionId: null,
  isStreaming: false,
  streamController: null,
  currentModel: 'gpt-oss-120b',
  pendingImage: null,
  messageCount: 0,

  init() {
    this.sessionId = this.generateId();
    this.bindEvents();
    this.loadModels();
    this.showWelcome();
  },

  generateId() {
    return 'ses_' + Math.random().toString(36).slice(2, 11);
  },

  bindEvents() {
    const input   = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const fileBtn = document.getElementById('attach-btn');
    const voiceBtn = document.getElementById('voice-btn');

    // Send on Enter (Shift+Enter = newline)
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.isStreaming) this.stopStream();
        else this.sendMessage();
      }
    });

    // Auto-resize textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    sendBtn?.addEventListener('click', () => {
      if (this.isStreaming) this.stopStream();
      else this.sendMessage();
    });

    fileBtn?.addEventListener('click', () => {
      document.getElementById('image-file-input')?.click();
    });

    document.getElementById('image-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.attachImage(file);
      e.target.value = '';
    });

    voiceBtn?.addEventListener('click', () => this.toggleVoice());

    // Model selector
    document.getElementById('model-selector-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('model-dropdown')?.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      document.getElementById('model-dropdown')?.classList.remove('open');
    });
  },

  newChat() {
    this.sessionId = this.generateId();
    this.messageCount = 0;
    this.pendingImage = null;
    this.clearAttachments();

    const messages = document.getElementById('chat-messages');
    if (messages) messages.innerHTML = '';
    this.showWelcome();
    document.getElementById('chat-input')?.focus();
  },

  showWelcome() {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;
    if (messages.children.length === 0) {
      messages.innerHTML = `
        <div class="welcome-screen" id="welcome-screen">
          <div class="welcome-icon">⚡</div>
          <h2 class="welcome-title">Guti 2.0 — AI Platform</h2>
          <p class="welcome-subtitle text-bengali">
            Research, Data Analysis, Writing Tools — সব এক জায়গায়।
            বাংলা, English বা Banglish — যেভাবে চাও কথা বলো।
          </p>
          <div class="welcome-suggestions">
            <div class="suggestion-chip" onclick="ChatView.useSuggestion(this)">
              <span class="suggestion-chip-icon">🔬</span>
              Find research papers on transformer architecture
            </div>
            <div class="suggestion-chip" onclick="ChatView.useSuggestion(this)">
              <span class="suggestion-chip-icon">📊</span>
              আমার dataset analyze করে দাও
            </div>
            <div class="suggestion-chip" onclick="ChatView.useSuggestion(this)">
              <span class="suggestion-chip-icon">💡</span>
              Explain machine learning in Bengali
            </div>
            <div class="suggestion-chip" onclick="ChatView.useSuggestion(this)">
              <span class="suggestion-chip-icon">🌐</span>
              Latest AI news today
            </div>
          </div>
        </div>`;
    }
  },

  useSuggestion(el) {
    const text = el.querySelector('span + *')?.textContent || el.textContent.trim();
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = text.replace(/^[^\w\u0980-\u09FF]+/, '').trim();
      input.focus();
      this.sendMessage();
    }
  },

  attachImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.pendingImage = { file, dataUrl: e.target.result };
      const preview = document.getElementById('attachment-preview');
      if (preview) {
        preview.innerHTML = `
          <div class="attachment-chip">
            🖼 ${file.name}
            <span class="remove-btn" onclick="ChatView.removeAttachment()">✕</span>
          </div>`;
      }
    };
    reader.readAsDataURL(file);
  },

  removeAttachment() {
    this.pendingImage = null;
    this.clearAttachments();
  },

  clearAttachments() {
    const preview = document.getElementById('attachment-preview');
    if (preview) preview.innerHTML = '';
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const text  = input?.value.trim();

    if (!text && !this.pendingImage) return;
    if (this.isStreaming) return;

    // Remove welcome screen
    document.getElementById('welcome-screen')?.remove();

    const userText = text || '(image attached)';
    input.value = '';
    input.style.height = 'auto';

    // Add user message
    this.appendMessage('user', userText, this.pendingImage?.dataUrl);

    // Clear attachment
    const image = this.pendingImage;
    this.removeAttachment();

    // If image, route to image analysis
    if (image) {
      await this.sendImageMessage(image, text);
      return;
    }

    // Prepare form
    const fd = new FormData();
    fd.append('message',    userText);
    fd.append('session_id', this.sessionId);
    fd.append('model_key',  this.currentModel);

    // Add assistant bubble
    const bubble = this.appendMessage('assistant', '', null, true);
    this.setStreaming(true);

    this.streamController = API.streamChat(
      '/chat', fd,
      (chunk) => { this.appendChunk(bubble, chunk); },
      ()      => {
        this.finalizeMessage(bubble);
        this.setStreaming(false);
        this.messageCount++;
        this.autoSaveSession(userText);
      },
      (err)   => {
        bubble.querySelector('.message-bubble').innerHTML =
          `<span style="color:var(--accent-3)">⚠ ${err}</span>`;
        this.setStreaming(false);
      }
    );
  },

  async sendImageMessage(image, question) {
    const fd = new FormData();
    fd.append('file',      image.file);
    fd.append('question',  question || 'এই ছবিটা বিস্তারিত analyze করো।');
    fd.append('session_id', this.sessionId);

    const bubble = this.appendMessage('assistant', '', null, true);
    this.setStreaming(true);

    try {
      const res = await API.post('/image/analyze', fd);
      this.finalizeMessageText(bubble, res.analysis);
      Toast.info(`Model: ${res.model_used?.split('/').pop()}`);
    } catch (err) {
      bubble.querySelector('.message-bubble').innerHTML =
        `<span style="color:var(--accent-3)">⚠ Image analysis failed</span>`;
    } finally {
      this.setStreaming(false);
      this.messageCount++;
    }
  },

  stopStream() {
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
    }
    this.setStreaming(false);
  },

  setStreaming(val) {
    this.isStreaming = val;
    const btn = document.getElementById('send-btn');
    const input = document.getElementById('chat-input');
    if (btn) {
      btn.classList.toggle('stop-mode', val);
      btn.innerHTML = val
        ? `<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>`
        : `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>`;
    }
    if (input) input.disabled = val;
  },

  appendMessage(role, text, imageUrl = null, streaming = false) {
    const messages = document.getElementById('chat-messages');
    if (!messages) return null;

    const isUser = role === 'user';
    const avatar = isUser
      ? Auth.getInitials()
      : '⚡';

    const imageHtml = imageUrl
      ? `<div class="message-image"><img src="${imageUrl}" alt="attached"></div>`
      : '';

    const bubbleContent = streaming
      ? '<div class="typing-dots"><span></span><span></span><span></span></div>'
      : (text ? `<div class="markdown">${renderMarkdown(text)}</div>` : '');

    const el = document.createElement('div');
    el.className = `message ${role} fade-in`;
    el.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        ${imageHtml}
        <div class="message-bubble">${bubbleContent}</div>
        <div class="message-meta">
          <span>${formatTime(new Date())}</span>
          ${!isUser ? `<span id="model-tag-${Date.now()}" class="badge badge-blue" style="font-size:10px">${this.currentModel}</span>` : ''}
        </div>
        ${!isUser ? `
          <div class="message-actions">
            <button class="msg-action-btn" onclick="copyMessageText(this)">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
            <button class="msg-action-btn" onclick="speakMessage(this)">
              🔊 Speak
            </button>
          </div>` : ''}
      </div>`;

    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  },

  _streamText: new Map(),

  appendChunk(el, chunk) {
    if (!el) return;
    const bubble = el.querySelector('.message-bubble');
    if (!bubble) return;

    const id = el.dataset.msgId || (el.dataset.msgId = Date.now().toString());
    const current = this._streamText.get(id) || '';
    const next = current + chunk;
    this._streamText.set(id, next);

    bubble.innerHTML = `<div class="markdown">${renderMarkdown(next)}</div>`;
    const messages = document.getElementById('chat-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  },

  finalizeMessage(el) {
    if (!el) return;
    const id = el.dataset.msgId;
    const text = this._streamText.get(id) || '';
    this._streamText.delete(id);
    const bubble = el.querySelector('.message-bubble');
    if (bubble && text) {
      bubble.innerHTML = `<div class="markdown">${renderMarkdown(text)}</div>`;
    }
  },

  finalizeMessageText(el, text) {
    const bubble = el?.querySelector('.message-bubble');
    if (bubble) bubble.innerHTML = `<div class="markdown">${renderMarkdown(text)}</div>`;
  },

  async loadSession(sessionId) {
    this.sessionId = sessionId;
    const messages = document.getElementById('chat-messages');
    if (!messages) return;
    messages.innerHTML = '';

    try {
      const res = await API.get(`/history/${sessionId}/messages`);
      if (!res.messages?.length) { this.showWelcome(); return; }
      res.messages.forEach(m => this.appendMessage(m.role, m.content));
    } catch {
      this.showWelcome();
    }
  },

  autoSaveSession(firstMessage) {
    if (!Auth.isLoggedIn() || this.messageCount > 1) return;

    // Generate title from first message (truncate)
    const title = firstMessage.slice(0, 60);

    // Save to Neon via backend
    const fd = new FormData();
    fd.append('title',        title);
    fd.append('session_id',   this.sessionId);
    fd.append('session_type', 'chat');
    API.post('/history/save', fd).catch(() => {});

    // Add to sidebar
    Sidebar.addToHistory({
      id: this.sessionId,
      title,
      session_type: 'chat',
      updated_at: new Date().toISOString(),
    });
  },

  // ── Model Management ──────────────────────────
  async loadModels() {
    try {
      const res = await API.get('/models');
      this.renderModelDropdown(res);
    } catch {}
  },

  renderModelDropdown(models) {
    const dropdown = document.getElementById('model-dropdown');
    if (!dropdown) return;

    let html = '';
    const general = models.general || [];
    html += `<div class="model-task-group">
      <div class="model-task-label">💬 General Chat</div>`;
    general.forEach(m => {
      html += `
        <div class="model-option ${m.key === this.currentModel ? 'selected' : ''} ${m.ok ? '' : 'unavailable'}"
             onclick="ChatView.selectModel('${m.key}', '${m.key}')">
          <div>
            <div class="model-option-name">${m.key}</div>
            <div class="model-option-id">${m.id.split('/').pop()}</div>
          </div>
          <div class="dot ${m.ok ? 'dot-green' : 'dot-red'}"></div>
        </div>`;
    });
    html += '</div>';
    dropdown.innerHTML = html;
  },

  selectModel(key, display) {
    this.currentModel = key;
    const nameEl = document.getElementById('current-model-name');
    if (nameEl) nameEl.textContent = display;
    document.querySelectorAll('.model-option').forEach(o => {
      o.classList.toggle('selected', o.getAttribute('onclick')?.includes(key));
    });
    document.getElementById('model-dropdown')?.classList.remove('open');
    Toast.info(`Model: ${key}`);
  },

  // ── Voice Input ───────────────────────────────
  recognition: null,
  isRecording: false,

  toggleVoice() {
    if (this.isRecording) {
      this.stopVoice();
    } else {
      this.startVoice();
    }
  },

  startVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      Toast.error('Voice not supported in this browser');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.lang = 'bn-BD';
    this.recognition.interimResults = true;
    this.recognition.continuous = false;

    this.recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join('');
      const input = document.getElementById('chat-input');
      if (input) input.value = transcript;
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      document.getElementById('voice-btn')?.classList.remove('recording');
    };

    this.recognition.start();
    this.isRecording = true;
    document.getElementById('voice-btn')?.classList.add('recording');
    Toast.info('🎙 Listening...');
  },

  stopVoice() {
    this.recognition?.stop();
    this.isRecording = false;
    document.getElementById('voice-btn')?.classList.remove('recording');
  },
};

// ── Global helpers ───────────────────────────────
function copyMessageText(btn) {
  const bubble = btn.closest('.message-content').querySelector('.message-bubble');
  navigator.clipboard.writeText(bubble.innerText).then(() => {
    Toast.success('Copied!');
  });
}

async function speakMessage(btn) {
  const bubble = btn.closest('.message-content').querySelector('.message-bubble');
  const text = bubble.innerText.slice(0, 500);

  if (!document.querySelector('[name=elevenlabs_key]')) {
    // Fallback: browser TTS
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    return;
  }

  try {
    const fd = new FormData();
    fd.append('text', text);
    const res = await API.post('/voice/speak', fd);
    const audio = new Audio(`data:audio/mpeg;base64,${res.audio_base64}`);
    audio.play();
  } catch {
    Toast.error('TTS failed');
  }
}
