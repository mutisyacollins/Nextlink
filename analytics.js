// ==================== ANALYTICS.JS — NEXTLINK PRO ANALYTICS PAGE ====================

let revenueChartInstance = null;
let customerChartInstance = null;
let statusChartInstance = null;

async function loadAnalytics() {
  const container = document.getElementById('analytics');

  if (!container) {
    console.error('Analytics container not found.');
    return;
  }

  container.innerHTML = `
    <div class="page-section-header">
      <div>
        <span class="eyebrow">Business Intelligence</span>
        <h2>Analytics Overview</h2>
        <p>Track revenue, customers, bills and support performance.</p>
      </div>
    </div>

    <div class="stats-grid enhanced">
      ${analyticsCard('Revenue', 'analytics-revenue', 'Collected payments', 'green')}
      ${analyticsCard('Pending', 'analytics-pending', 'Outstanding bills', 'orange')}
      ${analyticsCard('Customers', 'analytics-customers', 'Registered accounts', 'cyan')}
      ${analyticsCard('Open Tickets', 'analytics-tickets', 'Unresolved issues', 'pink')}
    </div>

    <div class="stats-grid enhanced">
      ${analyticsCard('This Month Revenue', 'month-revenue', 'Current month', 'green')}
      ${analyticsCard('New Customers', 'month-customers', 'This month', 'cyan')}
      ${analyticsCard('Collection Rate', 'collection-rate', 'Paid invoices', 'purple')}
      ${analyticsCard('Active Rate', 'active-rate', 'Active customers', 'green')}
    </div>

    <div class="dashboard-grid">
      <div class="card chart-card">
        <div class="card-head">
          <div>
            <h3>Revenue Trend</h3>
            <p>Last 6 months paid bills</p>
          </div>
        </div>
        <canvas id="revenueChart" height="120"></canvas>
      </div>

      <div class="card chart-card">
        <div class="card-head">
          <div>
            <h3>Customer Growth</h3>
            <p>Last 6 months registrations</p>
          </div>
        </div>
        <canvas id="customerChart" height="120"></canvas>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head">
          <div>
            <h3>Customer Status</h3>
            <p>Current customer account status</p>
          </div>
        </div>
        <div id="customer-status-summary" class="summary-list">
          <div class="skeleton" style="height:160px;border-radius:10px"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Top Packages</h3>
            <p>Most used internet plans</p>
          </div>
        </div>
        <div id="top-packages">
          <div class="skeleton" style="height:160px;border-radius:10px"></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h3>Performance Summary</h3>
          <p>Important business numbers</p>
        </div>
      </div>
      <div id="analytics-summary" class="summary-list">
        <div class="skeleton" style="height:150px;border-radius:10px"></div>
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

    const analytics = buildAnalytics(
      usersSnapshot,
      billsSnapshot,
      ticketsSnapshot,
      connectionsSnapshot
    );

    renderAnalyticsNumbers(analytics);
    renderCustomerStatusSummary(analytics.statusCounts);
    renderTopPackages(analytics.packageCounts);
    renderAnalyticsSummary(analytics);
    renderRevenueChart(analytics.monthLabels, analytics.revenueByMonth);
    renderCustomerGrowthChart(analytics.monthLabels, analytics.customersByMonth);

  } catch (error) {
    console.error('Analytics error:', error);
    container.innerHTML += `<div class="alert-error">Could not load analytics. Check Firestore rules or console errors.</div>`;
  }
}

async function safeGetAnalyticsCollection(name) {
  try {
    return await db.collection(name).get();
  } catch {
    return {
      size: 0,
      empty: true,
      forEach: () => {}
    };
  }
}

function analyticsCard(title, id, subtitle, colorClass) {
  return `
    <div class="stat-card ${colorClass}">
      <div class="stat-label">${title}</div>
      <h2 id="${id}">—</h2>
      <span class="stat-sub">${subtitle}</span>
    </div>
  `;
}

function buildAnalytics(usersSnapshot, billsSnapshot, ticketsSnapshot, connectionsSnapshot) {
  const monthLabels = getLastSixMonthLabels();
  const monthKeys = getLastSixMonthKeys();
  const currentMonthKey = getCurrentMonthKey();

  const revenueMap = Object.fromEntries(monthKeys.map(key => [key, 0]));
  const customerMap = Object.fromEntries(monthKeys.map(key => [key, 0]));

  let totalRevenue = 0;
  let pendingAmount = 0;
  let paidBills = 0;
  let pendingBills = 0;
  let thisMonthRevenue = 0;

  billsSnapshot.forEach(doc => {
    const bill = doc.data();
    const amount = getBillAmount(bill);
    const status = String(bill.paymentStatus || bill.status || 'pending').toLowerCase();
    const dateKey = monthKeyFromAnyDate(
      bill.paidAt ||
      bill.createdAt ||
      bill.date ||
      bill.dueDate ||
      bill.billDueDate
    );

    if (status === 'paid') {
      totalRevenue += amount;
      paidBills++;

      if (dateKey && revenueMap[dateKey] !== undefined) {
        revenueMap[dateKey] += amount;
      }

      if (dateKey === currentMonthKey) {
        thisMonthRevenue += amount;
      }
    } else {
      pendingAmount += amount;
      pendingBills++;
    }
  });

  const statusCounts = {
    active: 0,
    pending: 0,
    suspended: 0,
    inactive: 0
  };

  const packageCounts = {};
  let thisMonthCustomers = 0;

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const status = String(user.status || 'pending').toLowerCase();

    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    } else {
      statusCounts.inactive++;
    }

    const plan = user.plan || user.packageName || user.package || 'No Package';
    packageCounts[plan] = (packageCounts[plan] || 0) + 1;

    const dateKey = monthKeyFromAnyDate(
      user.createdAt ||
      user.joinDate ||
      user.registeredAt
    );

    if (dateKey && customerMap[dateKey] !== undefined) {
      customerMap[dateKey]++;
    }

    if (dateKey === currentMonthKey) {
      thisMonthCustomers++;
    }
  });

  let openTickets = 0;
  let closedTickets = 0;

  ticketsSnapshot.forEach(doc => {
    const ticket = doc.data();
    const status = String(ticket.status || 'open').toLowerCase();

    if (status === 'closed' || status === 'resolved') {
      closedTickets++;
    } else {
      openTickets++;
    }
  });

  let onlineCustomers = 0;

  connectionsSnapshot.forEach(doc => {
    const connection = doc.data();
    const status = String(connection.status || '').toLowerCase();

    if (status === 'online') {
      onlineCustomers++;
    }
  });

  const totalBills = paidBills + pendingBills;
  const totalTickets = openTickets + closedTickets;

  const collectionRate = totalBills
    ? Math.round((paidBills / totalBills) * 100)
    : 0;

  const activeRate = usersSnapshot.size
    ? Math.round((statusCounts.active / usersSnapshot.size) * 100)
    : 0;

  const ticketResolveRate = totalTickets
    ? Math.round((closedTickets / totalTickets) * 100)
    : 0;

  return {
    monthLabels,
    revenueByMonth: monthKeys.map(key => revenueMap[key]),
    customersByMonth: monthKeys.map(key => customerMap[key]),

    totalRevenue,
    pendingAmount,
    paidBills,
    pendingBills,
    thisMonthRevenue,
    thisMonthCustomers,

    totalCustomers: usersSnapshot.size,
    activeCustomers: statusCounts.active,
    onlineCustomers,

    openTickets,
    closedTickets,
    totalTickets,

    collectionRate,
    activeRate,
    ticketResolveRate,

    statusCounts,
    packageCounts
  };
}

function getBillAmount(bill) {
  if (Array.isArray(bill.items) && bill.items.length) {
    return bill.items.reduce((sum, item) => {
      return sum + Number(item.amountKes || item.amount || item.price || 0);
    }, 0);
  }

  return Number(bill.amount || bill.total || bill.price || 0);
}

function renderAnalyticsNumbers(data) {
  setText('analytics-revenue', formatMoney(data.totalRevenue));
  setText('analytics-pending', formatMoney(data.pendingAmount));
  setText('analytics-customers', data.totalCustomers);
  setText('analytics-tickets', data.openTickets);

  setText('month-revenue', formatMoney(data.thisMonthRevenue));
  setText('month-customers', data.thisMonthCustomers);
  setText('collection-rate', `${data.collectionRate}%`);
  setText('active-rate', `${data.activeRate}%`);
}

function renderCustomerStatusSummary(statusCounts) {
  const container = document.getElementById('customer-status-summary');
  if (!container) return;

  container.innerHTML = `
    <div class="summary-item"><span>Active Customers</span><strong>${statusCounts.active}</strong></div>
    <div class="summary-item"><span>Pending Customers</span><strong>${statusCounts.pending}</strong></div>
    <div class="summary-item"><span>Suspended Customers</span><strong>${statusCounts.suspended}</strong></div>
    <div class="summary-item"><span>Inactive / Other</span><strong>${statusCounts.inactive}</strong></div>
  `;
}

function renderTopPackages(packageCounts) {
  const container = document.getElementById('top-packages');
  if (!container) return;

  const entries = Object.entries(packageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!entries.length) {
    container.innerHTML = emptyState('📦', 'No package data found.');
    return;
  }

  const max = Math.max(...entries.map(([, count]) => count));

  container.innerHTML = entries.map(([name, count]) => {
    const width = max ? Math.round((count / max) * 100) : 0;

    return `
      <div class="bar-row">
        <div class="bar-info">
          <span>${escapeHtml(name)}</span>
          <strong>${count}</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAnalyticsSummary(data) {
  const container = document.getElementById('analytics-summary');
  if (!container) return;

  container.innerHTML = `
    <div class="summary-item"><span>Paid Invoices</span><strong>${data.paidBills}</strong></div>
    <div class="summary-item"><span>Pending Invoices</span><strong>${data.pendingBills}</strong></div>
    <div class="summary-item"><span>Online Accounts</span><strong>${data.onlineCustomers}</strong></div>
    <div class="summary-item"><span>Ticket Resolve Rate</span><strong>${data.ticketResolveRate}%</strong></div>
    <div class="summary-item"><span>Closed Tickets</span><strong>${data.closedTickets}</strong></div>
    <div class="summary-item"><span>Open Tickets</span><strong>${data.openTickets}</strong></div>
  `;
}

function renderRevenueChart(labels, data) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx || !window.Chart) return;

  if (revenueChartInstance) revenueChartInstance.destroy();

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        tension: 0.35,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: defaultChartOptions('KES')
  });
}

function renderCustomerGrowthChart(labels, data) {
  const ctx = document.getElementById('customerChart');
  if (!ctx || !window.Chart) return;

  if (customerChartInstance) customerChartInstance.destroy();

  customerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'New Customers',
        data,
        borderWidth: 1
      }]
    },
    options: defaultChartOptions('')
  });
}

function defaultChartOptions(prefix) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: '#f0f6ff'
        }
      },
      tooltip: {
        callbacks: {
          label: context => {
            const value = Number(context.raw || 0).toLocaleString('en-KE');
            return `${context.dataset.label}: ${prefix ? prefix + ' ' : ''}${value}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#7a99c0' },
        grid: { color: 'rgba(122,153,192,.08)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#7a99c0' },
        grid: { color: 'rgba(122,153,192,.08)' }
      }
    }
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getLastSixMonthKeys() {
  const now = new Date();
  const keys = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  return keys;
}

function getLastSixMonthLabels() {
  const now = new Date();
  const labels = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(date.toLocaleString('en-KE', { month: 'short' }));
  }

  return labels;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromAnyDate(value) {
  const millis = getMillis(value);
  if (!millis) return null;

  const date = new Date(millis);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

window.loadAnalytics = loadAnalytics;
