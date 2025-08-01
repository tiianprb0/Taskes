<?php
// File: public_html/w/work/task_queue.php
// Deskripsi: API untuk frontend. Menerima data dari frontend dan menyimpannya ke antrean lokal (task_queue.json).
// Permintaan GET akan mengambil data dari antrean lokal.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$queueFilePath = __DIR__ . '/task_queue.json';

// Fungsi untuk membaca data antrean dari JSON
function readTasks() {
    global $queueFilePath;
    if (!file_exists($queueFilePath) || filesize($queueFilePath) === 0) {
        return [];
    }
    $tasksJson = file_get_contents($queueFilePath);
    if ($tasksJson === false) {
        return [];
    }
    $data = json_decode($tasksJson, true);
    return is_array($data) ? $data : [];
}

// Fungsi untuk menulis data antrean ke JSON
function writeTasks($tasksData) {
    global $queueFilePath;
    return file_put_contents($queueFilePath, json_encode($tasksData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

$response = ['status' => 'error', 'message' => 'Invalid Request'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Mengambil data dari JSON lokal secara instan
    $tasks = readTasks();
    $response = ['status' => 'success', 'data' => $tasks];
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        $response = ['status' => 'error', 'message' => 'Invalid JSON input.'];
        http_response_code(400);
    } else {
        $action = $requestData['action'] ?? '';
        $task = $requestData['task'] ?? [];
        
        $tasks = readTasks();
        $isSuccess = false;

        if ($action === 'add') {
            if (!empty($task)) {
                // Tambahkan Task ID jika ini tugas baru
                $task['Task ID'] = uniqid(); 
                $tasks[] = $task;
                $isSuccess = true;
            }
        } elseif ($action === 'update' || $action === 'archive') {
            foreach ($tasks as &$t) {
                if (isset($t['Task ID']) && $t['Task ID'] === $task['Task ID']) {
                    // Perbarui data tugas
                    foreach ($task as $key => $value) {
                        $t[$key] = $value;
                    }
                    $isSuccess = true;
                    break;
                }
            }
        } elseif ($action === 'delete') {
            // Logika delete jika diperlukan
        }

        if ($isSuccess && writeTasks($tasks)) {
            $response = ['status' => 'success', 'message' => 'Data berhasil disimpan lokal dan menunggu sinkronisasi.', 'taskId' => $task['Task ID'] ?? null];
        } else {
            $response = ['status' => 'error', 'message' => 'Gagal menulis ke file JSON lokal atau tugas tidak ditemukan.'];
            http_response_code(500);
        }
    }
}

echo json_encode($response);
exit();
?>
