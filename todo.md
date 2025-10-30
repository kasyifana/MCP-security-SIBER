# Todo: MCP Server for Security Audit

> Tujuan: Membangun MCP server yang mampu melakukan audit keamanan dependency npm dan menghasilkan laporan kerentanan (severity) otomatis, seperti data dari `Severity-response.json` dan `no-Severity-response.json`.

---

## 🎯 Tujuan Utama

* Membuat server MCP yang:

  * Menerima request audit dari client.
  * Menjalankan proses audit keamanan terhadap dependencies (mis. npm).
  * Mengembalikan hasil audit dalam format JSON berisi severity, advisories, dan rekomendasi versi.
  * Menyimpan hasil audit (safe dan vulnerable) untuk pelaporan historis.

---

## 📦 Input Data (contoh)

1. **no-Severity-response.json** → Tidak ditemukan kerentanan.

   ```json
   {"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0},"totalDependencies":1}
   ```
2. **Severity-response.json** → Ditemukan 7 advisories pada `lodash` (moderate:3, high:3, critical:1).

   ```json
   {"vulnerabilities":{"moderate":3,"high":3,"critical":1},"totalDependencies":1}
   ```

---

## 🧱 Arsitektur Sistem

1. **Client (MCP-compatible)**: Mengirimkan payload audit.
2. **MCP Server (Core)**: Validasi request, enqueue job audit.
3. **Audit Worker**: Jalankan audit tool (`npm audit`, `yarn audit`, dsb.) dan hasilkan file seperti di atas.
4. **Storage Layer (PostgreSQL + S3/MinIO)**: Menyimpan hasil audit dan laporan.
5. **Dashboard/Admin API**: Menampilkan statistik audit dan laporan severity.

---

## 🪜 Langkah Pembuatan (Step-by-step)

### 1. Setup Dasar Proyek

* [x] Inisialisasi repo `mcp-security-server`.
* [x] Tambahkan `README.md`, `docker-compose.yml`, dan `.env.example`.
* [x] Buat service utama: `server`, `worker`, `db`, `redis`.

### 2. Struktur Direktori

```
/mcp-security-server
├── server/           # MCP core API
├── worker/           # Audit executor
├── database/         # Migration & seed
├── storage/          # Output reports
├── test/             # Integration & e2e tests
└── docker-compose.yml
```

### 3. Implementasi MCP Server (server/)

* [x] Endpoint `/mcp/handshake` untuk inisialisasi session.
* [x] Endpoint `/mcp/submit` untuk menerima payload audit.
* [x] Validasi input JSON sesuai schema (`package.json`, dependencies list, dll.).
* [x] Simpan job ke Redis queue (`audit:queue`).

### 4. Implementasi Worker (worker/)

* [x] Ambil job dari Redis.
* [x] Jalankan audit via `npm audit --json` atau API.
* [x] Simpan hasil ke `storage/reports/{job_id}.json`.
* [x] Update status job di PostgreSQL (`queued → running → completed`).
* [x] Jika hasil seperti `no-Severity-response.json`, beri flag `safe = true`.
* [x] Jika hasil seperti `Severity-response.json`, parsing severity & advisories.

### 5. Database Schema (PostgreSQL)

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  client_id TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now(),
  finished_at TIMESTAMP,
  severity_summary JSONB,
  advisories JSONB,
  safe BOOLEAN
);
```

[x]

### 6. Output Format (Response)

```json
{
  "job_id": "1234",
  "safe": false,
  "summary": {
    "moderate": 3,
    "high": 3,
    "critical": 1
  },
  "advisories": [
    {"id": 1094499, "module": "lodash", "severity": "high", "cve": "CVE-2018-16487"},
    {"id": 1097140, "module": "lodash", "severity": "critical", "cve": "CVE-2019-10744"}
  ]
}
```

### 7. Admin Dashboard / API

* [x] Endpoint `/api/jobs` → daftar semua audit.
* [x] Endpoint `/api/job/:id` → detail hasil audit (dari JSON tersimpan).
* [x] Endpoint `/api/stats` → statistik severity total.

### 8. Security & Observability

* [x] Gunakan TLS untuk semua koneksi.
* [x] Implementasi API key untuk client MCP.
* [x] Logging structured (JSON log + timestamp).
* [x] Endpoint `/healthz` dan `/metrics`.

### 9. CI/CD

* [x] GitHub Actions untuk lint + test + build + docker push.
* [x] Deploy staging ke container VPS / Kubernetes.

### 10. Testing

* [x] Unit test untuk parser JSON audit.
* [x] Integration test: kirim payload → hasil audit tersimpan.
* [x] Simulasi kasus `no-Severity` dan `Severity` seperti dua file contoh.

---

## ✅ MVP (Minimal Viable Product)

* [x] Server menerima payload audit dan validasi schema.
* [x] Worker berhasil menghasilkan file hasil audit (mirip `Severity-response.json`).
* [x] Database menyimpan severity summary & advisories.
* [x] API `/api/job/:id` menampilkan hasil dengan benar.

---

## 🧩 Next Steps (Optional Enhancements)

* [ ] Integrasi ke **npm registry live API**.
* [ ] Support multi-language audit (Python, Go).
* [ ] Tambah sistem notifikasi webhook/email saat job selesai.
* [ ] Analitik tren kerentanan per modul dan waktu.

---

## 📋 Kesimpulan

File `Severity-response.json` berfungsi sebagai **contoh output dari proses audit** (berisi CVE, severity, rekomendasi upgrade). File `no-Severity-response.json` adalah contoh output jika **tidak ada kerentanan**.

Todo.md ini memandu langkah implementasi MCP server yang akan membaca kedua jenis hasil itu, memprosesnya, dan menyimpannya ke dalam sistem laporan yang aman dan terukur.