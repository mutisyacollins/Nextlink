// ==================== PACKAGES.JS ====================

let allPackages = [];

async function loadPackages() {
  const container = document.getElementById('packages');

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Internet Packages</h3>
          <p>Manage WiFi and hotspot service plans offered to customers.</p>
        </div>
        <button onclick="openPackageModal()" class="btn-primary">+ New Package</button>
      </div>

      <div id="packages-list">
        <div class="skeleton" style="height:200px;border-radius:10px"></div>
      </div>
    </div>

    <!-- Package Modal -->
    <div id="package-modal" class="modal hidden">
      <div class="modal-content" style="max-width:580px">
        <div class="modal-head">
          <h3 id="package-modal-title">Add Package</h3>
          <button onclick="closePackageModal()" class="close-btn">×</button>
        </div>

        <input type="hidden" id="package-edit-id" />

        <div class="form-grid">
          <div>
            <label>Package Name *</label>
            <input type="text" id="package-name" placeholder="Home WiFi Basic" />
          </div>
          <div>
            <label>Speed *</label>
            <input type="text" id="package-speed" placeholder="10Mbps" />
          </div>
          <div>
            <label>Price (KES) *</label>
            <input type="number" id="package-price" placeholder="1500" min="0" />
          </div>
          <div>
            <label>Duration</label>
            <input type="text" id="package-duration" placeholder="Monthly" />
          </div>
          <div>
            <label>Status</label>
            <select id="package-status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label>Data Limit</label>
            <input type="text" id="package-data" placeholder="Unlimited / 100GB" />
          </div>
          <div class="full">
            <label>Description</label>
            <input type="text" id="package-description" placeholder="Best for home browsing and streaming" />
          </div>
        </div>

        <p id="package-error" class="error"></p>

        <div class="modal-actions">
          <button class="btn-secondary" onclick="closePackageModal()">Cancel</button>
          <button class="btn-primary" id="save-package-btn" onclick="savePackage()">Save Package</button>
        </div>
      </div>
    </div>
  `;

  await fetchPackages();
}

async function fetchPackages() {
  try {
    const snapshot = await db.collection('packages').get();
    allPackages = [];
    snapshot.forEach(doc => allPackages.push({ id: doc.id, ...doc.data() }));

    if (allPackages.length === 0) {
      document.getElementById('packages-list').innerHTML = emptyState('📦', 'No packages yet.', 'Create your first internet package.');
      return;
    }

    let html = `<div class="package-grid">`;

    allPackages.forEach(p => {
      html += `
        <div class="package-card">
          <div class="package-top">
            <h4>${escapeHtml(p.name || 'Unnamed Package')}</h4>
            <span class="status ${escapeHtml(p.status || 'active')}">${escapeHtml(p.status || 'active')}</span>
          </div>
          <div class="speed">${escapeHtml(p.speed || '—')}</div>
          <div class="price">KES ${Number(p.price || 0).toLocaleString()} <span>/ ${escapeHtml(p.duration || 'month')}</span></div>
          ${p.data ? `<div style="font-size:13px;color:var(--muted);margin-bottom:8px">📊 ${escapeHtml(p.data)}</div>` : ''}
          <p class="desc">${escapeHtml(p.description || 'No description')}</p>
          <div class="pkg-actions">
            <button class="btn-mini edit" onclick="editPackage('${p.id}')">Edit</button>
            <button class="btn-mini ${p.status === 'active' ? 'warn' : 'success'}" onclick="togglePackageStatus('${p.id}', '${p.status || 'active'}')">
              ${p.status === 'inactive' ? 'Activate' : 'Deactivate'}
            </button>
            <button class="btn-mini delete" onclick="deletePackage('${p.id}')">Delete</button>
          </div>
        </div>`;
    });

    html += `</div>`;
    document.getElementById('packages-list').innerHTML = html;
  } catch (error) {
    console.error('Packages error:', error);
    document.getElementById('packages-list').innerHTML = `<div class="alert-error">Error loading packages.</div>`;
  }
}

function openPackageModal(pkg = null) {
  document.getElementById('package-modal').classList.remove('hidden');
  document.getElementById('package-error').textContent = '';

  if (pkg) {
    document.getElementById('package-modal-title').textContent = 'Edit Package';
    document.getElementById('package-edit-id').value    = pkg.id;
    document.getElementById('package-name').value       = pkg.name || '';
    document.getElementById('package-speed').value      = pkg.speed || '';
    document.getElementById('package-price').value      = pkg.price || '';
    document.getElementById('package-duration').value   = pkg.duration || 'Monthly';
    document.getElementById('package-status').value     = pkg.status || 'active';
    document.getElementById('package-data').value       = pkg.data || '';
    document.getElementById('package-description').value = pkg.description || '';
  } else {
    document.getElementById('package-modal-title').textContent = 'Add Package';
    document.getElementById('package-edit-id').value    = '';
    document.getElementById('package-name').value       = '';
    document.getElementById('package-speed').value      = '';
    document.getElementById('package-price').value      = '';
    document.getElementById('package-duration').value   = 'Monthly';
    document.getElementById('package-status').value     = 'active';
    document.getElementById('package-data').value       = '';
    document.getElementById('package-description').value = '';
  }
}

function closePackageModal() {
  document.getElementById('package-modal').classList.add('hidden');
}

function editPackage(id) {
  const pkg = allPackages.find(p => p.id === id);
  if (!pkg) { showToast('Package not found.', 'error'); return; }
  openPackageModal(pkg);
}

async function savePackage() {
  const editId      = document.getElementById('package-edit-id').value;
  const name        = document.getElementById('package-name').value.trim();
  const speed       = document.getElementById('package-speed').value.trim();
  const price       = Number(document.getElementById('package-price').value);
  const duration    = document.getElementById('package-duration').value.trim() || 'Monthly';
  const status      = document.getElementById('package-status').value;
  const data        = document.getElementById('package-data').value.trim();
  const description = document.getElementById('package-description').value.trim();
  const errorEl     = document.getElementById('package-error');
  const saveBtn     = document.getElementById('save-package-btn');

  if (!name || !speed || !price) {
    errorEl.textContent = 'Name, speed and price are required.';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const payload = {
      name, speed, price, duration, status, data, description,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editId) {
      await db.collection('packages').doc(editId).update(payload);
      showToast('Package updated.', 'success');
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('packages').add(payload);
      showToast('Package created.', 'success');
    }

    closePackageModal();
    await fetchPackages();
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Package';
  }
}

async function togglePackageStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  try {
    await db.collection('packages').doc(id).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Package ${newStatus}.`, 'success');
    await fetchPackages();
  } catch (error) {
    showToast('Failed to update package.', 'error');
  }
}

async function deletePackage(id) {
  if (!confirmAction('Delete this package? This cannot be undone.')) return;
  try {
    await db.collection('packages').doc(id).delete();
    showToast('Package deleted.', 'success');
    await fetchPackages();
  } catch (error) {
    showToast('Failed to delete package.', 'error');
  }
}

window.loadPackages          = loadPackages;
window.openPackageModal      = openPackageModal;
window.closePackageModal     = closePackageModal;
window.savePackage           = savePackage;
window.editPackage           = editPackage;
window.deletePackage         = deletePackage;
window.togglePackageStatus   = togglePackageStatus;
