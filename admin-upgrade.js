// ==================== ADMIN-UPGRADE.JS — NEXTLINK APP COMPATIBILITY LAYER ====================
// This file upgrades the admin portal so it writes Firestore data in the same shape
// your Android app reads: users/{uid}, billing/{uid}, connections/{uid}, supportTickets with uid.

async function nlGetCustomersMap() {
  const snapshot = await db.collection('users').get();
  const map = {};
  snapshot.forEach(doc => { map[doc.id] = { id: doc.id, ...doc.data() }; });
  return map;
}

function nlSplitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}

function nlBillAmount(bill) {
  if (Array.isArray(bill.items) && bill.items.length) {
    return bill.items.reduce((sum, item) => sum + Number(item.amountKes || item.amount || item.price || 0), 0);
  }
  return Number(bill.amount || bill.total || bill.price || 0);
}

function nlStatus(value) {
  return String(value || 'pending').toLowerCase();
}

function nlCustomerLabel(customer) {
  if (!customer) return 'Unknown Customer';
  const name = getCustomerName(customer);
  const acc = customer.accountNumber ? ` — ${customer.accountNumber}` : '';
  return `${name}${acc}`;
}

async function nlEnsureConnectionDoc(uid) {
  if (!uid) return;
  const ref = db.collection('connections').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      status: 'offline',
      downloadMbps: 0,
      uploadMbps: 0,
      pingMs: 0,
      dataUsedGB: 0,
      usageBrowsingGB: 0,
      usageVideoGB: 0,
      usageCloudGB: 0,
      usageOtherGB: 0,
      devicesConnected: 0,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

// ──────────────────────────────────────────────────────────────
// Customers: keep fullName for web, plus firstName/lastName for the Android app.
// ──────────────────────────────────────────────────────────────
window.saveCustomer = async function saveCustomer() {
  const id = document.getElementById('customer-id').value;
  const fullName = document.getElementById('customer-fullName').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const location = document.getElementById('customer-location').value.trim();
  const plan = document.getElementById('customer-plan').value.trim() || 'Pending Activation';
  const status = document.getElementById('customer-status').value;
  const billDueDate = document.getElementById('customer-billDueDate').value.trim();
  const accountNumber = document.getElementById('customer-accountNumber').value.trim() || `NXT-${Date.now().toString().slice(-6)}`;
  const notes = document.getElementById('customer-notes').value.trim();
  const errorEl = document.getElementById('customer-form-error');
  const saveBtn = document.getElementById('save-customer-btn');

  if (!fullName) { errorEl.textContent = 'Customer name is required.'; return; }

  const nameParts = nlSplitName(fullName);
  const data = {
    fullName,
    name: fullName,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email,
    phone,
    location,
    plan,
    packageName: plan,
    status,
    role: 'customer',
    billDueDate,
    accountNumber,
    notes,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    let uid = id;
    if (uid) {
      await db.collection('users').doc(uid).set(data, { merge: true });
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('users').add(data);
      uid = ref.id;
    }

    await nlEnsureConnectionDoc(uid);
    await db.collection('billing').doc(uid).set({
      uid,
      customerId: uid,
      customerName: fullName,
      dueDate: billDueDate || '--',
      billDueDate: billDueDate || '--',
      paymentStatus: 'pending',
      status: 'pending',
      items: firebase.firestore.FieldValue.arrayUnion(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast(id ? 'Customer updated successfully.' : 'Customer added successfully.', 'success');
    closeCustomerModal();
    await fetchCustomers();
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (error) {
    console.error('Save customer error:', error);
    errorEl.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Customer';
  }
};

// ──────────────────────────────────────────────────────────────
// Billing: create/update bills under billing/{uid}, matching Android DashboardViewModel.
// ──────────────────────────────────────────────────────────────
window.loadBilling = async function loadBilling() {
  const container = document.getElementById('billing');
  const customersMap = await nlGetCustomersMap().catch(() => ({}));
  const options = Object.values(customersMap)
    .sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b)))
    .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(nlCustomerLabel(c))}</option>`)
    .join('');

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Billing & Payments</h3>
          <p>Create customer bills that appear inside the mobile app immediately.</p>
        </div>
        <div class="card-head-actions">
          <button onclick="exportBills()" class="btn-secondary">⬇ Export CSV</button>
          <button onclick="openBillModal()" class="btn-primary">+ Create Bill</button>
        </div>
      </div>

      <div class="mini-stats">
        <div><span>Total Bills</span><strong id="bill-total">—</strong></div>
        <div><span>Paid</span><strong id="bill-paid" style="color:var(--emerald)">—</strong></div>
        <div><span>Pending</span><strong id="bill-pending" style="color:var(--orange)">—</strong></div>
        <div><span>Revenue</span><strong id="bill-revenue" style="color:var(--cyan)">—</strong></div>
      </div>

      <div class="toolbar triple">
        <div class="search-wrap"><span class="search-icon">🔍</span><input type="text" id="bill-search" placeholder="Search customer, status, date…" oninput="filterBills()" /></div>
        <select id="bill-status-filter" onchange="filterBills()"><option value="">All Status</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="overdue">Overdue</option></select>
        <button onclick="exportBills()" class="btn-ghost" style="border:1px solid var(--border)">⬇ CSV</button>
      </div>

      <div id="bill-count" style="font-size:13px;color:var(--muted);margin-bottom:12px"></div>
      <div id="billing-content" class="table-wrap"><div class="skeleton" style="height:200px;border-radius:10px"></div></div>
    </div>

    <div id="bill-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-head"><h3 id="bill-modal-title">Create Bill</h3><button onclick="closeBillModal()" class="close-btn">×</button></div>
        <input type="hidden" id="bill-edit-id" />
        <div class="form-grid">
          <div class="full"><label>Customer *</label><select id="bill-customerId" onchange="handleBillCustomerSelect()"><option value="">Select customer</option>${options}</select></div>
          <div><label>Customer Name *</label><input type="text" id="bill-customerName" placeholder="Jane Mwangi" /></div>
          <div><label>Amount (KES) *</label><input type="number" id="bill-amount" placeholder="1500" min="0" /></div>
          <div><label>Due Date</label><input type="text" id="bill-dueDate" placeholder="30 June 2026" /></div>
          <div><label>Status</label><select id="bill-status"><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div>
          <div class="full"><label>Description</label><input type="text" id="bill-description" placeholder="Monthly internet subscription…" /></div>
        </div>
        <p id="bill-error" class="error"></p>
        <div class="modal-actions"><button class="btn-secondary" onclick="closeBillModal()">Cancel</button><button class="btn-primary" id="save-bill-btn" onclick="saveBill()">Save Bill</button></div>
      </div>
    </div>`;

  window._billingCustomersMap = customersMap;
  await fetchBills();
};

window.handleBillCustomerSelect = function handleBillCustomerSelect() {
  const id = document.getElementById('bill-customerId').value;
  const c = window._billingCustomersMap?.[id];
  if (!c) return;
  document.getElementById('bill-customerName').value = getCustomerName(c);
  if (!document.getElementById('bill-dueDate').value) {
    document.getElementById('bill-dueDate').value = c.billDueDate || c.dueDate || '';
  }
};

window.fetchBills = async function fetchBills() {
  try {
    const [snapshot, customersMap] = await Promise.all([db.collection('billing').get(), nlGetCustomersMap().catch(() => ({}))]);
    allBills = [];
    snapshot.forEach(doc => {
      const bill = { id: doc.id, ...doc.data() };
      const customer = customersMap[bill.uid || bill.customerId || doc.id];
      allBills.push({
        ...bill,
        customerId: bill.uid || bill.customerId || doc.id,
        customerName: bill.customerName || (customer ? getCustomerName(customer) : 'Unknown Customer'),
        amount: nlBillAmount(bill),
        paymentStatus: bill.paymentStatus || bill.status || 'pending',
        dueDate: bill.dueDate || bill.billDueDate || '--'
      });
    });
    allBills.sort((a, b) => getMillis(b.updatedAt || b.createdAt) - getMillis(a.updatedAt || a.createdAt));
    updateBillStats(allBills);
    renderBills(allBills);
  } catch (error) {
    console.error('Billing error:', error);
    document.getElementById('billing-content').innerHTML = `<div class="alert-error">Error loading billing data.</div>`;
  }
};

window.saveBill = async function saveBill() {
  const editId = document.getElementById('bill-edit-id').value;
  const customerId = document.getElementById('bill-customerId')?.value || editId;
  const customerName = document.getElementById('bill-customerName').value.trim();
  const amount = Number(document.getElementById('bill-amount').value);
  const dueDate = document.getElementById('bill-dueDate').value.trim() || '--';
  const paymentStatus = document.getElementById('bill-status').value;
  const description = document.getElementById('bill-description').value.trim() || 'Monthly internet subscription';
  const errorEl = document.getElementById('bill-error');
  const saveBtn = document.getElementById('save-bill-btn');

  if (!customerId) { errorEl.textContent = 'Please select the customer this bill belongs to.'; return; }
  if (!customerName || !amount) { errorEl.textContent = 'Customer name and amount are required.'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const data = {
      uid: customerId,
      customerId,
      customerName,
      amount,
      total: amount,
      dueDate,
      billDueDate: dueDate,
      paymentStatus,
      status: paymentStatus,
      description,
      items: [{ label: description, amountKes: amount }],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = db.collection('billing').doc(customerId);
    const oldDoc = await ref.get();
    if (!oldDoc.exists) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(data, { merge: true });
    await db.collection('users').doc(customerId).set({ billDueDate: dueDate, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

    if (paymentStatus === 'paid') {
      await ref.collection('history').add({
        month: new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' }),
        amount: `KES ${amount.toLocaleString('en-KE')}`,
        status: 'Paid',
        paidAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    showToast('Bill saved and synced with the mobile app.', 'success');
    closeBillModal();
    await fetchBills();
  } catch (error) {
    console.error(error);
    errorEl.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Bill';
  }
};

window.markBillPaid = async function markBillPaid(id) {
  if (!confirmAction('Mark this bill as paid?')) return;
  try {
    const ref = db.collection('billing').doc(id);
    const snap = await ref.get();
    const amount = snap.exists ? nlBillAmount(snap.data()) : 0;
    await ref.set({ paymentStatus: 'paid', status: 'paid', paidAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (amount > 0) await ref.collection('history').add({ month: new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' }), amount: `KES ${amount.toLocaleString('en-KE')}`, status: 'Paid', paidAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Bill marked as paid.', 'success');
    await fetchBills();
  } catch (error) { showToast('Failed to update bill.', 'error'); }
};

// ──────────────────────────────────────────────────────────────
// Support: save uid + customerId so app and admin can both see names.
// ──────────────────────────────────────────────────────────────
const originalSaveTicket = window.saveTicket;
window.saveTicket = async function saveTicket() {
  const editId = document.getElementById('ticket-edit-id').value;
  const customerId = document.getElementById('ticket-customer-id').value;
  const customerName = document.getElementById('ticket-customerName').value.trim();
  const phone = document.getElementById('ticket-phone').value.trim();
  const accountNumber = document.getElementById('ticket-accountNumber').value.trim();
  const packageName = document.getElementById('ticket-package').value.trim();
  const issue = document.getElementById('ticket-issue').value.trim();
  const priority = document.getElementById('ticket-priority').value;
  const status = document.getElementById('ticket-status').value;
  const notes = document.getElementById('ticket-notes').value.trim();
  const errorEl = document.getElementById('ticket-error');
  const saveBtn = document.getElementById('save-ticket-btn');

  if (!customerName || !issue) { errorEl.textContent = 'Customer name and issue are required.'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  try {
    const data = {
      uid: customerId || null,
      customerId: customerId || null,
      customerName,
      name: customerName,
      phone,
      accountNumber,
      package: packageName,
      packageName,
      issue,
      subject: issue,
      category: packageName || 'Account',
      priority,
      status,
      notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (editId) await db.collection('supportTickets').doc(editId).set(data, { merge: true });
    else await db.collection('supportTickets').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Ticket saved and linked to customer.', 'success');
    closeTicketModal();
    await fetchTickets();
  } catch (error) {
    console.error(error);
    errorEl.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Ticket';
  }
};

// Better current-section refresh with toast feedback.
window.refreshCurrentSection = async function refreshCurrentSection() {
  const section = window._currentSection || 'dashboard';
  showToast(`Refreshing ${section}…`, 'info', 1200);
  showSection(section);
};
