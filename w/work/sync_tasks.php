<?php
// File: public_html/w/work/sync_tasks.php
// Deskripsi: Endpoint untuk menerima data tugas dari Google Apps Script dan menyimpannya ke task_queue.json.
// Ini berfungsi sebagai mekanisme sinkronisasi manual dari spreadsheet.

// Path ke file lokal yang akan menyimpan data antrean tugas
const QUEUE_FILE_PATH = __DIR__ . '/task_queue.json';

// Beri tahu browser bahwa respons adalah JSON
header('Content-Type: application/json');
// Tangani CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Tangani permintaan OPTIONS (preflight request untuk CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Periksa apakah metode permintaan adalah POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Metode tidak diizinkan.']);
    exit();
}

// Ambil input JSON dari body permintaan
$input = file_get_contents('php://input');
$requestData = json_decode($input, true);

// Periksa apakah JSON valid dan memiliki key 'data'
if (json_last_error() !== JSON_ERROR_NONE || !isset($requestData['data'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON input. Missing "data" key.']);
    exit();
}

$tasksData = $requestData['data'];

// Simpan data ke file JSON lokal.
// Gunakan JSON_PRETTY_PRINT untuk format yang mudah dibaca.
// Gunakan JSON_UNESCAPED_SLASHES untuk mencegah escape pada URL.
if (file_put_contents(QUEUE_FILE_PATH, json_encode($tasksData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) !== false) {
    error_log("Successfully synced tasks from Apps Script.");
    echo json_encode(['status' => 'success', 'message' => 'Sinkronisasi data berhasil.']);
} else {
    error_log("Error: Failed to write tasks to local file " . QUEUE_FILE_PATH);
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Gagal menulis ke file JSON lokal.']);
}

exit();
?>
