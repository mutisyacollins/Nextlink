// ==================== DASHBOARD.JS — NEXTLINK CLEAN ADMIN DASHBOARD ====================

async function loadDashboard() {
  const dashboardDiv = document.getElementById("dashboard");

  dashboardDiv.innerHTML = `
    <div class="simple-dashboard-header">
      <div>
        <span class="eyebrow">Admin Overview</span>
        <h2>Nextlink Networks Dashboard</h2>
        <p>Quick summary of customers, billing, and support activity.</p>
      </div>
    </div>

    <div class="stats-grid enhanced">
      ${statCard("Total Customers", "total-customers", "Registered users", "cyan")}
      ${statCard("Active Customers", "active-customers", "Active accounts", "green")}
      ${statCard("Pending Bills", "pending-bills", "Unpaid invoices", "pink")}
      ${statCard("Open Tickets", "open-tickets", "Customer issues", "orange")}
      ${statCard("Total Revenue", "total-revenue", "Paid bills", "green")}
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head">
          <div>
            <h3>Recent Customers</h3>
            <p>Latest registered customers</p>
          </div>
          <button class="btn-secondary" onclick="showSection('customers')">View All →</button>
        </div>
        <div id="recent-customers">
          <div class="skeleton" style="height:210px;border-radius:10px"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Recent Support Tickets</h3>
            <p>Latest customer support requests</p>
          </div>
          <button class="btn-secondary" onclick="showSection('support')">View All →</button>
        </div>
        <div id="recent-support">
          <div class="skeleton" style="height:210px;border-radius:10px"></div>
        </div>
      </div>
    </div>
  `;

  try {
    const [usersSnapshot, billsSnapshot, ticketsSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("billing").get(),
      db.collection("supportTickets").get()
    ]);

    const stats = calculateDashboardStats(
      usersSnapshot,
      billsSnapshot,
      ticketsSnapshot
    );

    animateCount("total-customers", stats.totalCustomers);
    animateCount("active-customers", stats.activeCustomers);
    animateCount("pending-bills", stats.pendingBills);
    animateCount("open-tickets", stats.openTickets);

    const revenueEl = document.getElementById("total-revenue");
    if (revenueEl) revenueEl.textContent = formatMoney(stats.totalRevenue);

    renderRecentCustomers(usersSnapshot);
    renderRecentSupportTickets(ticketsSnapshot);

  } catch (error) {
    console.error("Dashboard error:", error);
    dashboardDiv.insertAdjacentHTML(
      "beforeend",
      `<div class="alert-error">Failed to load dashboard data. Check Firestore rules and admin access.</div>`
    );
  }
}

function calculateDashboardStats(usersSnapshot, billsSnapshot, ticketsSnapshot) {
  let activeCustomers = 0;
  let pendingBills = 0;
  let totalRevenue = 0;
  let openTickets = 0;

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const status = (user.status || "pending").toLowerCase();

    if (status === "active") {
      activeCustomers++;
    }
  });

  billsSnapshot.forEach(doc => {
    const bill = doc.data();
    const status = (bill.paymentStatus || bill.status || "pending").toLowerCase();
    const amount = Number(bill.amount || bill.total || bill.price || 0);

    if (status === "paid") {
      totalRevenue += amount;
    } else {
      pendingBills++;
    }
  });

  ticketsSnapshot.forEach(doc => {
    const ticket = doc.data();
    const status = (ticket.status || "open").toLowerCase();

    if (
      status === "open" ||
      status === "in-progress" ||
      status === "pending"
    ) {
      openTickets++;
    }
  });

  return {
    totalCustomers: usersSnapshot.size,
    activeCustomers,
    pendingBills,
    openTickets,
    totalRevenue
  };
}

function statCard(title, id, subtitle, colorClass) {
  return `
    <div class="stat-card ${colorClass}">
      <div class="stat-label">${title}</div>
      <h2 id="${id}">—</h2>
      <span class="stat-sub">${subtitle}</span>
    </div>
  `;
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

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function renderRecentCustomers(snapshot) {
  const container = document.getElementById("recent-customers");
  if (!container) return;

  if (snapshot.empty) {
    container.innerHTML = emptyState("👥", "No customers yet.");
    return;
  }

  let users = [];

  snapshot.forEach(doc => {
    users.push({
      id: doc.id,
      ...doc.data()
    });
  });

  users = users
    .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
    .slice(0, 5);

  let html = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Package</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
  `;

  users.forEach(user => {
    html += `
      <tr class="clickable-row" onclick="openCustomerDrawer('${user.id}')">
        <td>
          <strong>${escapeHtml(getCustomerName(user))}</strong>
          <small>${escapeHtml(user.email || "—")}</small>
        </td>
        <td>${escapeHtml(user.plan || user.packageName || user.package || "Pending")}</td>
        <td>
          <span class="status ${escapeHtml(user.status || "pending")}">
            ${escapeHtml(user.status || "pending")}
          </span>
        </td>
        <td>${formatDate(user.createdAt)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function renderRecentSupportTickets(snapshot) {
  const container = document.getElementById("recent-support");
  if (!container) return;

  if (snapshot.empty) {
    container.innerHTML = emptyState("🎧", "No support tickets yet.");
    return;
  }

  let tickets = [];

  snapshot.forEach(doc => {
    tickets.push({
      id: doc.id,
      ...doc.data()
    });
  });

  tickets = tickets
    .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
    .slice(0, 5);

  let html = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Issue</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
  `;

  tickets.forEach(ticket => {
    html += `
      <tr ${ticket.customerId ? `class="clickable-row" onclick="openCustomerDrawer('${ticket.customerId}')"` : ""}>
        <td>
          <strong>${escapeHtml(ticket.customerName || ticket.name || "Unknown")}</strong>
          <small>${escapeHtml(ticket.accountNumber || "")}</small>
        </td>
        <td>${escapeHtml(ticket.issue || ticket.subject || "No subject")}</td>
        <td>
          <span class="status ${escapeHtml(ticket.status || "open")}">
            ${escapeHtml(ticket.status || "open")}
          </span>
        </td>
        <td>${formatDate(ticket.createdAt)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

window.loadDashboard = loadDashboard;
