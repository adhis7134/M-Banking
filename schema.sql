-- ==========================================================
-- SKEMA DATABASE SQLite: M-Banking BANK-KU (mbanking.db)
-- ==========================================================

-- 1. Tabel Pengguna / Rekening (users)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    nickname TEXT NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    nik TEXT DEFAULT '1234567890098765',
    card_number TEXT DEFAULT '4532019283746510',
    card_expiry TEXT DEFAULT '12/28',
    card_type TEXT DEFAULT 'Bank-Ku Platinum',
    password TEXT NOT NULL,
    pin TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 7505000,
    income INTEGER NOT NULL DEFAULT 50000,
    expense INTEGER NOT NULL DEFAULT 292000,
    biometric_enabled INTEGER NOT NULL DEFAULT 1,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Kontak / Rekening Tersimpan & Favorit (saved_contacts)
CREATE TABLE IF NOT EXISTS saved_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipient_name TEXT NOT NULL,
    bank_name TEXT NOT NULL DEFAULT 'Bank-Ku',
    account_number TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. Tabel Riwayat Transaksi (transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tx_type TEXT NOT NULL,           -- 'TRANSFER', 'TOPUP', 'PULSA', 'VIRTUAL_ACCOUNT', 'QRIS', 'INCOME'
    title TEXT NOT NULL,             -- Contoh: 'Transfer Ke Adhi Susilo', 'Top Up Pulsa'
    recipient_name TEXT NOT NULL,
    recipient_account TEXT NOT NULL,
    amount INTEGER NOT NULL,         -- Positif untuk pemasukan, Negatif untuk pengeluaran
    admin_fee INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    month_group TEXT NOT NULL DEFAULT 'OKTOBER', -- 'OKTOBER', 'NOVEMBER', 'DESEMBER', 'JANUARI'
    date_label TEXT NOT NULL,        -- Contoh: '10 Oktober 2025'
    ref_number TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
