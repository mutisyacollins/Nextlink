// ==================== ANALYTICS.JS — NEXTLINK ANALYTICS PAGE ====================

let revenueChartInstance = null;
let customerChartInstance = null;
let statusChartInstance = null;

async function loadAnalytics() {
  const container = document.getElementById('analytics');
  container.innerHTML = `
    <div class="hero-panel analytics-hero">
      <div>
        <span class="eyebrow">Business Intelligence</span>
        <h2>Nextlink Analytics Center</h2>
        <p>Track revenue, customer growth, billing performance, support load, and connection health.</p>
      </div>
      <div class="hero-metrics">
        <div class="hero-metric cyan"><small>Period</small><strong>This Year</strong></div>
      </div>
    </div>

    <div class="stats-grid enhanced">
      ${analyticsCard('Revenue', 'analytics-revenue', 'Collected payments', 'green')}
      ${analyticsCard('Pending', 'analytics-pending', 'Outstanding bills', 'orange')}
      ${analyticsCard('Customers', 'analytics-customers', 'Registered accounts', 'cyan')}
      ${analyticsCard('Active', 'analytics-active', 'Active accounts', 'green')}
      ${analyticsCard('Online', 'analytics-online', 'Currently online', 'purple')}
      ${analyticsCard('Tickets', 'analytics-tickets', 'Open support cases', 'pink')}
    </div>

    <div class="dashboard-grid">
      <div class="card chart-card">
        <div class="card-head"><div><h3>Revenue Trend</h3><p>Monthly paid bill totals</p></div></div>
        <canvas id="revenueChart" height="120"></canvas>
      </div>
      <div class="card chart-card">
        <div class="card-head"><div><h3>Customer Status</h3><p>Active, pending and suspended</p></div></div>
        <canvas id="statusChart" height="170"></canvas>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card chart-card">
        <div class="card-head"><div><h3>Customer Growth</h3><p>New registrations by month</p></div></div>
        <canvas id="customerChart" height="120"></canvas>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Performance Summary</h3><p>Key operational numbers</p></div></div>
        <div id="analytics-summary" class="summary-list"><div class="skeleton" style="height:200px;border-radius:10px"></div></div>
      </div>
    </div>
  `;

  try {
    const [usersSnapshot, billsSnapshot, ticketsSnapshot, connectionsSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('billing').get(),
      db.collection('supportTickets').get(),
      safeGetAnalyticsCollection('connections')
    ]);

    const analytics = buildAnalytics(usersSnapshot, billsSnapshot, ticketsSnapshot, connectionsSnapshot);
    renderAnalyticsNumbers(analytics);
    renderAnalyticsSummary(analytics);
    renderRevenueChart(analytics.monthLabels, analytics.revenueByMonth);
    renderCustomerGrowthChart(analytics.monthLabels, analytics.customersByMonth);
    renderStatusChart(analytics.statusCounts);
  } catch (error) {
    console.error('Analytics error:', error);
    container.insertAdjacentHTML('beforeend', `<div class="alert-error">Could not load analytics. Check Firestore rules and collections.</div>`);
  }
}

async function safeGetAnalyticsCollection(name) {
  try { return await db.collection(name).get(); }
  catch { return { size: 0, empty: true, forEach: () => {} }; }
}

function analyticsCard(title, id, subtitle, colorClass) {
  return `<div class="stat-card ${colorClass}">
    <div class="stat-label">${title}</div>
    <h2 id="${id}">—</h2>
    <span class="stat-sub">${subtitle}</span>
  </div>`;
}

function buildAnalytics(usersSnapshot, billsSnapshot, ticketsSnapshot, connectionsSnapshot) {
  const monthLabels = getLastSixMonthLabels();
  const monthKeys = getLastSixMonthKeys();
  const revenueByMonth = Object.fromEntries(monthKeys.map(k => [k, 0]));
  const customersByMonth = Object.fromEntries(monthKeys.map(k => [k, 0]));

  let totalRevenue = 0, pendingAmount = 0, paidBills = 0, pendingBills = 0;
  billsSnapshot.forEach(doc => {
    const bill = doc.data();
    const amount = Number(bill.amount || bill.total || bill.price || 0);
    const status = (bill.paymentStatus || bill.status || 'pending').toLowerCase();
    const key = monthKeyFromAnyDate(bill.paidAt || bill.createdAt || bill.date || bill.dueDate);
    if (status === 'paid') {
      totalRevenue += amount;
      paidBills++;
      if (key && revenueByMonth[key] !== undefined) revenueByMonth[key] += amount;
    } else {
      pendingAmount += amount;
      pendingBills++;
    }
  });

  const statusCounts = { active: 0, pending: 0, suspended: 0, inactive: 0 };
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const status = (user.status || 'pending').toLowerCase();
    if (statusCounts[status] !== undefined) statusCounts[status]++;
    else statusCounts.inactive++;
    const key = monthKeyFromAnyDate(user.createdAt || user.joinDate || user.registeredAt);
    if (key && customersByMonth[key] !== undefined) customersByMonth[key]++;
  });

  let openTickets = 0, closedTickets = 0;
  ticketsSnapshot.forEach(doc => {
    const status = ((doc.data().status) || 'open').toLowerCase();
    if (status === 'closed' || status === 'resolved') closedTickets++;
    else openTickets++;
  });

  let onlineCustomers = 0;
  connectionsSnapshot.forEach(doc => {
    if (((doc.data().status) || '').toLowerCase() === 'online') onlineCustomers++;
  });

  return {
    monthLabels,
    revenueByMonth: monthKeys.map(k => revenueByMonth[k]),
    customersByMonth: monthKeys.map(k => customersByMonth[k]),
    totalRevenue,
    pendingAmount,
    paidBills,
    pendingBills,
    totalCustomers: usersSnapshot.size,
    activeCustomers: statusCounts.active,
    onlineCustomers,
    openTickets,
    closedTickets,
    totalTickets: ticketsSnapshot.size,
    statusCounts
  };
}

function renderAnalyticsNumbers(a) {
  document.getElementById('analytics-revenue').textContent = formatMoney(a.totalRevenue);
  document.getElementById('analytics-pending').textContent = formatMoney(a.pendingAmount);
  document.getElementById('analytics-customers').textContent = a.totalCustomers;
  document.getElementById('analytics-active').textContent = a.activeCustomers;
  document.getElementById('analytics-online').textContent = a.onlineCustomers;
  document.getElementById('analytics-tickets').textContent = a.openTickets;
}

function renderAnalyticsSummary(a) {
  const collectionRate = (a.paidBills + a.pendingBills) ? Math.round((a.paidBills / (a.paidBills + a.pendingBills)) * 100) : 0;
  const activeRate = a.totalCustomers ? Math.round((a.activeCustomers / a.totalCustomers) * 100) : 0;
  const ticketResolveRate = a.totalTickets ? Math.round((a.closedTickets / a.totalTickets) * 100) : 0;

  document.getElementById('analytics-summary').innerHTML = `
    <div class="summary-item"><span>Bill collection rate</span><strong>${collectionRate}%</strong></div>
    <div class="summary-item"><span>Customer active rate</span><strong>${activeRate}%</strong></div>
    <div class="summary-item"><span>Ticket resolve rate</span><strong>${ticketResolveRate}%</strong></div>
    <div class="summary-item"><span>Paid invoices</span><strong>${a.paidBills}</strong></div>
    <div class="summary-item"><span>Pending invoices</span><strong>${a.pendingBills}</strong></div>
    <div class="summary-item"><span>Online accounts</span><strong>${a.onlineCustomers}</strong></div>
  `;
}

function renderRevenueChart(labels, data) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx || !window.Chart) return;
  if (revenueChartInstance) revenueChartInstance.destroy();
  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Revenue', data, tension: 0.35, fill: true }] },
    options: defaultChartOptions('KES')
  });
}

function renderCustomerGrowthChart(labels, data) {
  const ctx = document.getElementById('customerChart');
  if (!ctx || !window.Chart) return;
  if (customerChartInstance) customerChartInstance.destroy();
  customerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'New Customers', data }] },
    options: defaultChartOptions('')
  });
}

function renderStatusChart(statusCounts) {
  const ctx = document.getElementById('statusChart');
  if (!ctx || !window.Chart) return;
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Pending', 'Suspended', 'Inactive'],
      datasets: [{ data: [statusCounts.active, statusCounts.pending, statusCounts.suspended, statusCounts.inactive] }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#f0f6ff' } } } }
  });
}

function defaultChartOptions(prefix) {
  return {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#f0f6ff' } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${prefix ? prefix + ' ' : ''}${Number(ctx.raw || 0).toLocaleString('en-KE')}` } }
    },
    scales: {
      x: { ticks: { color: '#7a99c0' }, grid: { color: 'rgba(122,153,192,.08)' } },
      y: { ticks: { color: '#7a99c0' }, grid: { color: 'rgba(122,153,192,.08)' }, beginAtZero: true }
    }
  };
}

function getLastSixMonthKeys() {
  const now = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function getLastSixMonthLabels() {
  const now = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString('en-KE', { month: 'short' }));
  }
  return labels;
}

function monthKeyFromAnyDate(value) {
  const millis = getMillis(value);
  if (!millis) return null;
  const d = new Date(millis);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

window.loadAnalytics = loadAnalytics;
