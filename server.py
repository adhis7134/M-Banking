#!/usr/bin/env python3
"""
Backend Server + SQLite Database untuk Aplikasi M-Banking BANK-KU
Menyajikan file statis (index.html, styles.css, app.js, assets/) sekaligus REST API (/api/*)
"""
import json
import os
import random
import sqlite3
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "mbanking.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(force_reset=False):
    if force_reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = get_db_connection()
    cur = conn.cursor()

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        cur.executescript(f.read())

    # Cek apakah sudah ada data user default
    cur.execute("SELECT COUNT(*) as cnt FROM users")
    if cur.fetchone()["cnt"] == 0:
        # Insert Default User sesuai desain Figma: Joni Sutanto
        cur.execute("""
            INSERT INTO users (
                full_name, nickname, account_number, phone, nik,
                card_number, card_expiry, card_type,
                password, pin, balance, income, expense,
                biometric_enabled, notifications_enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "Joni Sutanto", "Joni Sutanto", "123-456-7890", "+62 8898584858", "1234567890098765",
            "4532019283746510", "12/28", "Bank-Ku Platinum",
            "bankku123", "123456", 7505000, 50000, 292000,
            1, 1
        ))
        user_id = cur.lastrowid

        # Insert Kontak Favorit & Tersimpan sesuai desain Figma
        contacts = [
            (user_id, "Daudy Ganteng", "Bank-Ku", "8810293841", 1),
            (user_id, "Daffa Suami Zee", "Bank-Ku", "9920112233", 1),
            (user_id, "Taufiq", "Bank-Ku", "7740192837", 1),
            (user_id, "Adhi Susilo", "Bank-Ku", "442034229248", 1),
            (user_id, "David", "Bank-Ku", "5519283746", 1),
            (user_id, "Tegar Herlangga", "Bank-Ku", "6629384756", 1),
            (user_id, "Jonathan", "Bank-Ku", "3319283746", 1),
            (user_id, "Agus Salim", "Bank-Ku", "2283746519", 1),
            (user_id, "Adrian Maulana", "Bank-Ku", "1102938475", 0),
        ]
        cur.executemany("""
            INSERT INTO saved_contacts (user_id, recipient_name, bank_name, account_number, is_favorite)
            VALUES (?, ?, ?, ?, ?)
        """, contacts)

        # Insert Riwayat Transaksi Awal sesuai desain Figma
        seed_tx = [
            # Oktober
            (user_id, "PULSA", "Top Up Pulsa", "Pulsa Telkomsel", "08898584858", -102500, 2500, "Pulsa 100rb", "OKTOBER", "10 Oktober 2025", "245377645988210001"),
            (user_id, "TOPUP", "TOP UP Dana", "Dana - Joni", "08898584858", -53000, 3000, "Top Up Dana", "OKTOBER", "10 Oktober 2025", "245377645988210002"),
            (user_id, "TRANSFER", "Transfer Ke Adhi Susilo", "Adhi Susilo", "Bank-Ku - 442034229248", -100000, 0, "Bayar makan", "OKTOBER", "09 Oktober 2025", "245377645988213557"),
            # November (juga tampil di Beranda Transaksi Terakhir)
            (user_id, "INCOME", "Transfer Rupiah dari Nuel", "Nuel", "Bank-Ku - 9988776655", 50000, 0, "Transfer masuk", "NOVEMBER", "04 November 2025", "245377645988210003"),
            (user_id, "VIRTUAL_ACCOUNT", "Pembayaran Wifi", "IndiHome VA", "8801234567890", -257000, 2000, "Tagihan Wifi", "NOVEMBER", "02 November 2025", "245377645988210004"),
            (user_id, "QRIS", "Dimsum Mentai", "Dimsum Mentai PIM", "QRIS Merchant", -35000, 0, "QR Bayar", "NOVEMBER", "01 November 2025", "245377645988210005"),
            # Desember
            (user_id, "TOPUP", "Top Up GoPay", "GoPay - Joni", "08898584858", -103000, 3000, "Top Up GoPay", "DESEMBER", "15 Desember 2025", "245377645988210006"),
            (user_id, "VIRTUAL_ACCOUNT", "Pembayaran Virtual Akun", "VA Bank-Ku", "8801234567890", -250000, 0, "Pembayaran VA", "DESEMBER", "11 Desember 2025", "245377645988210007"),
            # Januari
            (user_id, "TOPUP", "Top Up Shopeepay", "Shopeepay - Joni", "08898584858", -203000, 3000, "Top Up Shopeepay", "JANUARI", "05 Januari 2026", "245377645988210008"),
        ]
        cur.executemany("""
            INSERT INTO transactions (
                user_id, tx_type, title, recipient_name, recipient_account,
                amount, admin_fee, note, month_group, date_label, ref_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_tx)

        conn.commit()
    conn.close()


def build_state_payload(user_id=1):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user_row = cur.fetchone()
    if not user_row:
        cur.execute("SELECT * FROM users LIMIT 1")
        user_row = cur.fetchone()
    user = dict(user_row)
    uid = user["id"]

    cur.execute("SELECT * FROM saved_contacts WHERE user_id = ? ORDER BY is_favorite DESC, recipient_name ASC", (uid,))
    contacts = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC", (uid,))
    all_tx = [dict(r) for r in cur.fetchall()]

    grouped_tx = {
        "OKTOBER": [],
        "NOVEMBER": [],
        "DESEMBER": [],
        "JANUARI": []
    }
    for tx in all_tx:
        grp = tx["month_group"]
        if grp not in grouped_tx:
            grouped_tx[grp] = []
        grouped_tx[grp].append(tx)

    # 3 transaksi terakhir untuk halaman Beranda
    recent_tx = all_tx[:3]

    cur.execute("SELECT id, full_name, nickname, account_number, card_number FROM users ORDER BY id DESC")
    all_users = [dict(r) for r in cur.fetchall()]

    conn.close()
    return {
        "status": "ok",
        "database_file": "mbanking.db",
        "user": user,
        "all_users": all_users,
        "contacts": contacts,
        "transactions_by_month": grouped_tx,
        "recent_transactions": recent_tx,
        "total_transactions_count": len(all_tx)
    }


class MBankingRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body)

    def do_OPTIONS(self):
        self._send_json({"status": "ok"})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            qs = parse_qs(parsed.query)
            uid = int(qs.get("user_id", [1])[0])
            self._send_json(build_state_payload(uid))
            return
        if parsed.path == "/api/tables":
            # Endpoint untuk menginspeksi seluruh isi tabel SQLite langsung dari UI
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT id, full_name, nickname, account_number, phone, balance, income, expense, pin FROM users")
            users = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM saved_contacts ORDER BY id DESC")
            contacts = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM transactions ORDER BY id DESC LIMIT 25")
            txs = [dict(r) for r in cur.fetchall()]
            conn.close()
            self._send_json({
                "status": "ok",
                "users": users,
                "saved_contacts": contacts,
                "transactions": txs
            })
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            payload = self._read_json_body()
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, 400)
            return

        # 1. Login Password / Fingerprint (mendukung multi-akun)
        if parsed.path == "/api/login":
            password = payload.get("password", "")
            account_or_card = payload.get("account_or_card", "").strip()
            user_id_req = payload.get("user_id")
            biometric = payload.get("biometric", False)

            conn = get_db_connection()
            cur = conn.cursor()

            user = None
            if user_id_req:
                cur.execute("SELECT * FROM users WHERE id = ?", (int(user_id_req),))
                row = cur.fetchone()
                if row:
                    user = dict(row)
            elif account_or_card:
                cur.execute("""
                    SELECT * FROM users
                    WHERE account_number = ? OR card_number = ? OR LOWER(nickname) = LOWER(?)
                    LIMIT 1
                """, (account_or_card, account_or_card, account_or_card))
                row = cur.fetchone()
                if row:
                    user = dict(row)
            else:
                # Cari berdasarkan password yang cocok (prioritaskan akun terbaru)
                cur.execute("SELECT * FROM users WHERE password = ? ORDER BY id DESC LIMIT 1", (password,))
                row = cur.fetchone()
                if row:
                    user = dict(row)
                elif biometric:
                    cur.execute("SELECT * FROM users ORDER BY id DESC LIMIT 1")
                    row = cur.fetchone()
                    if row:
                        user = dict(row)

            conn.close()
            if user and (biometric or password == user["password"]):
                self._send_json({
                    "status": "ok",
                    "message": f"Selamat datang, {user['nickname']}! (Rek: {user['account_number']})",
                    "state": build_state_payload(user["id"])
                })
            else:
                self._send_json({"status": "error", "message": "Password atau Nomor Kartu/Rekening tidak cocok!"}, 401)
            return

        # 1B. Registrasi / Aktivasi Akun Baru (via Kartu Debit atau Buka Tabungan)
        if parsed.path == "/api/register":
            full_name = payload.get("full_name", "").strip() or "Nasabah Baru"
            card_number = payload.get("card_number", "").strip() or str(random.randint(4000000000000000, 4999999999999999))
            card_expiry = payload.get("card_expiry", "12/29").strip()
            card_type = payload.get("card_type", "Bank-Ku Silver").strip()
            phone = payload.get("phone", "+62 8123456789").strip()
            nik = payload.get("nik", "3275012345670001").strip()
            password = payload.get("password", "").strip()
            pin = str(payload.get("pin", "")).strip()
            initial_balance = int(payload.get("initial_balance", 500000))

            if len(password) < 4:
                self._send_json({"status": "error", "message": "Password minimal 4 karakter!"}, 400)
                return
            if len(pin) != 6 or not pin.isdigit():
                self._send_json({"status": "error", "message": "PIN harus 6 digit angka!"}, 400)
                return

            acc_num = f"{random.randint(100,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}"
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO users (
                    full_name, nickname, account_number, phone, nik,
                    card_number, card_expiry, card_type,
                    password, pin, balance, income, expense,
                    biometric_enabled, notifications_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
            """, (
                full_name, full_name, acc_num, phone, nik,
                card_number, card_expiry, card_type,
                password, pin, initial_balance, initial_balance, 0
            ))
            new_uid = cur.lastrowid

            # Tambahkan kontak default & transaksi saldo awal
            cur.execute("""
                INSERT INTO saved_contacts (user_id, recipient_name, bank_name, account_number, is_favorite)
                VALUES (?, 'Joni Sutanto', 'Bank-Ku', '123-456-7890', 1),
                       (?, 'Adhi Susilo', 'Bank-Ku', '442034229248', 1)
            """, (new_uid, new_uid))

            ref_no = "245377" + str(random.randint(100000000000, 999999999999))
            cur.execute("""
                INSERT INTO transactions (
                    user_id, tx_type, title, recipient_name, recipient_account,
                    amount, admin_fee, note, month_group, date_label, ref_number
                ) VALUES (?, 'INCOME', 'Setoran Awal / Aktivasi Kartu', ?, ?, ?, 0, 'Saldo Awal', 'OKTOBER', 'Baru saja', ?)
            """, (new_uid, full_name, acc_num, initial_balance, ref_no))

            conn.commit()
            conn.close()

            self._send_json({
                "status": "ok",
                "message": f"Akun {full_name} berhasil dibuat! No Rek: {acc_num}",
                "new_user": {
                    "id": new_uid,
                    "full_name": full_name,
                    "account_number": acc_num,
                    "card_number": card_number,
                    "password": password,
                    "pin": pin
                },
                "state": build_state_payload(new_uid)
            })
            return

        # 2. Proses Transaksi (Transfer, Pulsa, Top Up, Virtual Account, QRIS)
        if parsed.path == "/api/transaction":
            uid = int(payload.get("user_id", 1))
            pin = str(payload.get("pin", ""))
            tx_type = payload.get("tx_type", "TRANSFER")
            title = payload.get("title", "Transfer")
            recipient_name = payload.get("recipient_name", "Adhi Susilo")
            recipient_account = payload.get("recipient_account", "Bank-Ku - 442034229248")
            amount = int(payload.get("amount", 0))
            note = payload.get("note", "")

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE id = ?", (uid,))
            row = cur.fetchone()
            if not row:
                cur.execute("SELECT * FROM users LIMIT 1")
                row = cur.fetchone()
            user = dict(row)
            uid = user["id"]

            if pin != user["pin"]:
                conn.close()
                self._send_json({"status": "error", "message": f"PIN salah! Gunakan PIN akun ini: {user['pin']}"}, 403)
                return

            if amount <= 0:
                conn.close()
                self._send_json({"status": "error", "message": "Nominal transaksi tidak valid"}, 400)
                return

            if user["balance"] < amount:
                conn.close()
                self._send_json({"status": "error", "message": "Saldo Anda tidak mencukupi!"}, 400)
                return

            new_balance = user["balance"] - amount
            new_expense = user["expense"] + amount
            ref_no = "245377" + str(random.randint(100000000000, 999999999999))
            now_str = datetime.now().strftime("%d %B %Y - %H.%M.%S")

            cur.execute("""
                UPDATE users
                SET balance = ?, expense = ?
                WHERE id = ?
            """, (new_balance, new_expense, uid))

            cur.execute("""
                INSERT INTO transactions (
                    user_id, tx_type, title, recipient_name, recipient_account,
                    amount, admin_fee, note, month_group, date_label, ref_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                uid, tx_type, title, recipient_name, recipient_account,
                -amount, 0, note, "OKTOBER", "Baru saja", ref_no
            ))
            tx_id = cur.lastrowid
            conn.commit()
            conn.close()

            self._send_json({
                "status": "ok",
                "message": "Transaksi berhasil disimpan ke database SQLite!",
                "receipt": {
                    "id": tx_id,
                    "ref_number": ref_no,
                    "timestamp": now_str,
                    "recipient_name": recipient_name,
                    "recipient_account": recipient_account,
                    "amount": amount,
                    "tx_type": tx_type
                },
                "state": build_state_payload(uid)
            })
            return

        # 3. Tambah Rekening / Penerima Baru ke Database
        if parsed.path == "/api/contacts":
            uid = int(payload.get("user_id", 1))
            bank_name = payload.get("bank_name", "Bank-Ku").strip() or "Bank-Ku"
            account_number = payload.get("account_number", "").strip()
            recipient_name = payload.get("recipient_name", "").strip()
            if not account_number or not recipient_name:
                self._send_json({"status": "error", "message": "Nama dan Nomor Rekening wajib diisi"}, 400)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO saved_contacts (user_id, recipient_name, bank_name, account_number, is_favorite)
                VALUES (?, ?, ?, ?, 0)
            """, (uid, recipient_name, bank_name, account_number))
            conn.commit()
            conn.close()

            self._send_json({
                "status": "ok",
                "message": f"Penerima {recipient_name} disimpan ke database!",
                "state": build_state_payload(uid)
            })
            return

        # 4. Update Pengaturan Profil / PIN / Password / Notifikasi
        if parsed.path == "/api/profile":
            uid = int(payload.get("user_id", 1))
            conn = get_db_connection()
            cur = conn.cursor()
            if "nickname" in payload and payload["nickname"].strip():
                cur.execute("UPDATE users SET nickname = ?, full_name = ? WHERE id = ?",
                            (payload["nickname"].strip(), payload["nickname"].strip(), uid))
            if "pin" in payload and len(str(payload["pin"])) == 6:
                cur.execute("UPDATE users SET pin = ? WHERE id = ?", (str(payload["pin"]), uid))
            if "password" in payload and len(str(payload["password"])) >= 4:
                cur.execute("UPDATE users SET password = ? WHERE id = ?", (str(payload["password"]), uid))
            if "notifications_enabled" in payload:
                cur.execute("UPDATE users SET notifications_enabled = ? WHERE id = ?",
                            (1 if payload["notifications_enabled"] else 0, uid))
            conn.commit()
            conn.close()
            self._send_json({
                "status": "ok",
                "message": "Pengaturan disimpan ke database!",
                "state": build_state_payload(uid)
            })
            return

        # 5. Reset Database ke Data Awal Figma
        if parsed.path == "/api/reset":
            init_db(force_reset=True)
            self._send_json({
                "status": "ok",
                "message": "Database SQLite berhasil di-reset ke data awal Figma!",
                "state": build_state_payload(1)
            })
            return

        self._send_json({"status": "error", "message": "Endpoint tidak ditemukan"}, 404)


if __name__ == "__main__":
    init_db(force_reset=False)
    port = 8090
    print(f"============================================================")
    print(f" Server M-Banking BANK-KU + SQLite Database Aktif!")
    print(f" File Database : {DB_PATH}")
    print(f" URL Aplikasi  : http://localhost:{port}")
    print(f"============================================================")
    server = ThreadingHTTPServer(("0.0.0.0", port), MBankingRequestHandler)
    server.serve_forever()
