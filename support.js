// ==================== SUPPORT.JS — AUTO-LINKED SUPPORT TICKETS ====================

let allTickets = [];
let supportCustomers = [];

async function loadSupport() {
  const container = document.getElementById('support');

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Support Tickets</h3>
          <p>Monitor, manage and resolve customer support issues. Tickets can now be linked directly to customers.</p>
        </div>
        <div class="card-head-actions">
          <button onclick="exportTickets()" class="btn-secondary">⬇ Export CSV</button>
          <button onclick="openTicketModal()" class="btn-primary">+ New Ticket</button>
        </div>
      </div>

      <div class="mini-stats" style="grid-template-columns:repeat(4,1fr)">
        <div><span>Total</span><strong id="ticket-total">—</strong></div>
        <div><span>Open</span><strong id="ticket-open" style="color:var(--pink)">—</strong></div>
        <div><span>In Progress</span><strong id="ticket-progress" style="color:var(--orange)">—</strong></div>
        <div><span>Closed</span><strong id="ticket-closed" style="color:var(--emerald)">—</strong></div>
      </div>

      <div class="toolbar triple">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="ticket-search" placeholder="Search customer, account, issue, phone…" oninput="filterTickets()" />
        </div>
        <select id="ticket-status-filter" onchange="filterTickets()">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="closed">Closed</option>
          <option value="resolved">Resolved</option>
        </select>
        <select id="ticket-priority-filter" onchange="filterTickets()">
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div id="ticket-count" style="font-size:13px;color:var(--muted);margin-bottom:12px"></div>

      <div id="support-content" class="table-wrap">
        <div class="skeleton" style="height:220px;border-radius:10px"></div>
      </div>
    </div>

    <div id="ticket-modal" class="modal hidden">
      <div class="modal-content" style="max-width:720px">
        <div class="modal-head">
          <h3 id="ticket-modal-title">New Ticket</h3>
          <button onclick="closeTicketModal()" class="close-btn">×</button>
        </div>

        <input type="hidden" id="ticket-edit-id" />
        <input type="hidden" id="ticket-customer-id" />

        <div class="form-grid">
          <div class="full">
            <label>Select Existing Customer</label>
            <select id="ticket-customer-select" onchange="handleTicketCustomerSelect()">
              <option value="">Manual ticket / no linked customer</option>
            </select>
          </div>

          <div>
            <label>Customer Name *</label>
            <input type="text" id="ticket-customerName" placeholder="Jane Mwangi" />
          </div>
          <div>
            <label>Phone</label>
            <input type="text" id="ticket-phone" placeholder="+254 7XX XXX XXX" />
          </div>
          <div>
            <label>Account Number</label>
            <input type="text" id="ticket-accountNumber" placeholder="NXT-1001" />
          </div>
          <div>
            <label>Package</label>
            <input type="text" id="ticket-package" placeholder="Home 20 Mbps" />
          </div>
          <div class="full">
            <label>Issue / Subject *</label>
            <input type="text" id="ticket-issue" placeholder="Describe the customer's issue…" />
          </div>
          <div>
            <label>Priority</label>
            <select id="ticket-priority">
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select id="ticket-status">
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="closed">Closed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div class="full">
            <label>Notes / Resolution</label>
            <input type="text" id="ticket-notes" placeholder="Additional notes or resolution steps…" />
          </div>
        </div>

        <p id="ticket-error" class="error"></p>

        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeTicketModal()">Cancel</button>
          <button class="btn-primary" id="save-ticket-btn" onclick="saveTicket()">Save Ticket</button>
        </div>
      </div>
    </div>
  `;

  await Promise.all([fetchSupportCustomers(), fetchTickets()]);
  populateCustomerSelect();
}

async function fetchSupportCustomers() {
  try {
    const snapshot = await db.collection('users').get();
    supportCustomers = [];
    snapshot.forEach(doc => supportCustomers.push({ id: doc.id, ...doc.data() }));
    supportCustomers.sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b)));
  } catch (error) {
    console.warn('Could not load users for ticket linking:', error);
    supportCustomers = [];
  }
}

function populateCustomerSelect() {
  const select = document.getElementById('ticket-customer-select');
  if (!select) return;
  select.innerHTML = `<option value="">Manual ticket / no linked customer</option>` + supportCustomers.map(c => {
    const name = getCustomerName(c);
    const acc = c.accountNumber || 'No account';
    return `<option value="${escapeHtml(c.id)}">${escapeHtml(name)} — ${escapeHtml(acc)}</option>`;
  }).join('');
}

function handleTicketCustomerSelect() {
  const id = document.getElementById('ticket-customer-select').value;
  const customer = supportCustomers.find(c => c.id === id);
  document.getElementById('ticket-customer-id').value = id || '';
  if (!customer) return;

  document.getElementById('ticket-customerName').value = getCustomerName(customer);
  document.getElementById('ticket-phone').value = customer.phone || customer.phoneNumber || '';
  document.getElementById('ticket-accountNumber').value = customer.accountNumber || '';
  document.getElementById('ticket-package').value = customer.plan || customer.packageName || customer.package || '';
}

async function fetchTickets() {
  try {
    let snapshot;
    try { snapshot = await db.collection('supportTickets').orderBy('createdAt', 'desc').get(); }
    catch { snapshot = await db.collection('supportTickets').get(); }

    allTickets = [];
    snapshot.forEach(doc => allTickets.push({ id: doc.id, ...doc.data() }));
    allTickets.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    updateTicketStats(allTickets);
    renderTickets(allTickets);
  } catch (error) {
    console.error('Support error:', error);
    document.getElementById('support-content').innerHTML = `<div class="alert-error">Error loading support tickets.</div>`;
  }
}

function updateTicketStats(tickets) {
  const open = tickets.filter(t => (t.status || 'open').toLowerCase() === 'open').length;
  const progress = tickets.filter(t => (t.status || '').toLowerCase() === 'in-progress').length;
  const closed = tickets.filter(t => ['closed','resolved'].includes((t.status || '').toLowerCase())).length;
  document.getElementById('ticket-total').textContent = tickets.length;
  document.getElementById('ticket-open').textContent = open;
  document.getElementById('ticket-progress').textContent = progress;
  document.getElementById('ticket-closed').textContent = closed;
}

function filterTickets() {
  const term = (document.getElementById('ticket-search')?.value || '').toLowerCase();
  const status = (document.getElementById('ticket-status-filter')?.value || '').toLowerCase();
  const priority = (document.getElementById('ticket-priority-filter')?.value || '').toLowerCase();

  const filtered = allTickets.filter(t => {
    const combined = [t.customerName, t.name, t.accountNumber, t.package, t.packageName, t.issue, t.subject, t.notes, t.phone]
      .join(' ').toLowerCase();
    return combined.includes(term)
      && (!status || (t.status || 'open').toLowerCase() === status)
      && (!priority || (t.priority || 'medium').toLowerCase() === priority);
  });
  renderTickets(filtered);
}

function renderTickets(tickets) {
  const container = document.getElementById('support-content');
  const countEl = document.getElementById('ticket-count');
  if (countEl) countEl.textContent = `Showing ${tickets.length} of ${allTickets.length} ticket${allTickets.length !== 1 ? 's' : ''}`;

  if (!tickets.length) {
    container.innerHTML = emptyState('🎧', 'No tickets found.', 'All issues resolved!');
    return;
  }

  let html = `<table>
    <thead><tr>
      <th>Customer</th><th>Issue</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th>
    </tr></thead><tbody>`;

  tickets.forEach(t => {
    const status = t.status || 'open';
    const priority = t.priority || 'medium';
    html += `<tr>
      <td ${t.customerId ? `class="clickable-cell" onclick="openCustomerDrawer('${t.customerId}')"` : ''}>
        <strong>${escapeHtml(t.customerName || t.name || 'Unknown')}</strong>
        <small>${escapeHtml(t.accountNumber || t.phone || '')}</small>
      </td>
      <td>${escapeHtml(t.issue || t.subject || 'No subject')}${t.notes ? `<small>${escapeHtml(t.notes)}</small>` : ''}</td>
      <td><span class="ticket-priority priority-${escapeHtml(priority)}">${escapeHtml(priority)}</span></td>
      <td><span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
      <td>${formatDate(t.createdAt)}</td>
      <td class="actions">
        ${status === 'open' || status === 'in-progress'
          ? `<button class="btn-mini success" onclick="updateTicketStatus('${t.id}','closed')">Close</button>`
          : `<button class="btn-mini warn" onclick="updateTicketStatus('${t.id}','open')">Reopen</button>`}
        <button class="btn-mini edit" onclick="editTicket('${t.id}')">Edit</button>
        <button class="btn-mini delete" onclick="deleteTicket('${t.id}')">Delete</button>
      </td>
    </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function openTicketModal(ticket = null) {
  document.getElementById('ticket-modal').classList.remove('hidden');
  document.getElementById('ticket-error').textContent = '';
  if (!supportCustomers.length) await fetchSupportCustomers();
  populateCustomerSelect();

  if (ticket) {
    document.getElementById('ticket-modal-title').textContent = 'Edit Ticket';
    document.getElementById('ticket-edit-id').value = ticket.id;
    document.getElementById('ticket-customer-id').value = ticket.customerId || '';
    document.getElementById('ticket-customer-select').value = ticket.customerId || '';
    document.getElementById('ticket-customerName').value = ticket.customerName || ticket.name || '';
    document.getElementById('ticket-phone').value = ticket.phone || '';
    document.getElementById('ticket-accountNumber').value = ticket.accountNumber || '';
    document.getElementById('ticket-package').value = ticket.package || ticket.packageName || '';
    document.getElementById('ticket-issue').value = ticket.issue || ticket.subject || '';
    document.getElementById('ticket-priority').value = ticket.priority || 'medium';
    document.getElementById('ticket-status').value = ticket.status || 'open';
    document.getElementById('ticket-notes').value = ticket.notes || '';
  } else {
    document.getElementById('ticket-modal-title').textContent = 'New Ticket';
    ['ticket-edit-id','ticket-customer-id','ticket-customerName','ticket-phone','ticket-accountNumber','ticket-package','ticket-issue','ticket-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ticket-customer-select').value = '';
    document.getElementById('ticket-priority').value = 'medium';
    document.getElementById('ticket-status').value = 'open';
  }
}

function closeTicketModal() { document.getElementById('ticket-modal').classList.add('hidden'); }

function editTicket(id) {
  const ticket = allTickets.find(t => t.id === id);
  if (!ticket) { showToast('Ticket not found.', 'error'); return; }
  openTicketModal(ticket);
}

async function saveTicket() {
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
      customerId: customerId || null,
      customerName,
      name: customerName,
      phone,
      accountNumber,
      package: packageName,
      packageName,
      issue,
      subject: issue,
      priority,
      status,
      notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editId) {
      await db.collection('supportTickets').doc(editId).update(data);
      showToast('Ticket updated.', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('supportTickets').add(data);
      showToast('Ticket created.', 'success');
    }

    closeTicketModal();
    await fetchTickets();
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Ticket';
  }
}

async function updateTicketStatus(id, status) {
  try {
    await db.collection('supportTickets').doc(id).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast(`Ticket ${status}.`, 'success');
    await fetchTickets();
  } catch (error) { showToast('Failed to update ticket.', 'error'); }
}

async function deleteTicket(id) {
  if (!confirmAction('Delete this ticket? This cannot be undone.')) return;
  try {
    await db.collection('supportTickets').doc(id).delete();
    showToast('Ticket deleted.', 'success');
    await fetchTickets();
  } catch (error) { showToast('Failed to delete ticket.', 'error'); }
}

function exportTickets() {
  const rows = allTickets.map(t => ({
    Customer: t.customerName || t.name || '',
    CustomerId: t.customerId || '',
    Account: t.accountNumber || '',
    Phone: t.phone || '',
    Package: t.package || t.packageName || '',
    Issue: t.issue || t.subject || '',
    Priority: t.priority || 'medium',
    Status: t.status || 'open',
    Notes: t.notes || '',
    Created: formatDate(t.createdAt)
  }));
  exportToCSV(rows, 'nextlink-tickets.csv');
}

window.loadSupport = loadSupport;
window.updateTicketStatus = updateTicketStatus;
window.deleteTicket = deleteTicket;
window.openTicketModal = openTicketModal;
window.closeTicketModal = closeTicketModal;
window.saveTicket = saveTicket;
window.editTicket = editTicket;
window.filterTickets = filterTickets;
window.exportTickets = exportTickets;
window.handleTicketCustomerSelect = handleTicketCustomerSelect;
