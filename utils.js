// ==================== UTILS.JS — Shared helpers ====================

// ── Toast Notifications ──────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── HTML escaping ─────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ── Money formatting ──────────────────────────────────────────────
function formatMoney(value) {
  return 'KES ' + Number(value || 0).toLocaleString('en-KE');
}

// ── Date formatting ───────────────────────────────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '—';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

// ── Timestamp to ms ───────────────────────────────────────────────
function getMillis(timestamp) {
  if (!timestamp) return 0;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  return 0;
}

// ── Customer name fallback ────────────────────────────────────────
function getCustomerName(c) {
  return c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'N/A';
}

// ── Confirm dialog ────────────────────────────────────────────────
function confirmAction(message) {
  return window.confirm(message);
}

// ── CSV export ────────────────────────────────────────────────────
function exportToCSV(rows, filename) {
  if (!rows || !rows.length) {
    showToast('No data to export.', 'error');
    return;
  }
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} records.`, 'success');
}

// ── Mobile sidebar ────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('show');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
}

// ── Refresh current section ───────────────────────────────────────
let _currentSection = 'dashboard';

function refreshCurrentSection() {
  const loaders = {
    dashboard: 'loadDashboard',
    customers: 'loadCustomers',
    billing: 'loadBilling',
    packages: 'loadPackages',
    support: 'loadSupport'
  };
  const fn = window[loaders[_currentSection]];
  if (typeof fn === 'function') {
    fn();
    showToast('Refreshed.', 'info', 1500);
  }
}

// ── Empty state HTML ──────────────────────────────────────────────
function emptyState(icon, message, sub = '') {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <p>${escapeHtml(message)}</p>
      ${sub ? `<small>${escapeHtml(sub)}</small>` : ''}
    </div>
  `;
}

window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.formatMoney = formatMoney;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.getMillis = getMillis;
window.getCustomerName = getCustomerName;
window.exportToCSV = exportToCSV;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.refreshCurrentSection = refreshCurrentSection;
window.emptyState = emptyState;
window._currentSection = _currentSection;
