// ==================== DASHBOARD.JS — NEXTLINK ISP DASHBOARD V2 ====================

async function loadDashboard() {
  const dashboardDiv = document.getElementById('dashboard');

  dashboardDiv.innerHTML = `
    <div class="hero-panel dashboard-hero-v2">
      <div>
        <span class="eyebrow">ISP Operations Overview</span>
        <h2>Nextlink Networks Control Center</h2>
        <p>Monitor customers, payments, packages, support issues, and connection health from one clean command center.</p>
      </div>
      <div class="hero-metrics">
        <div class="hero-metric">
          <small>Network Status</small>
          <strong id="network-status-text">🟢 Operational</strong>
        </div>
        <div class="hero-metric cyan">
          <small>Last Refreshed</small>
          <strong id="last-refresh">—</strong>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <button class="quick-action" onclick="showSection('customers')">+ Add / Manage Customer</button>
      <button class="quick-action" onclick="showSection('billing')">+ Create Bill</button>
      <button class="quick-action" onclick="showSection('packages')">+ Manage Package</button>
      <button class="quick-action" onclick="showSection('support')">+ New Ticket</button>
      <button class="quick-action ghost" onclick="showSection('analytics')">View Analytics →</button>
    </div>

    <div class="stats-grid enhanced">
      ${statCard('Total Customers', 'total-customers', 'Registered users', 'cyan')}
      ${statCard('Active', 'active-customers', 'Connected accounts', 'green')}
      ${statCard('Online Now', 'online-customers', 'Live connections', 'purple')}
      ${statCard('Open Tickets', 'open-tickets', 'Support requests', 'orange')}
      ${statCard('Pending Bills', 'pending-bills', 'Unpaid invoices', 'pink')}
      ${statCard('Total Revenue', 'total-revenue', 'Paid bills', 'green')}
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head">
          <div>
            <h3>Recent Customers</h3>
            <p>Latest registered users. Click a customer to view profile.</p>
          </div>
          <button class="btn-secondary" onclick="showSection('customers')">View All →</button>
        </div>
        <div id="recent-customers"><div class="skeleton" style="height:210px;border-radius:10px"></div></div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><h3>Operations Snapshot</h3><p>Live business health summary</p></div>
        </div>
        <div id="system-summary" class="summary-list"><div class="skeleton" style="height:210px;border-radius:10px"></div></div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head">
          <div><h3>Package Distribution</h3><p>Customers grouped by service plan</p></div>
        </div>
        <div id="package-distribution"><div class="skeleton" style="height:160px;border-radius:10px"></div></div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><h3>Billing Overview</h3><p>Paid and pending invoice performance</p></div>
        </div>
        <div id="billing-overview"><div class="skeleton" style="height:160px;border-radius:10px"></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h3>Recent Support Activity</h3><p>Latest customer support tickets</p></div>
        <button class="btn-secondary" onclick="showSection('support')">Open Support →</button>
      </div>
      <div id="recent-activity"><div class="skeleton" style="height:150px;border-radius:10px"></div></div>
    </div>
  `;

  const now = new Date();
  const el = document.getElementById('last-refresh');
  if (el) el.textContent = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  try {
    const [usersSnapshot, billsSnapshot, ticketsSnapshot, packagesSnapshot, connectionsSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('billing').get(),
      db.collection('supportTickets').get(),
      db.collection('packages').get(),
      safeGetCollection('connections')
    ]);

    const stats = calculateStats(usersSnapshot, billsSnapshot, ticketsSnapshot, packagesSnapshot, connectionsSnapshot);

    animateCount('total-customers', stats.totalCustomers);
    animateCount('active-customers', stats.activeCustomers);
    animateCount('online-customers', stats.onlineCustomers);
    animateCount('open-tickets', stats.openTickets);
    animateCount('pending-bills', stats.pendingBills);
    document.getElementById('total-revenue').textContent = formatMoney(stats.totalRevenue);

    renderRecentCustomers(usersSnapshot, connectionsSnapshot);
    renderSystemSummary(stats);
    renderPackageDistribution(stats.packageCounts);
    renderBillingOverview(stats);
    renderRecentActivityFromSnapshot(ticketsSnapshot);
  } catch (error) {
    console.error('Dashboard error:', error);
    dashboardDiv.insertAdjacentHTML('beforeend', `<div class="alert-error">Failed to load dashboard data. Check Firestore rules and admin access.</div>`);
  }
}

async function safeGetCollection(name) {
  try { return await db.collection(name).get(); }
  catch (e) { console.warn(`Could not read ${name}`, e); return { size: 0, empty: true, forEach: () => {} }; }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 650;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function calculateStats(usersSnapshot, billsSnapshot, ticketsSnapshot, packagesSnapshot, connectionsSnapshot) {
  let activeCustomers = 0, suspendedCustomers = 0, pendingCustomers = 0;
  let packageCounts = {};

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const status = (user.status || 'pending').toLowerCase();
    const plan = user.plan || user.packageName || user.package || 'No Plan';

    if (status === 'active') activeCustomers++;
    else if (status === 'suspended') suspendedCustomers++;
    else pendingCustomers++;

    packageCounts[plan] = (packageCounts[plan] || 0) + 1;
  });

  let paidBills = 0, pendingBills = 0, totalRevenue = 0, pendingAmount = 0, totalBillingAmount = 0;
  billsSnapshot.forEach(doc => {
    const bill = doc.data();
    const status = (bill.paymentStatus || bill.status || 'pending').toLowerCase();
    const amount = Number(bill.amount || bill.total || bill.price || 0);
    totalBillingAmount += amount;
    if (status === 'paid') { paidBills++; totalRevenue += amount; }
    else { pendingBills++; pendingAmount += amount; }
  });

  let openTickets = 0, closedTickets = 0;
  ticketsSnapshot.forEach(doc => {
    const t = doc.data();
    const status = (t.status || 'open').toLowerCase();
    if (status === 'open' || status === 'in-progress') openTickets++;
    if (status === 'closed' || status === 'resolved') closedTickets++;
  });

  let onlineCustomers = 0;
  connectionsSnapshot.forEach(doc => {
    const c = doc.data();
    if ((c.status || '').toLowerCase() === 'online') onlineCustomers++;
  });

  return {
    totalCustomers: usersSnapshot.size,
    activeCustomers, suspendedCustomers, pendingCustomers,
    onlineCustomers,
    packages: packagesSnapshot.size,
    totalBills: billsSnapshot.size, paidBills, pendingBills,
    totalRevenue, pendingAmount, totalBillingAmount,
    totalTickets: ticketsSnapshot.size, openTickets, closedTickets,
    packageCounts
  };
}

function statCard(title, id, subtitle, colorClass) {
  return `
    <div class="stat-card ${colorClass}">
      <div class="stat-label">${title}</div>
      <h2 id="${id}">—</h2>
      <span class="stat-sub">${subtitle}</span>
    </div>`;
}

function renderRecentCustomers(snapshot, connectionsSnapshot) {
  const container = document.getElementById('recent-customers');
  if (snapshot.empty) { container.innerHTML = emptyState('👥', 'No customers yet.'); return; }

  const connectionMap = {};
  connectionsSnapshot.forEach(doc => connectionMap[doc.id] = doc.data());

  let users = [];
  snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data(), connection: connectionMap[doc.id] || {} }));
  users = users.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)).slice(0, 6);

  let html = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Account</th><th>Plan</th><th>Status</th><th>Connection</th></tr></thead><tbody>`;

  users.forEach(u => {
    const online = (u.connection.status || '').toLowerCase() === 'online';
    html += `<tr class="clickable-row" onclick="openCustomerDrawer('${u.id}')">
      <td><strong>${escapeHtml(getCustomerName(u))}</strong><small>${escapeHtml(u.email || '—')}</small></td>
      <td class="td-mono">${escapeHtml(u.accountNumber || '—')}</td>
      <td>${escapeHtml(u.plan || u.packageName || u.package || 'Pending')}</td>
      <td><span class="status ${escapeHtml(u.status || 'pending')}">${escapeHtml(u.status || 'pending')}</span></td>
      <td><span class="connection-pill ${online ? 'online' : 'offline'}">${online ? 'Online' : 'Offline'}</span></td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function renderSystemSummary(data) {
  const activationRate = data.totalCustomers ? Math.round((data.activeCustomers / data.totalCustomers) * 100) : 0;
  const collectionRate = data.totalBills ? Math.round((data.paidBills / data.totalBills) * 100) : 0;

  document.getElementById('system-summary').innerHTML = `
    <div class="summary-item"><span>Total packages</span><strong>${data.packages}</strong></div>
    <div class="summary-item"><span>Total bills</span><strong>${data.totalBills}</strong></div>
    <div class="summary-item"><span>Collection rate</span><strong>${collectionRate}%</strong></div>
    <div class="summary-item"><span>Pending amount</span><strong>${formatMoney(data.pendingAmount)}</strong></div>
    <div class="summary-item"><span>Suspended accounts</span><strong>${data.suspendedCustomers}</strong></div>
    <div class="summary-item"><span>Activation rate</span><strong>${activationRate}%</strong></div>
  `;
}

function renderPackageDistribution(packageCounts) {
  const container = document.getElementById('package-distribution');
  const entries = Object.entries(packageCounts);
  if (!entries.length) { container.innerHTML = emptyState('📦', 'No package data.'); return; }

  const max = Math.max(...entries.map(([, c]) => c));
  entries.sort((a, b) => b[1] - a[1]);

  container.innerHTML = entries.map(([plan, count]) => {
    const width = max ? Math.round((count / max) * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-info"><span>${escapeHtml(plan)}</span><strong>${count}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:0%" data-target="${width}"></div></div>
    </div>`;
  }).join('');

  setTimeout(() => container.querySelectorAll('.bar-fill').forEach(bar => { bar.style.width = bar.dataset.target + '%'; }), 100);
}

function renderBillingOverview(data) {
  const total = data.paidBills + data.pendingBills;
  const paidPercent = total ? Math.round((data.paidBills / total) * 100) : 0;

  document.getElementById('billing-overview').innerHTML = `
    <div class="billing-ring" style="--pct: ${paidPercent}%">
      <div><strong>${paidPercent}%</strong><span>Paid</span></div>
    </div>
    <div class="summary-list">
      <div class="summary-item"><span>Revenue collected</span><strong>${formatMoney(data.totalRevenue)}</strong></div>
      <div class="summary-item"><span>Pending amount</span><strong>${formatMoney(data.pendingAmount)}</strong></div>
      <div class="summary-item"><span>Paid bills</span><strong>${data.paidBills}</strong></div>
      <div class="summary-item"><span>Pending bills</span><strong>${data.pendingBills}</strong></div>
    </div>`;
}

function renderRecentActivityFromSnapshot(ticketsSnapshot) {
  const container = document.getElementById('recent-activity');
  let tickets = [];
  ticketsSnapshot.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));
  tickets = tickets.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)).slice(0, 5);

  if (!tickets.length) { container.innerHTML = emptyState('🎧', 'No support activity yet.'); return; }

  let html = `<div class="table-wrap"><table>
    <thead><tr><th>Customer</th><th>Issue</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead><tbody>`;

  tickets.forEach(t => {
    html += `<tr ${t.customerId ? `class="clickable-row" onclick="openCustomerDrawer('${t.customerId}')"` : ''}>
      <td><strong>${escapeHtml(t.customerName || t.name || 'Unknown')}</strong><small>${escapeHtml(t.accountNumber || '')}</small></td>
      <td>${escapeHtml(t.issue || t.subject || 'No subject')}</td>
      <td><span class="ticket-priority priority-${escapeHtml(t.priority || 'medium')}">${escapeHtml(t.priority || 'medium')}</span></td>
      <td><span class="status ${escapeHtml(t.status || 'open')}">${escapeHtml(t.status || 'open')}</span></td>
      <td>${formatDate(t.createdAt)}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

window.loadDashboard = loadDashboard;
