// ── Constants ──────────────────────────────────────────────────────────────

const EXPENSE_CATS = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Utilities', 'Other'];
const INCOME_CATS  = ['Salary', 'Freelance', 'Investment', 'Other'];
const STORAGE_KEY  = 'spendwise_tx';

// ── State ──────────────────────────────────────────────────────────────────

let currentType  = 'expense';
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

// ── Persistence ────────────────────────────────────────────────────────────

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ── Formatting Helpers ─────────────────────────────────────────────────────

function fmt(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(d) {
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[parseInt(m) - 1]} ${y}`;
}

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Form: Type Toggle ──────────────────────────────────────────────────────

function setType(t) {
  currentType = t;
  document.getElementById('btnExpense').classList.toggle('active', t === 'expense');
  document.getElementById('btnIncome').classList.toggle('active',  t === 'income');
  populateCategorySelect();
}

// ── Form: Category Dropdown ────────────────────────────────────────────────

function populateCategorySelect() {
  const cats = currentType === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  const sel  = document.getElementById('category');
  sel.innerHTML =
    '<option value="">— Select —</option>' +
    cats.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join('');
}

// ── Filter: Category Dropdown ──────────────────────────────────────────────

function populateFilterCat() {
  const used = [...new Set(transactions.map(t => t.category))].sort();
  const sel  = document.getElementById('filterCat');
  sel.innerHTML =
    '<option value="">All Categories</option>' +
    used.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('');
}

// ── Add Transaction ────────────────────────────────────────────────────────

function addTransaction() {
  const desc   = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const cat    = document.getElementById('category').value;
  const date   = document.getElementById('date').value;

  if (!desc)               { alert('Please enter a description.'); return; }
  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!cat)                { alert('Please select a category.'); return; }
  if (!date)               { alert('Please select a date.'); return; }

  transactions.unshift({ id: Date.now(), type: currentType, desc, amount, category: cat, date });
  save();

  // Clear inputs
  document.getElementById('desc').value   = '';
  document.getElementById('amount').value = '';

  render();
}

// ── Delete Transaction ─────────────────────────────────────────────────────

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
}

// ── Clear All ──────────────────────────────────────────────────────────────

function clearAll() {
  if (transactions.length === 0) return;
  if (confirm('Delete all transactions?')) {
    transactions = [];
    save();
    render();
  }
}

// ── Filtering & Sorting ────────────────────────────────────────────────────

function getFiltered() {
  const q    = document.getElementById('search').value.toLowerCase();
  const type = document.getElementById('filterType').value;
  const cat  = document.getElementById('filterCat').value;
  const sort = document.getElementById('sortBy').value;

  let list = transactions.filter(t => {
    if (type && t.type !== type) return false;
    if (cat  && t.category !== cat) return false;
    if (q && !t.desc.toLowerCase().includes(q) && !t.category.includes(q)) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sort === 'date-desc')   return b.date.localeCompare(a.date);
    if (sort === 'date-asc')    return a.date.localeCompare(b.date);
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc')  return a.amount - b.amount;
  });

  return list;
}

// ── Render ─────────────────────────────────────────────────────────────────

function render() {
  populateFilterCat();

  const list = getFiltered();
  const all  = transactions;

  // --- Summary ---
  const income  = all.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = all.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);

  const nb = document.getElementById('netBalance');
  nb.textContent = (balance < 0 ? '-' : '') + fmt(balance);
  nb.style.color = balance < 0 ? 'var(--red)' : balance === 0 ? 'var(--muted)' : 'var(--green)';

  // --- Count badge ---
  document.getElementById('txCount').textContent =
    `${list.length} entr${list.length === 1 ? 'y' : 'ies'}`;

  // --- Transaction list ---
  const container = document.getElementById('txList');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty">No transactions found.</div>';
  } else {
    container.innerHTML = list.map(t => `
      <div class="tx-item">
        <div class="tx-dot ${t.type}"></div>
        <div class="tx-info">
          <div class="tx-desc">${escHtml(t.desc)}</div>
          <div class="tx-meta">
            <span class="tx-cat cat-${t.category}">${t.category}</span>
            <span>${formatDate(t.date)}</span>
          </div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
        <button class="delete-btn" onclick="deleteTransaction(${t.id})" title="Delete">×</button>
      </div>
    `).join('');
  }

  // --- Bar chart (top expense categories) ---
  const expTx     = all.filter(t => t.type === 'expense');
  const catTotals = {};
  expTx.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });

  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxVal = sorted.length ? sorted[0][1] : 1;

  const chartEl = document.getElementById('barChart');
  const panel   = document.getElementById('chartPanel');

  if (sorted.length === 0) {
    panel.style.display = 'none';
  } else {
    panel.style.display = '';
    chartEl.innerHTML = sorted.map(([cat, val]) => `
      <div class="bar-row">
        <div class="bar-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
        <div class="bar-track">
          <div class="bar-fill expense" style="width:${(val / maxVal * 100).toFixed(1)}%"></div>
        </div>
        <div class="bar-val">${fmt(val)}</div>
      </div>
    `).join('');
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

document.getElementById('date').valueAsDate = new Date();

document.getElementById('headerDate').textContent =
  new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

populateCategorySelect();
render();