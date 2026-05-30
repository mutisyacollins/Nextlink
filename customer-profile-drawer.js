// ==================== CUSTOMER PROFILE DRAWER ====================

async function openCustomerDrawer(customerId) {
  if (!customerId) return;
  ensureCustomerDrawer();
  const drawer = document.getElementById('customer-drawer');
  const body = document.getElementById('customer-drawer-body');
  drawer.classList.add('open');
  body.innerHTML = `<div class="skeleton" style="height:240px;border-radius:12px"></div>`;

  try {
    const [userDoc, billsSnap, ticketsSnap, connDoc] = await Promise.all([
      db.collection('users').doc(customerId).get(),
      db.collection('billing').where('customerId', '==', customerId).get().catch(() => db.collection('billing').where('uid', '==', customerId).get()),
      db.collection('supportTickets').where('customerId', '==', customerId).get().catch(() => ({ size: 0, forEach: () => {} })),
      db.collection('connections').doc(customerId).get().catch(() => ({ exists: false, data: () => ({}) }))
    ]);

    if (!userDoc.exists) {
      body.innerHTML = `<div class="alert-error">Customer profile was not found.</div>`;
      return;
    }

    const u = { id: userDoc.id, ...userDoc.data() };
    const c = connDoc.exists ? connDoc.data() : {};
    let totalBills = 0, pendingBills = 0, paidBills = 0, openTickets = 0;

    billsSnap.forEach(doc => {
      const bill = doc.data();
      const amount = Number(bill.amount || bill.total || bill.price || 0);
      totalBills += amount;
      const status = (bill.status || bill.paymentStatus || 'pending').toLowerCase();
      if (status === 'paid') paidBills += amount;
      else pendingBills += amount;
    });

    ticketsSnap.forEach(doc => {
      const status = (doc.data().status || 'open').toLowerCase();
      if (status === 'open' || status === 'in-progress') openTickets++;
    });

    const online = (c.status || '').toLowerCase() === 'online';

    body.innerHTML = `
      <div class="drawer-profile-head">
        <div class="avatar-circle">${escapeHtml((getCustomerName(u) || 'N').charAt(0).toUpperCase())}</div>
        <div>
          <h3>${escapeHtml(getCustomerName(u))}</h3>
          <p>${escapeHtml(u.email || 'No email')}</p>
          <span class="connection-pill ${online ? 'online' : 'offline'}">${online ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div class="drawer-grid">
        ${drawerItem('Account Number', u.accountNumber || '—')}
        ${drawerItem('Phone', u.phone || u.phoneNumber || '—')}
        ${drawerItem('Location', u.location || '—')}
        ${drawerItem('Package', u.plan || u.packageName || u.package || 'Pending')}
        ${drawerItem('Status', u.status || 'pending')}
        ${drawerItem('Joined', formatDate(u.createdAt || u.joinDate || u.registeredAt))}
      </div>

      <div class="mini-stats drawer-mini">
        <div><span>Total Bills</span><strong>${formatMoney(totalBills)}</strong></div>
        <div><span>Paid</span><strong>${formatMoney(paidBills)}</strong></div>
        <div><span>Pending</span><strong>${formatMoney(pendingBills)}</strong></div>
        <div><span>Open Tickets</span><strong>${openTickets}</strong></div>
      </div>

      <div class="drawer-actions">
        <button class="btn-primary" onclick="showSection('billing'); closeCustomerDrawer();">View Billing</button>
        <button class="btn-secondary" onclick="showSection('support'); closeCustomerDrawer();">View Support</button>
      </div>
    `;
  } catch (error) {
    console.error('Customer drawer error:', error);
    body.innerHTML = `<div class="alert-error">Could not load customer profile.</div>`;
  }
}

function drawerItem(label, value) {
  return `<div class="drawer-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || '—'))}</strong></div>`;
}

function ensureCustomerDrawer() {
  if (document.getElementById('customer-drawer')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="customer-drawer-backdrop" class="drawer-backdrop" onclick="closeCustomerDrawer()"></div>
    <aside id="customer-drawer" class="customer-drawer">
      <div class="drawer-top">
        <div>
          <span class="eyebrow">Customer Profile</span>
          <h2>Account Details</h2>
        </div>
        <button class="close-btn" onclick="closeCustomerDrawer()">×</button>
      </div>
      <div id="customer-drawer-body"></div>
    </aside>`);
}

function closeCustomerDrawer() {
  const drawer = document.getElementById('customer-drawer');
  if (drawer) drawer.classList.remove('open');
}

window.openCustomerDrawer = openCustomerDrawer;
window.closeCustomerDrawer = closeCustomerDrawer;
