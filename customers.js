// ==================== CUSTOMERS.JS ====================

let allCustomers = [];

async function loadCustomers() {
  const container = document.getElementById('customers');

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Customers Management</h3>
          <p>View, add, update and manage your ISP subscribers.</p>
        </div>
        <div class="card-head-actions">
          <button onclick="exportCustomers()" class="btn-secondary">⬇ Export CSV</button>
          <button onclick="openCustomerModal()" class="btn-primary">+ Add Customer</button>
        </div>
      </div>

      <div class="toolbar triple">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="customer-search" placeholder="Search name, email, phone, plan…" oninput="filterCustomers()" />
        </div>
        <select id="status-filter" onchange="filterCustomers()">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <select id="plan-filter" onchange="filterCustomers()">
          <option value="">All Plans</option>
        </select>
      </div>

      <div id="customer-count" style="font-size:13px;color:var(--muted);margin-bottom:12px"></div>

      <div id="customers-table" class="table-wrap">
        <div class="skeleton" style="height:200px;border-radius:10px"></div>
      </div>
    </div>

    <!-- Customer Modal -->
    <div id="customer-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-head">
          <h3 id="customer-modal-title">Add Customer</h3>
          <button onclick="closeCustomerModal()" class="close-btn">×</button>
        </div>

        <input type="hidden" id="customer-id" />

        <div class="form-grid">
          <div>
            <label>Full Name *</label>
            <input type="text" id="customer-fullName" placeholder="Jane Mwangi" />
          </div>
          <div>
            <label>Email</label>
            <input type="email" id="customer-email" placeholder="jane@example.com" />
          </div>
          <div>
            <label>Phone</label>
            <input type="text" id="customer-phone" placeholder="+254 7XX XXX XXX" />
          </div>
          <div>
            <label>Location</label>
            <input type="text" id="customer-location" placeholder="Nairobi, Kitengela…" />
          </div>
          <div>
            <label>Plan / Package</label>
            <input type="text" id="customer-plan" placeholder="Home WiFi 10Mbps" />
          </div>
          <div>
            <label>Status</label>
            <select id="customer-status">
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label>Bill Due Date</label>
            <input type="text" id="customer-billDueDate" placeholder="30 June 2026" />
          </div>
          <div>
            <label>Account Number</label>
            <input type="text" id="customer-accountNumber" placeholder="NXT-0001" />
          </div>
          <div class="full">
            <label>Notes</label>
            <input type="text" id="customer-notes" placeholder="Additional notes…" />
          </div>
        </div>

        <p id="customer-form-error" class="error"></p>

        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeCustomerModal()">Cancel</button>
          <button class="btn-primary" id="save-customer-btn" onclick="saveCustomer()">Save Customer</button>
        </div>
      </div>
    </div>
  `;

  await fetchCustomers();
}

async function fetchCustomers() {
  try {
    const snapshot = await db.collection('users').get();
    allCustomers = [];
    snapshot.forEach(doc => allCustomers.push({ id: doc.id, ...doc.data() }));
    allCustomers.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    // Populate plan filter
    const plans = [...new Set(allCustomers.map(c => c.plan || c.packageName || c.package).filter(Boolean))];
    const planFilter = document.getElementById('plan-filter');
    if (planFilter) {
      plans.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        planFilter.appendChild(opt);
      });
    }

    renderCustomers(allCustomers);
  } catch (error) {
    console.error('Customers error:', error);
    document.getElementById('customers-table').innerHTML = `
      <div class="alert-error">Error loading customers. Check Firestore rules and admin access.</div>
    `;
  }
}

function renderCustomers(customers) {
  const tableDiv = document.getElementById('customers-table');
  const countEl  = document.getElementById('customer-count');

  if (countEl) {
    countEl.textContent = `Showing ${customers.length} of ${allCustomers.length} customer${allCustomers.length !== 1 ? 's' : ''}`;
  }

  if (!customers || !customers.length) {
    tableDiv.innerHTML = emptyState('👥', 'No customers match your search.', 'Try adjusting the filters above.');
    return;
  }

  let html = `<table>
    <thead><tr>
      <th>Name</th>
      <th>Contact</th>
      <th>Plan</th>
      <th>Status</th>
      <th>Due Date</th>
      <th>Actions</th>
    </tr></thead><tbody>`;

  customers.forEach(c => {
    const name = getCustomerName(c);
    html += `<tr>
      <td>
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(c.accountNumber || c.id || '')}</small>
      </td>
      <td>
        ${escapeHtml(c.email || '—')}
        <small>${escapeHtml(c.phone || c.phoneNumber || '')}</small>
      </td>
      <td>${escapeHtml(c.plan || c.packageName || c.package || 'Pending Activation')}</td>
      <td><span class="status ${escapeHtml(c.status || 'pending')}">${escapeHtml(c.status || 'pending')}</span></td>
      <td>${escapeHtml(c.billDueDate || c.dueDate || '—')}</td>
      <td class="actions">
        <button onclick="editCustomer('${c.id}')" class="btn-mini edit">Edit</button>
        <button onclick="suspendToggle('${c.id}', '${c.status || 'pending'}')" class="btn-mini warn">${c.status === 'suspended' ? 'Activate' : 'Suspend'}</button>
        <button onclick="deleteCustomer('${c.id}')" class="btn-mini delete">Delete</button>
      </td>
    </tr>`;
  });

  html += `</tbody></table>`;
  tableDiv.innerHTML = html;
}

function filterCustomers() {
  const term   = (document.getElementById('customer-search')?.value || '').toLowerCase();
  const status = (document.getElementById('status-filter')?.value || '').toLowerCase();
  const plan   = (document.getElementById('plan-filter')?.value || '').toLowerCase();

  const filtered = allCustomers.filter(c => {
    const combined = [
      getCustomerName(c), c.email, c.phone, c.phoneNumber,
      c.location, c.plan, c.packageName, c.package, c.status, c.accountNumber
    ].join(' ').toLowerCase();

    return combined.includes(term)
      && (!status || (c.status || '').toLowerCase() === status)
      && (!plan || (c.plan || c.packageName || c.package || '').toLowerCase() === plan);
  });

  renderCustomers(filtered);
}

function openCustomerModal(customer = null) {
  document.getElementById('customer-modal').classList.remove('hidden');
  document.getElementById('customer-form-error').textContent = '';

  if (customer) {
    document.getElementById('customer-modal-title').textContent = 'Edit Customer';
    document.getElementById('customer-id').value          = customer.id;
    document.getElementById('customer-fullName').value    = getCustomerName(customer);
    document.getElementById('customer-email').value       = customer.email || '';
    document.getElementById('customer-phone').value       = customer.phone || customer.phoneNumber || '';
    document.getElementById('customer-location').value    = customer.location || '';
    document.getElementById('customer-plan').value        = customer.plan || customer.packageName || customer.package || '';
    document.getElementById('customer-status').value      = customer.status || 'pending';
    document.getElementById('customer-billDueDate').value = customer.billDueDate || customer.dueDate || '';
    document.getElementById('customer-accountNumber').value = customer.accountNumber || '';
    document.getElementById('customer-notes').value       = customer.notes || '';
  } else {
    document.getElementById('customer-modal-title').textContent = 'Add Customer';
    clearCustomerForm();
  }
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.add('hidden');
}

async function saveCustomer() {
  const id          = document.getElementById('customer-id').value;
  const fullName    = document.getElementById('customer-fullName').value.trim();
  const email       = document.getElementById('customer-email').value.trim();
  const phone       = document.getElementById('customer-phone').value.trim();
  const location    = document.getElementById('customer-location').value.trim();
  const plan        = document.getElementById('customer-plan').value.trim() || 'Pending Activation';
  const status      = document.getElementById('customer-status').value;
  const billDueDate = document.getElementById('customer-billDueDate').value.trim();
  const accountNumber = document.getElementById('customer-accountNumber').value.trim();
  const notes       = document.getElementById('customer-notes').value.trim();
  const errorEl     = document.getElementById('customer-form-error');
  const saveBtn     = document.getElementById('save-customer-btn');

  if (!fullName) { errorEl.textContent = 'Customer name is required.'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const data = {
    fullName, email, phone, location, plan, status,
    billDueDate, accountNumber, notes,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) {
      await db.collection('users').doc(id).update(data);
      showToast('Customer updated successfully.', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('users').add(data);
      showToast('Customer added successfully.', 'success');
    }

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
}

function editCustomer(id) {
  const customer = allCustomers.find(c => c.id === id);
  if (!customer) { showToast('Customer not found.', 'error'); return; }
  openCustomerModal(customer);
}

async function suspendToggle(id, currentStatus) {
  const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
  const label     = newStatus === 'suspended' ? 'Suspend' : 'Activate';
  if (!confirmAction(`${label} this customer?`)) return;

  try {
    await db.collection('users').doc(id).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Customer ${newStatus}.`, 'success');
    await fetchCustomers();
  } catch (error) {
    showToast('Failed to update status.', 'error');
  }
}

async function deleteCustomer(id) {
  const customer = allCustomers.find(c => c.id === id);
  const name = customer ? getCustomerName(customer) : 'this customer';
  if (!confirmAction(`Delete ${name}? This cannot be undone.`)) return;

  try {
    await db.collection('users').doc(id).delete();
    showToast('Customer deleted.', 'success');
    await fetchCustomers();
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (error) {
    showToast('Failed to delete customer: ' + error.message, 'error');
  }
}

function exportCustomers() {
  const rows = allCustomers.map(c => ({
    Name: getCustomerName(c),
    Email: c.email || '',
    Phone: c.phone || c.phoneNumber || '',
    Location: c.location || '',
    Plan: c.plan || c.packageName || c.package || '',
    Status: c.status || 'pending',
    DueDate: c.billDueDate || c.dueDate || '',
    AccountNumber: c.accountNumber || ''
  }));
  exportToCSV(rows, 'nextlink-customers.csv');
}

function clearCustomerForm() {
  ['customer-id','customer-fullName','customer-email','customer-phone',
   'customer-location','customer-plan','customer-billDueDate','customer-accountNumber','customer-notes']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const status = document.getElementById('customer-status');
  if (status) status.value = 'pending';
}

window.loadCustomers      = loadCustomers;
window.filterCustomers    = filterCustomers;
window.openCustomerModal  = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.saveCustomer       = saveCustomer;
window.editCustomer       = editCustomer;
window.deleteCustomer     = deleteCustomer;
window.suspendToggle      = suspendToggle;
window.exportCustomers    = exportCustomers;
