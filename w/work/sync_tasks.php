<?php
// File: public_html/w/work/sync_tasks.php
// Deskripsi: Script ini mengambil data dari Google Apps Script dan menyimpannya ke task_queue.json.
// Disarankan untuk dijalankan secara berkala sebagai cron job.

// Ganti dengan URL Google Apps Script Web App Anda
const APPS_SCRIPT_REAL_URL = 'https://script.google.com/macros/s/AKfycby8gR_Ki7IlYP0o403qniePsAPysMnb-0VNgRzRo5DXg3QKTQK778EsoZMTL9Z38RJ61A/exec';
const QUEUE_FILE_PATH = __DIR__ . '/task_queue.json';

// Fungsi untuk membaca data dari Apps Script via GET request
function getTasksFromAppsScript() {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, APPS_SCRIPT_REAL_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30); // Beri waktu 30 detik untuk Apps Script merespons

    $apps_script_response = curl_exec($ch);
    $curl_error = curl_error($ch);
    curl_close($ch);

    if ($apps_script_response === false) {
        error_log("Error syncing tasks from Apps Script: " . $curl_error);
        return null;
    } else {
        $decoded_response = json_decode($apps_script_response, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($decoded_response['status']) && $decoded_response['status'] === 'success') {
            return $decoded_response['data'];
        } else {
            error_log("Apps Script returned an error or invalid JSON during sync. Response: " . $apps_script_response);
            return null;
        }
    }
}

// Logika sinkronisasi
// Ini akan dijalankan saat script diakses (contoh: oleh cron job)
$tasks = getTasksFromAppsScript();

if ($tasks !== null) {
    // Simpan data sukses ke file JSON lokal
    file_put_contents(QUEUE_FILE_PATH, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    error_log("Successfully synced tasks from Apps Script.");
}

// Tambahan: Ini adalah respons HTTP jika file ini diakses langsung dari browser
// Kita tidak mengharapkan ini, tapi ini untuk memastikan tidak ada output aneh.
header('Content-Type: application/json');
echo json_encode(['status' => 'success', 'message' => 'Sync script executed. Check your logs.']);

?>
