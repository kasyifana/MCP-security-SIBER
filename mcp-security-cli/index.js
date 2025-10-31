#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

const program = new Command();

// Alamat server MCP yang berjalan di Docker
const MCP_SERVER_URL = 'http://localhost:3000';

/**
 * Fungsi untuk menunda eksekusi.
 * @param {number} ms Waktu tunda dalam milidetik.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fungsi utama untuk menjalankan audit.
 * @param {string} projectPath Path ke direktori proyek.
 */
async function runAudit(projectPath) {
    const absolutePath = path.resolve(projectPath);
    console.log(`Memulai audit keamanan untuk proyek di: ${absolutePath}`);

    // --- Langkah 1: Baca package.json dan siapkan payload ---
    const packageJsonPath = path.join(absolutePath, 'package.json');
    try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageData = JSON.parse(packageContent);

        const payload = {
            package_json: packageData,
            dependencies: packageData.dependencies || {},
        };
        console.log('Payload berhasil dibuat dari package.json.');

        // --- Langkah 2: Kirim job audit ke server MCP ---
        console.log(`Mengirim job ke server MCP di ${MCP_SERVER_URL}/api/submit...`);
        const submitResponse = await axios.post(`${MCP_SERVER_URL}/api/submit`, payload);
        const jobId = submitResponse.data.job_id;

        if (!jobId) {
            console.error('Error: Gagal mendapatkan job_id dari server.');
            process.exit(1);
        }
        console.log(`Job berhasil dikirim. Job ID: ${jobId}`);

        // --- Langkah 3: Tunggu hasil (Polling) ---
        console.log('Menunggu hasil audit...');
        let report = null;
        const maxAttempts = 60; // Total timeout: 60 * 5s = 5 menit
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await sleep(5000); // Jeda 5 detik
            try {
                console.log(`Mencoba mengambil laporan untuk Job ID ${jobId} (Percobaan ${attempt}/${maxAttempts})`);
                const jobResponse = await axios.get(`${MCP_SERVER_URL}/api/job/${jobId}`);
                if (jobResponse.status === 200 && jobResponse.data.report) {
                    console.log('Laporan audit berhasil diterima!');
                    report = jobResponse.data;
                    break;
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    // Laporan belum siap, ini normal.
                } else {
                    console.error('\nError saat mengambil status job:', error.message);
                    break; // Hentikan jika ada error selain 404
                }
            }
        }

        // --- Langkah 4: Tampilkan hasil ---
        if (report) {
            console.log('\n--- HASIL AUDIT FINAL ---');
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.error('Gagal mendapatkan laporan setelah beberapa kali percobaan.');
            process.exit(1);
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: File 'package.json' tidak ditemukan di ${absolutePath}`);
        } else if (error.isAxiosError) {
            console.error(`Error koneksi ke server MCP: ${error.message}`);
            console.error('Pastikan server MCP Docker sedang berjalan dan dapat diakses di ' + MCP_SERVER_URL);
        } else {
            console.error('Terjadi kesalahan tak terduga:', error.message);
        }
        process.exit(1);
    }
}

program
    .name('mcp-security-audit')
    .description('CLI untuk menjalankan audit keamanan pada proyek Node.js melalui server MCP.')
    .version('1.0.0');

program
    .command('run')
    .description('Menjalankan audit pada direktori proyek tertentu.')
    .argument('<project_path>', 'Path ke direktori proyek yang akan diaudit.')
    .action(runAudit);

program.parse(process.argv);