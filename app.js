// =========================================================================
// State Aplikasi M-Banking BANK-KU (Terhubung ke SQLite Database via API)
// =========================================================================
const appState = {
  dbConnected: false,
  userId: 1,
  allUsers: [],
  currentScreen: 'home',
  historyStack: ['welcome'],
  currentMonthTab: 'OKTOBER',
  balance: 7505000,
  income: 50000,
  expense: 292000,
  accountNumber: '123-456-7890',
  userName: 'Joni Sutanto',
  pinBuffer: '',
  pinMode: 'TRANSACTION', // 'TRANSACTION', 'CHANGE_PIN', atau 'REGISTER_PIN'
  pinTargetScreen: 'transfer-success',
  regDraft: {
    fullName: '',
    cardNumber: '',
    cardExpiry: '12/29',
    password: ''
  },
  txContext: {
    txType: 'TRANSFER',
    type: 'Transfer',
    title: 'Transfer Ke Adhi Susilo',
    recipientName: 'Adhi Susilo',
    recipientBank: 'Bank-Ku - 442034229248',
    amount: 100000,
    note: ''
  },
  selectedPulsa: { nominal: 100000, price: 102500 },
  qrAddedNominal: 0,
  contacts: [],
  recentTransactions: [],
  transactions: {
    OKTOBER: [
      { title: 'Top Up Pulsa', date_label: '10 Oktober 2025', amount: -102500 },
      { title: 'TOP UP Dana', date_label: '10 Oktober 2025', amount: -53000 },
      { title: 'Transfer Ke Adhi Susilo', date_label: '09 Oktober 2025', amount: -100000 }
    ],
    NOVEMBER: [
      { title: 'Transfer Rupiah dari Nuel', date_label: '04 November 2025', amount: 50000 },
      { title: 'Pembayaran Wifi', date_label: '02 November 2025', amount: -257000 },
      { title: 'Dimsum Mentai', date_label: '01 November 2025', amount: -35000 }
    ],
    DESEMBER: [
      { title: 'Top Up GoPay', date_label: '15 Desember 2025', amount: -103000 },
      { title: 'Pembayaran Virtual Akun', date_label: '11 Desember 2025', amount: -250000 }
    ],
    JANUARI: [
      { title: 'Top Up Shopeepay', date_label: '05 Januari 2026', amount: -203000 }
    ]
  }
};

function formatRupiah(num, withDecimals = true) {
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('id-ID');
  return withDecimals ? `Rp ${formatted},00` : `Rp ${formatted}`;
}

function showToast(message) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// =========================================================================
// Sinkronisasi State dengan SQLite Backend (/api/state)
// =========================================================================
async function fetchDatabaseState() {
  try {
    const res = await fetch(`/api/state?user_id=${appState.userId}`);
    if (!res.ok) throw new Error('API off');
    const data = await res.json();
    applyServerState(data);
    updateDbBadge(true);
  } catch (err) {
    updateDbBadge(false);
    renderBalances();
    selectHistoryMonth(appState.currentMonthTab);
  }
}

function applyServerState(data) {
  if (!data || !data.user) return;
  appState.dbConnected = true;
  appState.userId = data.user.id;
  appState.allUsers = data.all_users || [];
  appState.balance = data.user.balance;
  appState.income = data.user.income;
  appState.expense = data.user.expense;
  appState.accountNumber = data.user.account_number;
  appState.userName = data.user.nickname || data.user.full_name;
  appState.contacts = data.contacts || [];
  appState.recentTransactions = data.recent_transactions || [];
  if (data.transactions_by_month) {
    appState.transactions = data.transactions_by_month;
  }

  renderLoginAccountSelector();
  renderBalances();
  renderRecentTransactionsOnHome();
  renderSavedContactsList();
  selectHistoryMonth(appState.currentMonthTab);
}

function renderLoginAccountSelector() {
  const sel = document.getElementById('login-account-selector');
  if (!sel || !appState.allUsers || appState.allUsers.length === 0) return;
  sel.innerHTML = appState.allUsers.map(u => {
    const selected = u.id === appState.userId ? 'selected' : '';
    const label = u.id === 1
      ? `${u.full_name} (${u.account_number}) - Default`
      : `${u.full_name} (${u.account_number} / Kartu: ${u.card_number})`;
    return `<option value="${u.id}" ${selected}>${label}</option>`;
  }).join('');
}

function onSelectLoginAccount(selectedUserId) {
  const uid = parseInt(selectedUserId, 10) || 1;
  appState.userId = uid;
  fetchDatabaseState();
}

function updateDbBadge(online) {
  const badge = document.getElementById('db-status-badge');
  if (!badge) return;
  if (online) {
    badge.textContent = 'SQLite DB: Aktif (mbanking.db)';
    badge.style.background = 'linear-gradient(90deg, #0b925c, #3183d4)';
  } else {
    badge.textContent = 'Mode Offline (Jalankan server.py)';
    badge.style.background = '#64748b';
  }
}

function navigateTo(screenId, pushHistory = true) {
  const screens = document.querySelectorAll('.screen');
  const target = document.getElementById(`screen-${screenId}`);
  if (!target) return;

  if (pushHistory && appState.currentScreen && appState.currentScreen !== screenId) {
    appState.historyStack.push(appState.currentScreen);
  }
  appState.currentScreen = screenId;

  screens.forEach(s => s.classList.remove('active'));
  target.classList.add('active');

  document.querySelectorAll('.screen-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenId);
  });

  if (screenId === 'pin') {
    resetPinPad();
  }
  if (screenId === 'home' || screenId === 'history') {
    renderBalances();
  }
}

function goBack() {
  if (appState.historyStack.length > 0) {
    const prev = appState.historyStack.pop();
    navigateTo(prev, false);
  } else {
    navigateTo('home', false);
  }
}

function renderBalances() {
  const homeBal = document.getElementById('home-balance-text');
  const histBal = document.getElementById('history-balance-text');
  const homeInc = document.getElementById('home-income-text');
  const homeExp = document.getElementById('home-expense-text');
  const greetName = document.getElementById('home-user-name');
  const homeAcc = document.getElementById('home-account-number');
  const qrName = document.getElementById('qr-user-name');
  const qrAcc = document.getElementById('qr-account-number');
  const histAcc = document.getElementById('history-account-number');

  if (homeBal) homeBal.textContent = formatRupiah(appState.balance, true);
  if (histBal) histBal.textContent = formatRupiah(appState.balance, true);
  if (homeInc) homeInc.textContent = formatRupiah(appState.income, true);
  if (homeExp) homeExp.textContent = formatRupiah(appState.expense, true);
  if (greetName) greetName.textContent = appState.userName;
  if (homeAcc) homeAcc.textContent = appState.accountNumber;
  if (qrName) qrName.textContent = appState.userName.toUpperCase();
  if (qrAcc) qrAcc.textContent = `Bank-Ku : ${appState.accountNumber}`;
  if (histAcc) histAcc.textContent = appState.accountNumber;
}

function renderRecentTransactionsOnHome() {
  const container = document.getElementById('home-recent-tx-container');
  if (!container || !appState.recentTransactions || appState.recentTransactions.length === 0) return;

  const topOffsets = [651, 681, 713];
  const textOffsets = [657, 691, 717];
  const lineOffsets = [679, 711];

  let html = '';
  appState.recentTransactions.slice(0, 3).forEach((tx, idx) => {
    const isPos = tx.amount > 0;
    const arrowImg = isPos ? 'assets/53d13.svg' : 'assets/fa829.svg';
    const flip = isPos ? 'transform:scaleY(-1);' : '';
    const color = isPos ? '#00e600' : 'red';
    const sign = isPos ? '+' : '-';
    const amtFormatted = `${sign}${formatRupiah(Math.abs(tx.amount), true)}`;

    html += `
      <div style="position:absolute; left:31px; top:${topOffsets[idx]}px; width:27px; height:27px; ${flip}">
        <img src="${arrowImg}" alt="" style="display:block; width:27px; height:27px;" />
      </div>
      <p style="position:absolute; left:66px; top:${textOffsets[idx]}px; font-size:14px; color:#000; max-width:175px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${tx.title}
      </p>
      <p style="position:absolute; right:16px; top:${textOffsets[idx]}px; font-size:14px; font-weight:700; color:${color}; text-align:right;">
        ${amtFormatted}
      </p>
    `;
    if (idx < 2) {
      html += `
        <div style="position:absolute; left:36px; top:${lineOffsets[idx]}px; width:316px; height:1px;">
          <img src="assets/c167a.svg" alt="" style="display:block; width:316px; height:1px;" />
        </div>
      `;
    }
  });
  container.innerHTML = html;
}

function renderSavedContactsList() {
  const container = document.getElementById('saved-contacts-container');
  if (!container || !appState.contacts || appState.contacts.length === 0) return;

  // Tampilkan kontak untuk bagian Rekening Tersimpan
  const list = appState.contacts.filter(c => !c.is_favorite || c.recipient_name.toLowerCase().startsWith('a'));
  const displayList = list.length > 0 ? list.slice(0, 3) : appState.contacts.slice(0, 3);
  const tops = [603, 656, 711];

  container.innerHTML = displayList.map((c, idx) => {
    const bankLabel = `${c.bank_name} - ${c.account_number}`;
    const safeName = c.recipient_name.replace(/'/g, "\\'");
    const safeBank = bankLabel.replace(/'/g, "\\'");
    return `
      <div class="clickable saved-contact-row" data-name="${c.recipient_name}" onclick="selectRecipient('${safeName}', '${safeBank}')" style="position:absolute; left:31px; top:${tops[idx]}px; width:330px; height:41px; z-index:3;">
        <img src="assets/8ad20.svg" alt="" style="width:42px; height:41px; display:block;" />
        <img src="assets/07e2a.svg" alt="" style="position:absolute; left:4px; top:4px; width:33px; height:33px;" />
        <span style="position:absolute; left:56px; top:9px; font-size:15px; font-weight:600; color:#000;">${c.recipient_name}</span>
      </div>
    `;
  }).join('');
}

function copyText(text, label = 'Nomor Rekening') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  showToast(`${label} ${text} berhasil disalin!`);
}

// =========================================================================
// Registrasi / Aktivasi Akun Baru via Kartu Debit & Login dengan Database
// =========================================================================
function proceedFromDebitCard() {
  const holderInput = document.getElementById('reg-card-holder');
  const cardInput = document.getElementById('reg-card-number');
  const monthSel = document.getElementById('reg-card-month');
  const yearSel = document.getElementById('reg-card-year');

  const fullName = (holderInput ? holderInput.value.trim() : '') || 'Nasabah Baru';
  const cardNumber = (cardInput ? cardInput.value.trim() : '');
  const month = (monthSel ? monthSel.value : '12');
  const year = (yearSel ? yearSel.value : '29');

  if (cardNumber.replace(/\D/g, '').length < 6) {
    showToast('Masukkan minimal 6 digit Nomor Kartu Debit Anda!');
    if (cardInput) cardInput.focus();
    return;
  }

  appState.regDraft.fullName = fullName;
  appState.regDraft.cardNumber = cardNumber;
  appState.regDraft.cardExpiry = `${month}/${year}`;

  showToast('Kartu Debit terverifikasi! Silakan buat Password Login.');
  navigateTo('create-password');
}

function proceedFromCreatePassword() {
  const pwdInput = document.getElementById('reg-new-password');
  const pwd = pwdInput ? pwdInput.value.trim() : '';
  if (pwd.length < 4) {
    showToast('Masukkan Password baru minimal 4 karakter!');
    if (pwdInput) pwdInput.focus();
    return;
  }
  appState.regDraft.password = pwd;
  appState.pinMode = 'REGISTER_PIN';
  const pinHeader = document.getElementById('pin-header-title');
  if (pinHeader) pinHeader.textContent = 'BUAT PIN BARU';
  showToast('Langkah terakhir: Masukkan 6 digit PIN Transaksi baru Anda.');
  navigateTo('pin');
}

async function handleLogin(biometric = false) {
  const pwdInput = document.getElementById('login-password-input');
  const sel = document.getElementById('login-account-selector');
  const selectedUserId = sel ? parseInt(sel.value, 10) : appState.userId;
  const password = pwdInput ? pwdInput.value : '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: selectedUserId || appState.userId,
        password,
        biometric
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || 'Password salah!');
      return;
    }
    applyServerState(data.state);
    showToast(data.message);
    navigateTo('home');
  } catch (e) {
    showToast(`Selamat datang kembali, ${appState.userName}!`);
    navigateTo('home');
  }
}

// =========================================================================
// Alur Transfer & Tambah Penerima Baru ke Database
// =========================================================================
function selectRecipient(name, bankAccount) {
  appState.txContext = {
    txType: 'TRANSFER',
    type: 'Transfer',
    title: `Transfer Ke ${name}`,
    recipientName: name,
    recipientBank: bankAccount,
    amount: 100000,
    note: ''
  };
  updateTransferDetailUI();
  navigateTo('transfer-detail');
}

function openNewRecipientModal() {
  document.getElementById('modal-new-recipient').classList.add('open');
}

function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

async function confirmNewRecipient() {
  const bank = document.getElementById('new-rec-bank').value.trim() || 'Bank-Ku';
  const acc = document.getElementById('new-rec-acc').value.trim() || '442034229248';
  const name = document.getElementById('new-rec-name').value.trim() || 'Adhi Susilo';

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: appState.userId,
        bank_name: bank,
        account_number: acc,
        recipient_name: name
      })
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data.state);
      showToast(data.message);
    }
  } catch (err) {
    // Fallback offline
  }

  closeModals();
  selectRecipient(name, `${bank} - ${acc}`);
}

function updateTransferDetailUI() {
  const recNameEl = document.getElementById('tf-detail-name');
  const recBankEl = document.getElementById('tf-detail-bank');
  const amountInput = document.getElementById('tf-detail-amount');
  if (recNameEl) recNameEl.textContent = appState.txContext.recipientName;
  if (recBankEl) recBankEl.textContent = appState.txContext.recipientBank;
  if (amountInput) {
    amountInput.value = `Rp${appState.txContext.amount.toLocaleString('id-ID')}`;
  }
}

function formatAmountInput(inputEl) {
  const digits = inputEl.value.replace(/\D/g, '');
  const num = parseInt(digits || '0', 10);
  appState.txContext.amount = num;
  inputEl.value = num > 0 ? `Rp${num.toLocaleString('id-ID')}` : '';
}

function proceedToTransferPin() {
  if (!appState.txContext.amount || appState.txContext.amount < 1000) {
    showToast('Masukkan nominal minimal Rp 1.000');
    return;
  }
  appState.pinMode = 'TRANSACTION';
  document.getElementById('pin-header-title').textContent = 'TRANSFER';
  appState.pinTargetScreen = 'transfer-success';
  navigateTo('pin');
}

// =========================================================================
// Virtual Account, E-Wallet, dan Pulsa
// =========================================================================
function confirmVirtualAccount() {
  const vaInput = document.getElementById('va-number-input');
  const vaNum = vaInput ? vaInput.value.trim() : '';
  if (!vaNum) {
    showToast('Masukkan nomor Virtual Akun terlebih dahulu');
    if (vaInput) vaInput.focus();
    return;
  }
  appState.txContext = {
    txType: 'VIRTUAL_ACCOUNT',
    type: 'Virtual Akun',
    title: 'Pembayaran Virtual Akun',
    recipientName: 'Pembayaran Virtual Akun',
    recipientBank: `VA BANK-KU - ${vaNum}`,
    amount: 257000,
    note: 'Tagihan VA'
  };
  appState.pinMode = 'TRANSACTION';
  document.getElementById('pin-header-title').textContent = 'VIRTUAL AKUN';
  appState.pinTargetScreen = 'transfer-success';
  navigateTo('pin');
}

function selectEwalletProvider(providerName) {
  appState.txContext = {
    txType: 'TOPUP',
    type: `Top Up ${providerName}`,
    title: `TOP UP ${providerName}`,
    recipientName: `${providerName} - 08898584858`,
    recipientBank: providerName.toUpperCase(),
    amount: 53000,
    note: `Top Up ${providerName}`
  };
  document.getElementById('tf-detail-name').textContent = `Top Up ${providerName}`;
  document.getElementById('tf-detail-bank').textContent = `${providerName} - 08898584858`;
  document.getElementById('tf-detail-amount').value = 'Rp53.000';
  appState.txContext.amount = 53000;
  navigateTo('transfer-detail');
}

function selectPulsaNominal(cardEl, nominal, price) {
  document.querySelectorAll('.pulsa-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  appState.selectedPulsa = { nominal, price };
}

function confirmPulsaPurchase() {
  const phone = document.getElementById('pulsa-phone-input').value.trim() || '08898584858';
  appState.txContext = {
    txType: 'PULSA',
    type: 'Top Up Pulsa',
    title: 'Top Up Pulsa',
    recipientName: `Pulsa Rp ${appState.selectedPulsa.nominal.toLocaleString('id-ID')}`,
    recipientBank: `Nomor HP: ${phone}`,
    amount: appState.selectedPulsa.price,
    note: 'Pembelian Pulsa'
  };
  appState.pinMode = 'TRANSACTION';
  document.getElementById('pin-header-title').textContent = 'PULSA';
  appState.pinTargetScreen = 'transfer-success';
  navigateTo('pin');
}

// =========================================================================
// PIN Pad & Penyimpanan Transaksi ke SQLite Database
// =========================================================================
function resetPinPad() {
  appState.pinBuffer = '';
  updatePinDots();
}

function pressPinDigit(digit) {
  if (appState.pinBuffer.length < 6) {
    appState.pinBuffer += String(digit);
    updatePinDots();
    if (appState.pinBuffer.length === 6) {
      setTimeout(() => submitPin(), 200);
    }
  }
}

function clearPinDigit() {
  if (appState.pinBuffer.length > 0) {
    appState.pinBuffer = appState.pinBuffer.slice(0, -1);
    updatePinDots();
  }
}

function updatePinDots() {
  const dots = document.querySelectorAll('#screen-pin .pin-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('filled', idx < appState.pinBuffer.length);
  });
}

async function submitPin() {
  if (appState.pinBuffer.length < 6) {
    showToast('Masukkan 6 digit PIN BANK-KU Anda (Default: 123456)');
    return;
  }

  // Jika sedang dalam mode Registrasi Akun Baru via Kartu Debit
  if (appState.pinMode === 'REGISTER_PIN') {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: appState.regDraft.fullName,
          card_number: appState.regDraft.cardNumber,
          card_expiry: appState.regDraft.cardExpiry,
          password: appState.regDraft.password,
          pin: appState.pinBuffer
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Gagal mendaftarkan kartu debit');
        resetPinPad();
        return;
      }
      applyServerState(data.state);
      // Otomatis isi password yang baru dibuat pada layar Login agar user tinggal klik Masuk
      const pwdInput = document.getElementById('login-password-input');
      if (pwdInput) pwdInput.value = appState.regDraft.password;
      appState.pinMode = 'TRANSACTION';
      showToast(data.message);
      navigateTo('login', false);
      return;
    } catch (e) {
      showToast('Akun kartu debit berhasil diaktifkan! Silakan Masuk.');
      navigateTo('login', false);
      return;
    }
  }

  // Jika sedang dalam mode Ubah PIN dari menu Pengaturan
  if (appState.pinMode === 'CHANGE_PIN') {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: appState.userId,
          pin: appState.pinBuffer
        })
      });
      const data = await res.json();
      if (res.ok) {
        applyServerState(data.state);
        showToast(`PIN Transaksi berhasil diubah menjadi ${appState.pinBuffer}!`);
        navigateTo('settings', false);
        return;
      }
    } catch (e) {}
    showToast('PIN berhasil diperbarui!');
    navigateTo('settings', false);
    return;
  }

  const amt = appState.txContext.amount || 100000;

  try {
    const res = await fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: appState.userId,
        pin: appState.pinBuffer,
        tx_type: appState.txContext.txType || 'TRANSFER',
        title: appState.txContext.title || appState.txContext.recipientName,
        recipient_name: appState.txContext.recipientName,
        recipient_account: appState.txContext.recipientBank,
        amount: amt,
        note: appState.txContext.note || ''
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || 'Gagal memproses transaksi');
      resetPinPad();
      return;
    }

    applyServerState(data.state);
    updateReceiptScreen(amt, data.receipt?.timestamp);
    navigateTo('transfer-success', false);
    showToast(data.message);
  } catch (err) {
    // Fallback jika server.py belum dijalankan
    if (appState.balance >= amt) {
      appState.balance -= amt;
      appState.expense += amt;
    }
    appState.transactions.OKTOBER.unshift({
      title: appState.txContext.recipientName,
      date_label: 'Baru saja',
      amount: -amt
    });
    renderBalances();
    updateReceiptScreen(amt);
    navigateTo('transfer-success', false);
    showToast('Transaksi berhasil diproses!');
  }
}

function updateReceiptScreen(amt, timestampStr) {
  document.getElementById('receipt-header-title').textContent =
    appState.txContext.type.toUpperCase();
  document.getElementById('receipt-title').textContent =
    appState.txContext.type === 'Transfer' ? 'Transfer Berhasil' : 'Pembayaran Berhasil';
  document.getElementById('receipt-rec-name').textContent = appState.txContext.recipientName;
  document.getElementById('receipt-rec-bank').textContent = appState.txContext.recipientBank;
  document.getElementById('receipt-amount').textContent =
    `Rp ${amt.toLocaleString('id-ID')}`;
  if (timestampStr) {
    const tsEl = document.getElementById('receipt-timestamp');
    if (tsEl) tsEl.textContent = timestampStr;
  }
}

// =========================================================================
// Filter Riwayat Transaksi Bulanan
// =========================================================================
function selectHistoryMonth(month) {
  appState.currentMonthTab = month;
  const pill = document.getElementById('history-month-pill');
  const positions = {
    OKTOBER: '10px',
    NOVEMBER: '108px',
    DESEMBER: '208px',
    JANUARI: '302px'
  };
  if (pill && positions[month]) {
    pill.style.left = positions[month];
  }

  const listContainer = document.getElementById('history-tx-list');
  const items = appState.transactions[month] || [];
  if (!listContainer) return;

  listContainer.innerHTML = items.slice(0, 4).map((item, i) => {
    const topPx = 547 + i * 67;
    const isPositive = item.amount > 0;
    const amountStr = (isPositive ? '+' : '-') + formatRupiah(Math.abs(item.amount), true);
    const color = isPositive ? '#00cc22' : 'red';
    const arrowAsset = isPositive ? 'assets/53d13.svg' : 'assets/fa829.svg';
    const flipStyle = isPositive ? 'transform: scaleY(-1);' : '';
    const dateText = item.date_label || item.date || '';
    return `
      <div class="history-row" style="position:absolute; left:10px; top:${topPx}px; width:373px; height:48px;">
        <div style="position:absolute; left:0; top:6px; width:27px; height:27px; ${flipStyle}">
          <img src="${arrowAsset}" alt="" style="width:27px; height:27px; display:block;" />
        </div>
        <p style="position:absolute; left:32px; top:0; font-size:14px; font-weight:400; color:#000;">${item.title}</p>
        <p style="position:absolute; left:32px; top:20px; font-size:11px; font-weight:500; color:rgba(5,4,4,0.42);">${dateText}</p>
        <p style="position:absolute; right:8px; top:0; font-size:14px; font-weight:700; color:${color};">${amountStr}</p>
      </div>
    `;
  }).join('');
}

function filterContacts(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.saved-contact-row').forEach(row => {
    const name = (row.dataset.name || '').toLowerCase();
    row.style.display = name.includes(q) ? 'block' : 'none';
  });
}

// =========================================================================
// Pengaturan Profil & Inspector Database SQLite
// =========================================================================
async function changeNicknamePrompt() {
  const n = prompt('Masukkan Nama Panggilan baru:', appState.userName);
  if (!n || !n.trim()) return;
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: appState.userId,
        nickname: n.trim()
      })
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data.state);
      showToast('Nama panggilan disimpan ke database SQLite!');
      return;
    }
  } catch (e) {}
  appState.userName = n.trim();
  renderBalances();
  showToast('Nama panggilan diperbarui!');
}

function startChangePinFlow() {
  appState.pinMode = 'CHANGE_PIN';
  document.getElementById('pin-header-title').textContent = 'UBAH PIN BARU';
  navigateTo('pin');
}

async function openDatabaseInspector() {
  const modal = document.getElementById('modal-db-inspector');
  const content = document.getElementById('db-inspector-content');
  if (!modal || !content) return;
  modal.classList.add('open');
  content.innerHTML = '<p style="font-size:13px; color:#64748b;">Memuat isi tabel dari mbanking.db...</p>';

  try {
    const res = await fetch('/api/tables');
    const data = await res.json();
    const usersHtml = (data.users || []).map(u => `
      <div style="padding:6px 0; border-bottom:1px dashed #cbd5e1;">
        ID: <b>${u.id}</b> | Nama: <b>${u.full_name}</b> | Rek: <code>${u.account_number}</code> | Kartu: <code>${u.card_number}</code><br/>
        Saldo: <b>${formatRupiah(u.balance)}</b> | Password: <code>${u.password}</code> | PIN: <code>${u.pin}</code>
      </div>
    `).join('');
    content.innerHTML = `
      <div style="font-size:12px; line-height:1.45; max-height:460px; overflow-y:auto; padding-right:4px;">
        <div style="background:#f1f5f9; padding:10px 12px; border-radius:10px; margin-bottom:10px;">
          <strong style="color:#0b925c;">Tabel 1: users (${(data.users || []).length} akun terdaftar)</strong>
          ${usersHtml}
        </div>
        <div style="background:#f1f5f9; padding:10px 12px; border-radius:10px; margin-bottom:10px;">
          <strong style="color:#3183d4;">Tabel 2: saved_contacts (${data.saved_contacts.length} rekening)</strong>
          <ul style="margin-top:4px; padding-left:16px;">
            ${data.saved_contacts.slice(0, 5).map(c => `<li>${c.recipient_name} — ${c.bank_name} (${c.account_number})</li>`).join('')}
          </ul>
        </div>
        <div style="background:#f1f5f9; padding:10px 12px; border-radius:10px;">
          <strong style="color:#0f172a;">Tabel 3: transactions (${data.transactions.length} transaksi terbaru)</strong>
          <ul style="margin-top:4px; padding-left:16px;">
            ${data.transactions.slice(0, 6).map(t => `<li>[${t.month_group}] <b>${t.title}</b>: ${formatRupiah(t.amount)} (${t.date_label})</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<p style="color:red; font-size:13px;">Gagal memuat database. Pastikan server.py sedang berjalan.</p>';
  }
}

async function resetDatabaseToDefault() {
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      applyServerState(data.state);
      closeModals();
      showToast(data.message);
    }
  } catch (e) {
    showToast('Gagal mereset database');
  }
}

// QR Terima Nominal Modal
function openQrNominalModal() {
  document.getElementById('modal-qr-nominal').classList.add('open');
}

function saveQrNominal() {
  const val = document.getElementById('qr-nominal-input').value.replace(/\D/g, '');
  const num = parseInt(val || '0', 10);
  const btnText = document.getElementById('qr-terima-nominal-btn-text');
  if (btnText) {
    btnText.textContent = num > 0 ? `Rp ${num.toLocaleString('id-ID')}` : 'Tambah Nominal';
  }
  closeModals();
  if (num > 0) showToast(`Nominal QR diset ke Rp ${num.toLocaleString('id-ID')}`);
}

document.addEventListener('DOMContentLoaded', () => {
  fetchDatabaseState();
});
