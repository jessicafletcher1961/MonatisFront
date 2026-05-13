const input = document.querySelector('#pdf-input');
const dropzone = document.querySelector('#dropzone');
const analyzeBtn = document.querySelector('#analyze-btn');
const fileName = document.querySelector('#file-name');
const statusBox = document.querySelector('#status');
const summary = document.querySelector('#summary');
const transactionsCard = document.querySelector('#transactions-card');
const rawCard = document.querySelector('#raw-card');
const transactionsBody = document.querySelector('#transactions-body');
const downloadJsonBtn = document.querySelector('#download-json');

let selectedFile = null;
let lastResult = null;

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.remove('hidden');
  statusBox.classList.toggle('error', isError);
}

function hideStatus() {
  statusBox.classList.add('hidden');
}

function setFile(file) {
  selectedFile = file;
  analyzeBtn.disabled = !file;
  fileName.textContent = file ? `Fichier choisi : ${file.name}` : '';
}

input.addEventListener('change', (event) => {
  setFile(event.target.files[0] || null);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (file) setFile(file);
});

analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append('file', selectedFile);

  analyzeBtn.disabled = true;
  showStatus('Analyse du PDF en cours...');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || 'Erreur inconnue');
    }

    lastResult = payload;
    renderResult(payload);
    hideStatus();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    analyzeBtn.disabled = false;
  }
});

function renderResult(result) {
  summary.classList.remove('hidden');
  rawCard.classList.remove('hidden');

  document.querySelector('#bank').textContent = result.bank || 'non reconnue';
  document.querySelector('#doc-type').textContent = result.document_type || 'unknown';
  document.querySelector('#year').textContent = result.statement_year || '-';
  document.querySelector('#count').textContent = result.stats?.transaction_count ?? 0;

  renderBalanceControl(result.stats?.balance_control);

  const warningsBox = document.querySelector('#warnings');
  warningsBox.innerHTML = '';
  if (result.warnings && result.warnings.length > 0) {
    warningsBox.classList.remove('hidden');
    const ul = document.createElement('ul');
    result.warnings.forEach((warning) => {
      const li = document.createElement('li');
      li.textContent = warning;
      ul.appendChild(li);
    });
    warningsBox.appendChild(ul);
  } else {
    warningsBox.classList.add('hidden');
  }

  renderTransactions(result.transactions || []);
  document.querySelector('#raw-json').textContent = JSON.stringify(result, null, 2);
}


function renderBalanceControl(control) {
  const card = document.querySelector('#balance-control');
  if (!control) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  document.querySelector('#opening-balance').textContent = control.opening_balance == null ? '-' : formatEuro(control.opening_balance);
  document.querySelector('#closing-balance').textContent = control.closing_balance == null ? '-' : formatEuro(control.closing_balance);
  document.querySelector('#transactions-total').textContent = control.transactions_total == null ? '-' : formatEuro(control.transactions_total);
  document.querySelector('#expected-delta').textContent = control.expected_delta == null ? '-' : formatEuro(control.expected_delta);
  document.querySelector('#balance-difference').textContent = control.difference == null ? '-' : formatEuro(control.difference);

  const status = document.querySelector('#balance-status');
  status.textContent = control.passed ? 'OK' : control.status || 'indisponible';
  status.classList.toggle('positive', Boolean(control.passed));
  status.classList.toggle('negative', control.status === 'failed');
}

function renderTransactions(transactions) {
  transactionsBody.innerHTML = '';

  if (transactions.length === 0) {
    transactionsCard.classList.add('hidden');
    return;
  }

  transactionsCard.classList.remove('hidden');

  transactions.forEach((tx) => {
    const row = document.createElement('tr');
    const amount = Number(tx.amount || 0);
    const amountClass = amount < 0 ? 'negative' : 'positive';
    const warnings = tx.warnings && tx.warnings.length ? `\n⚠ ${tx.warnings.join(' | ')}` : '';

    row.innerHTML = `
      <td>${escapeHtml(tx.operation_date || '-')}</td>
      <td>${escapeHtml(tx.value_date || '-')}</td>
      <td>${escapeHtml(tx.label_raw || '-')}${escapeHtml(warnings)}</td>
      <td><span class="amount ${amountClass}">${formatEuro(amount)}</span></td>
      <td>${escapeHtml(String(tx.page || '-'))}</td>
      <td><span class="confidence">${Math.round((tx.confidence || 0) * 100)}%</span></td>
    `;
    transactionsBody.appendChild(row);
  });
}

function formatEuro(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

downloadJsonBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resultat-import-caisse-epargne.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
