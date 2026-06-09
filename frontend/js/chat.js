/* ═══════════════════════════════════════════════
   GUTI 2.0 — Chat CSS
   ═══════════════════════════════════════════════ */

/* ── Main Content Area ─────────────────────────── */
#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-base);
  position: relative;
}

/* ── Top Bar ───────────────────────────────────── */
.topbar {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  flex-shrink: 0;
  gap: 12px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ── Model Selector ────────────────────────────── */
.model-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  font-size: 12px;
  color: var(--text-secondary);
  position: relative;
}
.model-selector:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.model-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  min-width: 240px;
  padding: 6px;
  box-shadow: var(--shadow-lg);
  z-index: 500;
  display: none;
}
.model-dropdown.open { display: block; }

.model-task-group {
  margin-bottom: 6px;
}

.model-task-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 4px 8px;
}

.model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  font-size: 12px;
}
.model-option:hover { background: var(--bg-hover); }
.model-option.selected { background: var(--accent-soft); color: var(--accent); }
.model-option.unavailable { opacity: 0.4; cursor: not-allowed; }

.model-option-name { font-weight: 500; color: var(--text-primary); }
.model-option-id   { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }

/* ── Chat Container ────────────────────────────── */
#chat-view {
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

/* ── Welcome Screen ────────────────────────────── */
.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.welcome-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 20px;
  box-shadow: 0 0 40px rgba(79, 142, 247, 0.3);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}

.welcome-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}

.welcome-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  max-width: 400px;
  line-height: 1.6;
}

.welcome-suggestions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 560px;
}

.suggestion-chip {
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  text-align: left;
  font-family: var(--font-main);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.suggestion-chip:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text-primary);
}
.suggestion-chip-icon {
  font-size: 16px;
  margin-bottom: 6px;
  display: block;
}

/* ── Messages ──────────────────────────────────── */
.message {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  animation: fadeIn 0.2s ease;
  max-width: 100%;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 2px;
}

.message.user .message-avatar {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: white;
}

.message.assistant .message-avatar {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-size: 16px;
}

.message-content {
  flex: 1;
  max-width: calc(100% - 44px);
}

.message.user .message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message.user .message-bubble {
  background: var(--accent);
  color: white;
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
  max-width: 75%;
}

.message.assistant .message-bubble {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm);
  width: 100%;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.message.user .message-meta { flex-direction: row-reverse; }

.message-actions {
  display: none;
  gap: 4px;
  margin-top: 6px;
}
.message:hover .message-actions { display: flex; }

.msg-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font-main);
}
.msg-action-btn:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

/* ── Image in Message ──────────────────────────── */
.message-image {
  max-width: 300px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
  margin-bottom: 8px;
}
.message-image img { width: 100%; display: block; }

/* ── Chat Input Area ───────────────────────────── */
.chat-input-area {
  padding: 12px 16px 16px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.chat-input-wrap {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 10px 12px;
  transition: var(--transition);
}
.chat-input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* Attachment preview */
.attachment-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.attachment-preview:empty { display: none; }

.attachment-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 11px;
  color: var(--text-secondary);
}
.attachment-chip .remove-btn {
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}
.attachment-chip .remove-btn:hover { color: var(--accent-3); }

/* Text input row */
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

#chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-main);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px 0;
}
#chat-input::placeholder { color: var(--text-muted); }

.input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Send / Stop button */
.send-btn {
  width: 34px;
  height: 34px;
  background: var(--accent);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  color: white;
  flex-shrink: 0;
}
.send-btn:hover { background: #6aa0ff; transform: scale(1.05); }
.send-btn:disabled { background: var(--bg-hover); cursor: not-allowed; transform: none; }

.send-btn.stop-mode {
  background: var(--accent-3);
}
.send-btn.stop-mode:hover { background: #ff8080; }

/* Voice button */
.voice-btn {
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  color: var(--text-muted);
}
.voice-btn:hover { border-color: var(--accent); color: var(--accent); }
.voice-btn.recording {
  background: rgba(247, 106, 106, 0.1);
  border-color: var(--accent-3);
  color: var(--accent-3);
  animation: pulse 1s ease infinite;
}

/* Input hints */
.input-hints {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding: 0 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.input-hint-left { display: flex; align-items: center; gap: 8px; }

kbd {
  display: inline-block;
  padding: 1px 5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

/* ── Data Analysis View ────────────────────────── */
#data-view {
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.data-upload-zone {
  margin: 20px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-xl);
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
  background: var(--bg-surface);
}
.data-upload-zone:hover,
.data-upload-zone.dragover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.data-upload-zone h3 {
  font-size: 16px;
  color: var(--text-primary);
  margin: 12px 0 6px;
}
.data-upload-zone p {
  font-size: 13px;
  color: var(--text-muted);
}

.data-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.data-stats-bar {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.stat-chip .stat-value {
  font-weight: 600;
  color: var(--text-primary);
}
.stat-chip .stat-label {
  color: var(--text-muted);
}

.data-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.data-sidebar {
  width: 280px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 12px;
  flex-shrink: 0;
}

.data-chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.data-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Result card */
.result-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  animation: fadeIn 0.3s ease;
}
.result-card-header {
  padding: 10px 14px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
}
.result-card-body { padding: 14px; }

/* Chart container */
.chart-container {
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-base);
}
.chart-container img { width: 100%; display: block; }

/* Code execution output */
.exec-output {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--success);
  background: var(--bg-base);
  padding: 10px;
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  word-break: break-word;
}
.exec-error {
  color: var(--accent-3);
}

/* ── Tools View ────────────────────────────────── */
#tools-view {
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.tool-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px;
  transition: var(--transition);
  cursor: pointer;
}
.tool-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-accent);
}

.tool-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 12px;
}

.tool-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.tool-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ── Humanizer / Detector ──────────────────────── */
.tool-workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
  padding: 16px;
}

.tool-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tool-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tool-panel-body {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
}

textarea.tool-input {
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-main);
  font-size: 14px;
  line-height: 1.6;
  resize: none;
}

/* AI Score bar */
.ai-score-bar {
  height: 8px;
  background: var(--bg-elevated);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}
.ai-score-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}