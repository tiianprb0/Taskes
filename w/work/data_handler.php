<?php
// File: public_html/w/work/data_handler.php
// Deskripsi: Menangani aksi POST dari frontend secara instan dan memicu sinkronisasi latar belakang.

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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        $response = ['status' => 'error', 'message' => 'Invalid JSON input.'];
        http_response_code(400);
    } else {
        $action = $requestData['action'] ?? '';
        $task = $requestData['task'] ?? [];
        
        $tasks = readTasks();
        
        if ($action === 'add') {
            if (!empty($task)) {
                $task['Task ID'] = uniqid(); 
                $tasks[] = $task;
                if (writeTasks($tasks)) {
                     $response = ['status' => 'success', 'message' => 'Tugas berhasil ditambahkan.', 'taskId' => $task['Task ID']];
                } else {
                    $response = ['status' => 'error', 'message' => 'Gagal menulis ke file JSON lokal.'];
                    http_response_code(500);
                }
            }
        } elseif ($action === 'update' || $action === 'archive') {
            $isFound = false;
            foreach ($tasks as &$t) {
                if (isset($t['Task ID']) && $t['Task ID'] === $task['Task ID']) {
                    // Update data tugas
                    foreach ($task as $key => $value) {
                        $t[$key] = $value;
                    }
                    $isFound = true;
                    break;
                }
            }
            if ($isFound && writeTasks($tasks)) {
                $response = ['status' => 'success', 'message' => 'Tugas berhasil diperbarui.'];
            } else {
                $response = ['status' => 'error', 'message' => 'Tugas tidak ditemukan di file lokal atau gagal menulis.'];
                http_response_code(500);
            }
        } else {
            $response = ['status' => 'error', 'message' => 'Aksi tidak dikenal.'];
            http_response_code(400);
        }
    }
} else {
    $response = ['status' => 'error', 'message' => 'Metode tidak diizinkan.'];
    http_response_code(405);
}

echo json_encode($response);
exit();

?>
