// ==================== BILLING.JS ====================

let allBills = [];

async function loadBilling() {
  const container = document.getElementById('billing');

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Billing & Payments</h3>
          <p>Create invoices, track paid bills and monitor pending balances.</p>
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
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="bill-search" placeholder="Search by customer, status, date…" oninput="filterBills()" />
        </div>
        <select id="bill-status-filter" onchange="filterBills()">
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onclick="exportBills()" class="btn-ghost" style="border:1px solid var(--border)">⬇ CSV</button>
      </div>

      <div id="bill-count" style="font-size:13px;color:var(--muted);margin-bottom:12px"></div>

      <div id="billing-content" class="table-wrap">
        <div class="skeleton" style="height:200px;border-radius:10px"></div>
      </div>
    </div>

    <!-- Bill Modal -->
    <div id="bill-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-head">
          <h3 id="bill-modal-title">Create Bill</h3>
          <button onclick="closeBillModal()" class="close-btn">×</button>
        </div>

        <input type="hidden" id="bill-edit-id" />

        <div class="form-grid">
          <div>
            <label>Customer Name *</label>
            <input type="text" id="bill-customerName" placeholder="Jane Mwangi" />
          </div>
          <div>
            <label>Amount (KES) *</label>
            <input type="number" id="bill-amount" placeholder="1500" min="0" />
          </div>
          <div>
            <label>Due Date</label>
            <input type="text" id="bill-dueDate" placeholder="30 June 2026" />
          </div>
          <div>
            <label>Status</label>
            <select id="bill-status">
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div class="full">
            <label>Description</label>
            <input type="text" id="bill-description" placeholder="Monthly internet subscription…" />
          </div>
        </div>

        <p id="bill-error" class="error"></p>

        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeBillModal()">Cancel</button>
          <button class="btn-primary" id="save-bill-btn" onclick="saveBill()">Save Bill</button>
        </div>
      </div>
    </div>
  `;

  await fetchBills();
}

async function fetchBills() {
  try {
    const snapshot = await db.collection('billing').get();
    allBills = [];
    snapshot.forEach(doc => allBills.push({ id: doc.id, ...doc.data() }));
    allBills.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    updateBillStats(allBills);
    renderBills(allBills);
  } catch (error) {
    console.error('Billing error:', error);
    document.getElementById('billing-content').innerHTML = `<div class="alert-error">Error loading billing data.</div>`;
  }
}

function updateBillStats(bills) {
  let paid = 0, pending = 0, revenue = 0;
  bills.forEach(b => {
    const status = (b.paymentStatus || b.status || 'pending').toLowerCase();
    const amount = Number(b.amount || 0);
    if (status === 'paid') { paid++; revenue += amount; }
    else { pending++; }
  });

  document.getElementById('bill-total').textContent   = bills.length;
  document.getElementById('bill-paid').textContent    = paid;
  document.getElementById('bill-pending').textContent = pending;
  document.getElementById('bill-revenue').textContent = formatMoney(revenue);
}

function filterBills() {
  const term   = (document.getElementById('bill-search')?.value || '').toLowerCase();
  const status = (document.getElementById('bill-status-filter')?.value || '').toLowerCase();

  const filtered = allBills.filter(b => {
    const combined = [b.customerName, b.amount, b.dueDate, b.paymentStatus, b.status, b.description]
      .join(' ').toLowerCase();
    const matchStatus = b.paymentStatus || b.status || 'pending';
    return combined.includes(term) && (!status || matchStatus.toLowerCase() === status);
  });

  renderBills(filtered);
}

function renderBills(bills) {
  const container = document.getElementById('billing-content');
  const countEl   = document.getElementById('bill-count');

  if (countEl) countEl.textContent = `Showing ${bills.length} of ${allBills.length} bill${allBills.length !== 1 ? 's' : ''}`;

  if (!bills.length) {
    container.innerHTML = emptyState('💳', 'No bills found.', 'Create a new bill to get started.');
    return;
  }

  let html = `<table>
    <thead><tr>
      <th>Customer</th><th>Amount</th><th>Description</th>
      <th>Due Date</th><th>Status</th><th>Created</th><th>Actions</th>
    </tr></thead><tbody>`;

  bills.forEach(b => {
    const status = b.paymentStatus || b.status || 'pending';
    html += `<tr>
      <td><strong>${escapeHtml(b.customerName || 'N/A')}</strong></td>
      <td class="td-mono">${formatMoney(b.amount || 0)}</td>
      <td>${escapeHtml(b.description || '—')}</td>
      <td>${escapeHtml(b.dueDate || '—')}</td>
      <td><span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
      <td>${formatDate(b.createdAt)}</td>
      <td class="actions">
        ${status !== 'paid' ? `<button class="btn-mini success" onclick="markBillPaid('${b.id}')">Mark Paid</button>` : ''}
        <button class="btn-mini edit" onclick="editBill('${b.id}')">Edit</button>
        <button class="btn-mini delete" onclick="deleteBill('${b.id}')">Delete</button>
      </td>
    </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function openBillModal(bill = null) {
  document.getElementById('bill-modal').classList.remove('hidden');
  document.getElementById('bill-error').textContent = '';

  if (bill) {
    document.getElementById('bill-modal-title').textContent = 'Edit Bill';
    document.getElementById('bill-edit-id').value       = bill.id;
    document.getElementById('bill-customerName').value  = bill.customerName || '';
    document.getElementById('bill-amount').value        = bill.amount || '';
    document.getElementById('bill-dueDate').value       = bill.dueDate || '';
    document.getElementById('bill-status').value        = bill.paymentStatus || bill.status || 'pending';
    document.getElementById('bill-description').value   = bill.description || '';
  } else {
    document.getElementById('bill-modal-title').textContent = 'Create Bill';
    document.getElementById('bill-edit-id').value       = '';
    document.getElementById('bill-customerName').value  = '';
    document.getElementById('bill-amount').value        = '';
    document.getElementById('bill-dueDate').value       = '';
    document.getElementById('bill-status').value        = 'pending';
    document.getElementById('bill-description').value   = '';
  }
}

function closeBillModal() {
  document.getElementById('bill-modal').classList.add('hidden');
}

function editBill(id) {
  const bill = allBills.find(b => b.id === id);
  if (!bill) { showToast('Bill not found.', 'error'); return; }
  openBillModal(bill);
}

async function saveBill() {
  const editId       = document.getElementById('bill-edit-id').value;
  const customerName = document.getElementById('bill-customerName').value.trim();
  const amount       = Number(document.getElementById('bill-amount').value);
  const dueDate      = document.getElementById('bill-dueDate').value.trim();
  const paymentStatus = document.getElementById('bill-status').value;
  const description  = document.getElementById('bill-description').value.trim();
  const errorEl      = document.getElementById('bill-error');
  const saveBtn      = document.getElementById('save-bill-btn');

  if (!customerName || !amount) {
    errorEl.textContent = 'Customer name and amount are required.';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const data = {
      customerName, amount, dueDate, paymentStatus, description,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editId) {
      await db.collection('billing').doc(editId).update(data);
      showToast('Bill updated successfully.', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('billing').add(data);
      showToast('Bill created successfully.', 'success');
    }

    closeBillModal();
    await fetchBills();
  } catch (error) {
    console.error(error);
    errorEl.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Bill';
  }
}

async function markBillPaid(id) {
  if (!confirmAction('Mark this bill as paid?')) return;
  try {
    await db.collection('billing').doc(id).update({
      paymentStatus: 'paid',
      paidAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Bill marked as paid.', 'success');
    await fetchBills();
  } catch (error) {
    showToast('Failed to update bill.', 'error');
  }
}

async function deleteBill(id) {
  if (!confirmAction('Delete this bill? This cannot be undone.')) return;
  try {
    await db.collection('billing').doc(id).delete();
    showToast('Bill deleted.', 'success');
    await fetchBills();
  } catch (error) {
    showToast('Failed to delete bill.', 'error');
  }
}

function exportBills() {
  const rows = allBills.map(b => ({
    Customer: b.customerName || '',
    Amount: b.amount || 0,
    Description: b.description || '',
    DueDate: b.dueDate || '',
    Status: b.paymentStatus || b.status || 'pending',
    Created: formatDate(b.createdAt)
  }));
  exportToCSV(rows, 'nextlink-billing.csv');
}

window.loadBilling      = loadBilling;
window.openBillModal    = openBillModal;
window.closeBillModal   = closeBillModal;
window.saveBill         = saveBill;
window.editBill         = editBill;
window.markBillPaid     = markBillPaid;
window.deleteBill       = deleteBill;
window.filterBills      = filterBills;
window.exportBills      = exportBills;
