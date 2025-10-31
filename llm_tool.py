
import json
import os
import time
import requests

# Alamat server MCP yang berjalan di Docker
MCP_SERVER_URL = "http://localhost:3000"

def run_mcp_security_audit(project_path: str) -> dict:
    """
    Menjalankan audit keamanan pada proyek yang ditentukan menggunakan server MCP.

    Fungsi ini akan:
    1. Membaca package.json dari direktori proyek.
    2. Mengirimkan job audit ke server MCP.
    3. Menunggu (polling) hingga laporan audit selesai.
    4. Mengembalikan hasil laporan dalam format JSON.

    :param project_path: Path absolut ke direktori proyek yang akan diaudit.
    :return: Sebuah dictionary yang berisi laporan audit atau pesan error.
    """
    print(f"Memulai audit keamanan untuk proyek di: {project_path}")

    # --- Langkah 1: Baca package.json dan siapkan payload ---
    package_json_path = os.path.join(project_path, 'package.json')
    if not os.path.exists(package_json_path):
        print(f"Error: File 'package.json' tidak ditemukan di {project_path}")
        return {"error": "File 'package.json' tidak ditemukan."}

    try:
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
        
        payload = {
            "package_json": package_data,
            "dependencies": package_data.get("dependencies", {})
        }
        print("Payload berhasil dibuat dari package.json.")
    except Exception as e:
        print(f"Error saat membaca atau parsing package.json: {e}")
        return {"error": f"Gagal memproses package.json: {e}"}

    # --- Langkah 2: Kirim job audit ke server MCP ---
    try:
        print(f"Mengirim job ke server MCP di {MCP_SERVER_URL}/api/submit...")
        submit_response = requests.post(f"{MCP_SERVER_URL}/api/submit", json=payload)
        submit_response.raise_for_status()  # Akan error jika status code bukan 2xx
        
        job_id = submit_response.json().get("job_id")
        if not job_id:
            return {"error": "Gagal mendapatkan job_id dari server."}
        
        print(f"Job berhasil dikirim. Job ID: {job_id}")
    except requests.exceptions.RequestException as e:
        print(f"Error saat menghubungi server MCP: {e}")
        return {"error": f"Tidak dapat terhubung ke server MCP di {MCP_SERVER_URL}. Pastikan server berjalan. Detail: {e}"}

    # --- Langkah 3: Tunggu hasil (Polling) ---
    print("Menunggu hasil audit...")
    report = None
    attempts = 0
    max_attempts = 20  # Coba maksimal 20 kali (total 60 detik)
    
    while attempts < max_attempts:
        attempts += 1
        time.sleep(3)  # Jeda 3 detik antar percobaan
        
        try:
            print(f"Mencoba mengambil laporan untuk Job ID {job_id} (Percobaan {attempts}/{max_attempts})")
            job_response = requests.get(f"{MCP_SERVER_URL}/api/job/{job_id}")
            
            if job_response.status_code == 200:
                data = job_response.json()
                if data.get("report"):
                    print("Laporan audit berhasil diterima!")
                    report = data
                    break  # Keluar dari loop jika laporan sudah ada
            # Jika status 404, berarti laporan belum siap, jadi kita lanjut coba lagi.
        except requests.exceptions.RequestException as e:
            print(f"Error saat mengambil status job: {e}")
            # Jika ada error koneksi saat polling, kita hentikan saja.
            return {"error": f"Gagal mengambil hasil audit. Detail: {e}"}

    # --- Langkah 4: Kembalikan hasil ---
    if report:
        return report
    else:
        print("Gagal mendapatkan laporan setelah beberapa kali percobaan.")
        return {"error": "Waktu tunggu habis. Laporan audit tidak kunjung selesai."}

if __name__ == '__main__':
    # Bagian ini untuk testing. Anda bisa menjalankannya langsung dari terminal.
    # Ganti dengan path ke proyek yang ingin Anda tes.
    # Contoh: 'f:\coding part 2\MCP\MCP-security-SIBER\mcp-security-server\server'
    target_project_path = 'f:\coding part 2\MCP\MCP-security-SIBER\mcp-security-server\server'
    
    # Pastikan server Docker Anda sedang berjalan sebelum menjalankan ini.
    final_report = run_mcp_security_audit(target_project_path)
    
    print("\n--- HASIL AUDIT FINAL ---")
    print(json.dumps(final_report, indent=2))