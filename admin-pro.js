// ==================== ADMIN-PRO.JS — NEXTLINK PRO ISP UPGRADES ====================
// Loaded last. Adds operations center, global search, bulk monthly billing,
// quick suspend/activate, connection status controls, and admin activity logs.

(function () {
  const PRO_VERSION = '2.0.0';
  window.NextLinkProVersion = PRO_VERSION;

  function nowField() { return firebase.firestore.FieldValue.serverTimestamp(); }

  async function logAdminAction(action, details = {}) {
    try {
      const admin = auth.currentUser;
      await db.collection('adminLogs').add({
        action,
        details,
        adminUid: admin?.uid || null,
        adminEmail: admin?.email || null,
        createdAt: nowField()
      });
    } catch (e) {
      console.warn('Admin log failed:', e.message);
    }
  }
  window.logAdminAction = logAdminAction;

  async function getAllUsers() {
    const snap = await db.collection('users').get();
    const users = [];
    snap.forEach(d => users.push({ id: d.id, ...d.data() }));
    return users;
  }

  function moneyNumber(value) {
    return Number(value || 0).toLocaleString('en-KE');
  }

  function monthLabel() {
    return new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' });
  }

  // ── Add Operations section to the existing portal ───────────────────────────
  function installOperationsNav() {
    if (document.getElementById('operations')) return;

    const menu = document.getElementById('sidebar-menu');
    if (menu) {
      const li = document.createElement('li');
      li.setAttribute('onclick', "showSection('operations')");
      li.innerHTML = `<span class="nav-icon">⚙️</span> Operations`;
      menu.appendChild(li);
    }

    const main = document.querySelector('main.content');
    if (main) {
      const section = document.createElement('section');
      section.id = 'operations';
      section.className = 'section hidden';
      main.appendChild(section);
    }
  }

  const baseShowSection = window.showSection;
  window.showSection = function patchedShowSection(sectionId) {
    installOperationsNav();
    if (typeof baseShowSection === 'function') baseShowSection(sectionId);
    window._currentSection = sectionId;

    const titles = { operations: 'Operations Center' };
    if (titles[sectionId]) {
      const pageTitle = document.getElementById('page-title');
      if (pageTitle) pageTitle.textContent = titles[sectionId];
    }

    if (sectionId === 'operations') loadOperations();
  };

  // ── Operations Center UI ────────────────────────────────────────────────────
  window.loadOperations = async function loadOperations() {
    const container = document.getElementById('operations');
    if (!container) return;

    container.innerHTML = `
      <div class="hero-panel ops-hero">
        <div>
          <span class="eyebrow">Admin Control</span>
          <h2>Nextlink Operations Center</h2>
          <p>Run bulk billing, update customer connection status, suspend accounts, and audit admin activity.</p>
        </div>
        <div class="hero-metrics">
          <div class="hero-metric cyan"><small>Portal</small><strong>Pro v${PRO_VERSION}</strong></div>
        </div>
      </div>

      <div class="stats-grid enhanced" id="ops-stats">
        <div class="stat-card cyan"><div class="stat-label">Active Customers</div><h2 id="ops-active">—</h2><span class="stat-sub">Ready for billing</span></div>
        <div class="stat-card green"><div class="stat-label">Online</div><h2 id="ops-online">—</h2><span class="stat-sub">Live connections</span></div>
        <div class="stat-card orange"><div class="stat-label">Pending Bills</div><h2 id="ops-pending">—</h2><span class="stat-sub">Need follow-up</span></div>
        <div class="stat-card pink"><div class="stat-label">Open Tickets</div><h2 id="ops-tickets">—</h2><span class="stat-sub">Support workload</span></div>
      </div>

      <div class="dashboard-grid">
        <div class="card pro-card">
          <div class="card-head"><div><h3>Bulk Monthly Billing</h3><p>Generate bills for all active customers using their plan/package price.</p></div></div>
          <div class="form-grid">
            <div><label>Default Amount (KES)</label><input id="bulk-bill-amount" type="number" min="0" placeholder="2500"></div>
            <div><label>Due Date</label><input id="bulk-bill-due" type="text" placeholder="30 June 2026"></div>
            <div class="full"><label>Description</label><input id="bulk-bill-desc" type="text" value="Monthly internet subscription"></div>
          </div>
          <div class="modal-actions"><button class="btn-primary" onclick="createMonthlyBillsForActiveCustomers()">Generate Bills</button></div>
          <p class="muted-note">This updates <b>billing/{uid}</b>, so the Android app sees the bill instantly.</p>
        </div>

        <div class="card pro-card">
          <div class="card-head"><div><h3>Customer Connection Control</h3><p>Update online/offline status, speeds, data usage and connected devices.</p></div></div>
          <div class="form-grid">
            <div class="full"><label>Customer</label><select id="ops-customer-select"><option value="">Loading customers…</option></select></div>
            <div><label>Status</label><select id="ops-connection-status"><option value="online">Online</option><option value="offline">Offline</option><option value="maintenance">Maintenance</option></select></div>
            <div><label>Devices Connected</label><input id="ops-devices" type="number" min="0" value="0"></div>
            <div><label>Download Mbps</label><input id="ops-download" type="number" min="0" step="0.1" value="0"></div>
            <div><label>Upload Mbps</label><input id="ops-upload" type="number" min="0" step="0.1" value="0"></div>
            <div><label>Data Used GB</label><input id="ops-data" type="number" min="0" step="0.1" value="0"></div>
          </div>
          <div class="modal-actions"><button class="btn-primary" onclick="saveConnectionControl()">Update Connection</button></div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card pro-card">
          <div class="card-head"><div><h3>Account Actions</h3><p>Suspend or reactivate a selected customer account.</p></div></div>
          <div class="form-grid">
            <div class="full"><label>Customer</label><select id="ops-account-select"><option value="">Loading customers…</option></select></div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" onclick="setSelectedCustomerStatus('active')">Activate</button>
            <button class="btn-secondary danger-soft" onclick="setSelectedCustomerStatus('suspended')">Suspend</button>
          </div>
        </div>

        <div class="card pro-card">
          <div class="card-head"><div><h3>Admin Activity Logs</h3><p>Latest portal actions for accountability.</p></div></div>
          <div id="admin-log-list" class="summary-list"><div class="skeleton" style="height:160px;border-radius:10px"></div></div>
        </div>
      </div>
    `;

    await Promise.all([populateOpsCustomers(), renderOpsStats(), renderAdminLogs()]);
  };

  window.populateOpsCustomers = async function populateOpsCustomers() {
    const users = await getAllUsers();
    users.sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b)));
    const options = `<option value="">Select customer</option>` + users.map(u => {
      const name = getCustomerName(u);
      const acc = u.accountNumber || u.id;
      return `<option value="${escapeHtml(u.id)}">${escapeHtml(name)} — ${escapeHtml(acc)}</option>`;
    }).join('');
    ['ops-customer-select', 'ops-account-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = options;
    });
  };

  window.renderOpsStats = async function renderOpsStats() {
    try {
      const [users, conns, bills, tickets] = await Promise.all([
        db.collection('users').get(), db.collection('connections').get().catch(() => ({ forEach: () => {} })),
        db.collection('billing').get(), db.collection('supportTickets').get()
      ]);
      let active = 0, online = 0, pending = 0, open = 0;
      users.forEach(d => { if ((d.data().status || '').toLowerCase() === 'active') active++; });
      conns.forEach(d => { if ((d.data().status || '').toLowerCase() === 'online') online++; });
      bills.forEach(d => { if ((d.data().paymentStatus || d.data().status || 'pending').toLowerCase() !== 'paid') pending++; });
      tickets.forEach(d => { const s = (d.data().status || 'open').toLowerCase(); if (s !== 'closed' && s !== 'resolved') open++; });
      [['ops-active', active], ['ops-online', online], ['ops-pending', pending], ['ops-tickets', open]].forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
    } catch (e) { console.warn(e); }
  };

  window.createMonthlyBillsForActiveCustomers = async function createMonthlyBillsForActiveCustomers() {
    const defaultAmount = Number(document.getElementById('bulk-bill-amount')?.value || 0);
    const dueDate = document.getElementById('bulk-bill-due')?.value.trim() || '--';
    const description = document.getElementById('bulk-bill-desc')?.value.trim() || 'Monthly internet subscription';
    if (!defaultAmount && !confirmAction('No default amount entered. Continue using customer package prices only?')) return;

    try {
      const users = (await getAllUsers()).filter(u => (u.status || '').toLowerCase() === 'active');
      if (!users.length) { showToast('No active customers found.', 'error'); return; }

      const batch = db.batch();
      users.forEach(u => {
        const amount = Number(u.packagePrice || u.price || u.planPrice || defaultAmount || 0);
        const ref = db.collection('billing').doc(u.id);
        batch.set(ref, {
          uid: u.id,
          customerId: u.id,
          customerName: getCustomerName(u),
          amount,
          total: amount,
          dueDate,
          billDueDate: dueDate,
          paymentStatus: 'pending',
          status: 'pending',
          description,
          items: [{ label: description, amountKes: amount }],
          billingMonth: monthLabel(),
          updatedAt: nowField(),
          createdAt: nowField()
        }, { merge: true });
        batch.set(db.collection('users').doc(u.id), { billDueDate: dueDate, updatedAt: nowField() }, { merge: true });
      });
      await batch.commit();
      await logAdminAction('bulk_monthly_billing', { count: users.length, dueDate, description });
      showToast(`Generated bills for ${users.length} active customers.`, 'success');
      renderOpsStats();
    } catch (e) {
      console.error(e);
      showToast('Bulk billing failed. Check Firestore permissions.', 'error');
    }
  };

  window.saveConnectionControl = async function saveConnectionControl() {
    const uid = document.getElementById('ops-customer-select')?.value;
    if (!uid) { showToast('Select a customer first.', 'error'); return; }
    const data = {
      status: document.getElementById('ops-connection-status')?.value || 'offline',
      devicesConnected: Number(document.getElementById('ops-devices')?.value || 0),
      downloadMbps: Number(document.getElementById('ops-download')?.value || 0),
      uploadMbps: Number(document.getElementById('ops-upload')?.value || 0),
      dataUsedGB: Number(document.getElementById('ops-data')?.value || 0),
      lastUpdated: nowField()
    };
    try {
      await db.collection('connections').doc(uid).set(data, { merge: true });
      await logAdminAction('connection_update', { uid, ...data });
      showToast('Connection updated. Mobile dashboard will reflect it.', 'success');
      renderOpsStats();
    } catch (e) { showToast('Failed to update connection.', 'error'); }
  };

  window.setSelectedCustomerStatus = async function setSelectedCustomerStatus(status) {
    const uid = document.getElementById('ops-account-select')?.value;
    if (!uid) { showToast('Select a customer first.', 'error'); return; }
    if (!confirmAction(`Set this customer to ${status}?`)) return;
    try {
      await db.collection('users').doc(uid).set({ status, updatedAt: nowField() }, { merge: true });
      if (status === 'suspended') await db.collection('connections').doc(uid).set({ status: 'offline', lastUpdated: nowField() }, { merge: true });
      await logAdminAction('customer_status_change', { uid, status });
      showToast(`Customer ${status}.`, 'success');
      renderOpsStats();
    } catch (e) { showToast('Failed to update customer status.', 'error'); }
  };

  window.renderAdminLogs = async function renderAdminLogs() {
    const box = document.getElementById('admin-log-list');
    if (!box) return;
    try {
      let snap;
      try { snap = await db.collection('adminLogs').orderBy('createdAt', 'desc').limit(8).get(); }
      catch { snap = await db.collection('adminLogs').limit(8).get(); }
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      if (!rows.length) { box.innerHTML = emptyState('📝', 'No admin logs yet.', 'Actions will appear here.'); return; }
      box.innerHTML = rows.map(r => `
        <div class="summary-row">
          <span><b>${escapeHtml(r.action || 'action')}</b><small>${escapeHtml(r.adminEmail || 'admin')} • ${formatDateTime(r.createdAt)}</small></span>
          <strong>LOG</strong>
        </div>`).join('');
    } catch (e) { box.innerHTML = `<div class="alert-error">Could not load admin logs.</div>`; }
  };

  // ── Global Search ───────────────────────────────────────────────────────────
  function installGlobalSearch() {
    if (document.getElementById('global-search-input')) return;
    const actions = document.querySelector('.topbar-actions');
    if (!actions) return;
    actions.insertAdjacentHTML('afterbegin', `
      <div class="global-search">
        <input id="global-search-input" type="text" placeholder="Search customers, bills, tickets…" onkeydown="if(event.key==='Enter') runGlobalSearch()">
        <button class="btn-secondary" onclick="runGlobalSearch()">Search</button>
      </div>
    `);
    document.body.insertAdjacentHTML('beforeend', `<div id="global-search-modal" class="modal hidden"><div class="modal-content" style="max-width:780px"><div class="modal-head"><h3>Global Search</h3><button class="close-btn" onclick="closeGlobalSearch()">×</button></div><div id="global-search-results"></div></div></div>`);
  }

  window.closeGlobalSearch = function closeGlobalSearch() {
    document.getElementById('global-search-modal')?.classList.add('hidden');
  };

  window.runGlobalSearch = async function runGlobalSearch() {
    const q = (document.getElementById('global-search-input')?.value || '').trim().toLowerCase();
    const modal = document.getElementById('global-search-modal');
    const out = document.getElementById('global-search-results');
    if (!q) { showToast('Type something to search.', 'error'); return; }
    modal.classList.remove('hidden');
    out.innerHTML = `<div class="skeleton" style="height:140px;border-radius:10px"></div>`;
    try {
      const [users, bills, tickets] = await Promise.all([db.collection('users').get(), db.collection('billing').get(), db.collection('supportTickets').get()]);
      const results = [];
      users.forEach(d => { const u = { id: d.id, ...d.data() }; const hay = [getCustomerName(u), u.email, u.phone, u.accountNumber, u.plan, u.status].join(' ').toLowerCase(); if (hay.includes(q)) results.push({ type: 'Customer', title: getCustomerName(u), sub: `${u.email || 'No email'} • ${u.accountNumber || d.id}`, action: `openCustomerDrawer('${d.id}')` }); });
      bills.forEach(d => { const b = { id: d.id, ...d.data() }; const hay = [b.customerName, b.amount, b.total, b.dueDate, b.paymentStatus, b.status].join(' ').toLowerCase(); if (hay.includes(q)) results.push({ type: 'Bill', title: b.customerName || d.id, sub: `${formatMoney(b.amount || b.total || 0)} • ${b.paymentStatus || b.status || 'pending'}`, action: `showSection('billing')` }); });
      tickets.forEach(d => { const t = { id: d.id, ...d.data() }; const hay = [t.customerName, t.issue, t.subject, t.phone, t.accountNumber, t.status].join(' ').toLowerCase(); if (hay.includes(q)) results.push({ type: 'Ticket', title: t.issue || t.subject || 'Ticket', sub: `${t.customerName || 'Unknown'} • ${t.status || 'open'}`, action: `showSection('support')` }); });
      out.innerHTML = results.length ? results.slice(0, 20).map(r => `<div class="search-result-row" onclick="closeGlobalSearch(); ${r.action}"><span><b>${escapeHtml(r.title)}</b><small>${escapeHtml(r.type)} • ${escapeHtml(r.sub)}</small></span><strong>Open</strong></div>`).join('') : emptyState('🔎', 'No matching result.', 'Try name, phone, account number, bill status, or ticket issue.');
    } catch (e) { out.innerHTML = `<div class="alert-error">Search failed. Check admin permissions.</div>`; }
  };

  // ── Better refresh that respects new Operations page ────────────────────────
  const baseRefresh = window.refreshCurrentSection;
  window.refreshCurrentSection = function proRefreshCurrentSection() {
    const section = window._currentSection || 'dashboard';
    showToast(`Refreshing ${section}…`, 'info', 1200);
    window.showSection(section);
  };

  // Install after page scripts and auth UI exist.
  document.addEventListener('DOMContentLoaded', () => {
    installOperationsNav();
    installGlobalSearch();
  });
})();
