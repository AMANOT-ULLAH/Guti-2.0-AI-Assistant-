/* ═══════════════════════════════════════════════
   GUTI 2.0 — Sidebar Module
   ═══════════════════════════════════════════════ */

const Sidebar = {
  activeSection: 'chat',
  searchQuery: '',
  history: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Toggle sidebar
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.toggle());

    // New chat
    document.getElementById('new-chat-btn')?.addEventListener('click', () => {
      ChatView.newChat();
    });

    // Search
    document.getElementById('sidebar-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderHistory();
    });

    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (section) this.switchSection(section);
      });
    });

    // User profile click
    document.getElementById('user-profile')?.addEventListener('click', () => {
      if (!Auth.isLoggedIn()) showAuthModal('login');
      else this.showUserMenu();
    });
  },

  toggle() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
  },

  switchSection(section) {
    this.activeSection = section;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Show correct view
    document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`${section}-view`);
    if (target) target.classList.add('active');

    // Update topbar title
    const titles = {
      chat:      '💬 Chat',
      data:      '📊 Data Analysis',
      tools:     '🛠 Research & Writing Tools',
    };
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = titles[section] || section;
  },

  async loadHistory() {
    if (!Auth.isLoggedIn()) return;
    try {
      const res = await API.get('/history/list');
      this.history = res.items || [];
      this.renderHistory();
    } catch {
      this.history = [];
    }
  },

  clearHistory() {
    this.history = [];
    this.renderHistory();
  },

  renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    let items = this.history;

    // Filter by search
    if (this.searchQuery) {
      items = items.filter(i =>
        (i.title || '').toLowerCase().includes(this.searchQuery)
      );
    }

    if (!items.length) {
      container.innerHTML = `
        <div class="history-empty">
          <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          ${Auth.isLoggedIn() ? 'No chats yet' : 'Login to save history'}
        </div>`;
      return;
    }

    // Group by date
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups    = { Today: [], Yesterday: [], Earlier: [] };

    items.forEach(item => {
      const d = new Date(item.updated_at).toDateString();
      if (d === today)         groups.Today.push(item);
      else if (d === yesterday) groups.Yesterday.push(item);
      else                      groups.Earlier.push(item);
    });

    const icons = { chat: '💬', data: '📊', image: '🖼', tools: '🛠' };

    let html = '';
    for (const [label, group] of Object.entries(groups)) {
      if (!group.length) continue;
      html += `<div class="history-group">
        <div class="history-group-label">${label}</div>`;
      group.forEach(item => {
        const icon = icons[item.session_type] || '💬';
        const title = item.title || 'Untitled';
        html += `
          <div class="history-item" data-id="${item.id}" onclick="Sidebar.openSession('${item.id}', '${item.session_type}')">
            <div class="history-item-icon ${item.session_type || 'chat'}">${icon}</div>
            <span class="history-item-text">${title}</span>
            <div class="history-item-actions">
              <button class="history-action-btn" onclick="event.stopPropagation(); Sidebar.deleteSession('${item.id}')" title="Delete">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  },

  openSession(id, type) {
    // Mark active
    document.querySelectorAll('.history-item').forEach(i => {
      i.classList.toggle('active', i.dataset.id === id);
    });

    // Switch to correct section
    this.switchSection(type || 'chat');

    // Load messages
    if (type === 'chat' || !type) {
      ChatView.loadSession(id);
    }
  },

  async deleteSession(id) {
    try {
      await API.delete(`/history/${id}`);
      this.history = this.history.filter(i => i.id !== id);
      this.renderHistory();
      Toast.success('Deleted');
    } catch {
      Toast.error('Delete failed');
    }
  },

  addToHistory(session) {
    this.history.unshift(session);
    this.renderHistory();
  },

  showUserMenu() {
    // Simple logout option
    if (confirm('Logout?')) handleLogout();
  },
};
