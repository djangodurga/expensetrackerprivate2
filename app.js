// ------- State -------
let currentUser = null;
let expenses = [];
let unsubscribeExpenses = null;
let mainChart = null;
let categoryChart = null;
let activeRange = 'day';

const CATEGORY_EMOJI = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️', Bills: '💡',
  Entertainment: '🎬', Health: '💊', Education: '📚', Other: '🔖'
};

const CATEGORY_COLORS = {
  Food: '#fd79a8', Transport: '#74b9ff', Shopping: '#a29bfe', Bills: '#fdcb6e',
  Entertainment: '#55efc4', Health: '#e17055', Education: '#00cec9', Other: '#636e72'
};

// ------- DOM refs -------
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const signInBtn = document.getElementById('google-signin-btn');
const signOutBtn = document.getElementById('signout-btn');
const loginError = document.getElementById('login-error');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const expenseForm = document.getElementById('expense-form');
const expenseList = document.getElementById('expense-list');
const searchInput = document.getElementById('search-input');
const dateInput = document.getElementById('date');

dateInput.valueAsDate = new Date();

// ------- Auth -------
signInBtn.addEventListener('click', () => {
  loginError.textContent = '';
  auth.signInWithPopup(googleProvider).catch(err => {
    loginError.textContent = err.message;
  });
});

signOutBtn.addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    loginScreen.classList.add('hidden');
    appShell.classList.remove('hidden');
    userPhoto.src = user.photoURL || 'https://www.svgrepo.com/show/452030/avatar-default.svg';
    userName.textContent = user.displayName || user.email;
    subscribeToExpenses();
  } else {
    currentUser = null;
    loginScreen.classList.remove('hidden');
    appShell.classList.add('hidden');
    if (unsubscribeExpenses) { unsubscribeExpenses(); unsubscribeExpenses = null; }
    expenses = [];
  }
});

// ------- Firestore -------
function subscribeToExpenses() {
  if (unsubscribeExpenses) unsubscribeExpenses();
  unsubscribeExpenses = db.collection('users').doc(currentUser.uid)
    .collection('expenses')
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderAll();
    }, err => {
      showToast('Error loading expenses: ' + err.message);
    });
}

expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const date = document.getElementById('date').value;
  const note = document.getElementById('note').value.trim();

  if (!amount || amount <= 0 || !date) return;

  try {
    await db.collection('users').doc(currentUser.uid).collection('expenses').add({
      amount, category, date, note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    expenseForm.reset();
    dateInput.valueAsDate = new Date();
    showToast('Expense added!');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

async function deleteExpense(id) {
  try {
    await db.collection('users').doc(currentUser.uid).collection('expenses').doc(id).delete();
    showToast('Expense deleted');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// ------- Rendering -------
function renderAll() {
  renderStats();
  renderExpenseList();
  renderMainChart();
  renderCategoryChart();
}

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  return toDateOnly(start);
}

function renderStats() {
  const now = new Date();
  const todayStart = toDateOnly(now);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let today = 0, week = 0, month = 0, total = 0;

  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const dOnly = toDateOnly(d);
    total += exp.amount;
    if (dOnly.getTime() === todayStart.getTime()) today += exp.amount;
    if (dOnly.getTime() >= weekStart.getTime()) week += exp.amount;
    if (dOnly.getTime() >= monthStart.getTime()) month += exp.amount;
  });

  document.getElementById('stat-today').textContent = formatCurrency(today);
  document.getElementById('stat-week').textContent = formatCurrency(week);
  document.getElementById('stat-month').textContent = formatCurrency(month);
  document.getElementById('stat-total').textContent = formatCurrency(total);
}

function formatCurrency(v) {
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function renderExpenseList() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = expenses.filter(exp => {
    if (!query) return true;
    return (exp.note || '').toLowerCase().includes(query) ||
           (exp.category || '').toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    expenseList.innerHTML = '<p class="empty-state">No expenses found.</p>';
    return;
  }

  expenseList.innerHTML = filtered.map(exp => `
    <div class="expense-item">
      <div class="expense-left">
        <div class="expense-cat-badge">${CATEGORY_EMOJI[exp.category] || '🔖'}</div>
        <div class="expense-info">
          <span class="expense-note">${escapeHtml(exp.note) || exp.category}</span>
          <span class="expense-meta">${exp.category} • ${formatDate(exp.date)}</span>
        </div>
      </div>
      <div class="expense-right">
        <span class="expense-amount">${formatCurrency(exp.amount)}</span>
        <button class="btn-delete" data-id="${exp.id}" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');

  expenseList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteExpense(btn.dataset.id));
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

searchInput.addEventListener('input', renderExpenseList);

// ------- Charts -------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRange = btn.dataset.range;
    renderMainChart();
  });
});

function renderMainChart() {
  const ctx = document.getElementById('mainChart').getContext('2d');
  const { labels, data } = buildRangeData(activeRange);

  if (mainChart) mainChart.destroy();

  mainChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Expenses',
        data,
        backgroundColor: labels.map((_, i) => gradientColor(i, labels.length)),
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '₹' + v } }
      }
    }
  });
}

function gradientColor(i, total) {
  const colors = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e', '#55efc4', '#74b9ff', '#e17055', '#a29bfe'];
  return colors[i % colors.length];
}

function buildRangeData(range) {
  const now = new Date();
  let labels = [];
  let data = [];

  if (range === 'day') {
    // last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayStart = toDateOnly(d);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      const sum = expenses.reduce((acc, exp) => {
        const eD = toDateOnly(new Date(exp.date));
        return eD.getTime() === dayStart.getTime() ? acc + exp.amount : acc;
      }, 0);
      labels.push(label);
      data.push(sum);
    }
  } else if (range === 'week') {
    // last 6 weeks
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      const wStart = startOfWeek(d);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      const label = `${wStart.getDate()}/${wStart.getMonth() + 1}`;
      const sum = expenses.reduce((acc, exp) => {
        const eD = toDateOnly(new Date(exp.date));
        return (eD.getTime() >= wStart.getTime() && eD.getTime() <= wEnd.getTime()) ? acc + exp.amount : acc;
      }, 0);
      labels.push(label);
      data.push(sum);
    }
  } else if (range === 'month') {
    // last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const sum = expenses.reduce((acc, exp) => {
        const eD = new Date(exp.date);
        return (eD.getFullYear() === d.getFullYear() && eD.getMonth() === d.getMonth()) ? acc + exp.amount : acc;
      }, 0);
      labels.push(label);
      data.push(sum);
    }
  }

  return { labels, data };
}

function renderCategoryChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const totals = {};
  expenses.forEach(exp => {
    totals[exp.category] = (totals[exp.category] || 0) + exp.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#636e72');

  if (categoryChart) categoryChart.destroy();

  if (labels.length === 0) {
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } }
      }
    }
  });
}

// ------- Toast -------
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}
