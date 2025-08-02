<?php
// File: public_html/w/work/data_handler.php
// Deskripsi: Menangani aksi POST dari frontend. Memperbarui antrean lokal (task_queue.json) dan
// memicu sinkronisasi ke Apps Script secara blocking untuk memastikan data tersimpan.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$queueFilePath = __DIR__ . '/task_queue.json';
// Perbaikan: Pastikan URL untuk proxy Apps Script adalah URL lengkap.
$appsScriptProxyUrl = 'https://daytian.fun/w/work/apps_script_proxy.php';

/**
 * Fungsi untuk membaca data antrean dari JSON
 * @return array
 */
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

/**
 * Fungsi untuk menulis data antrean ke JSON
 * @param array $tasksData
 * @return bool
 */
function writeTasks($tasksData) {
    global $queueFilePath;
    return file_put_contents($queueFilePath, json_encode($tasksData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

/**
 * Fungsi untuk memicu sinkronisasi ke Google Apps Script dan menunggu respons.
 * @param array $requestData Data yang akan dikirim ke Apps Script.
 * @return array|null Respons dari Apps Script jika sukses, atau null jika gagal.
 */
function triggerAppsScriptSyncBlocking($requestData) {
    global $appsScriptProxyUrl;
    
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $appsScriptProxyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Mengambil respons
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30); // Beri waktu yang cukup untuk Apps Script

    $response = curl_exec($ch);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($response === false) {
        error_log('cURL Error during Apps Script sync: ' . $curl_error);
        return ['status' => 'error', 'message' => 'Failed to connect to Apps Script: ' . $curl_error];
    }
    
    $decodedResponse = json_decode($response, true);
    if (json_last_error() === JSON_ERROR_NONE && isset($decodedResponse['status'])) {
        return $decodedResponse;
    }
    
    error_log('Invalid JSON response from Apps Script: ' . $response);
    return ['status' => 'error', 'message' => 'Invalid JSON response from Apps Script.'];
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
        $task = $requestData['task'] ?? null;
        $taskId = $requestData['taskId'] ?? ($task['Task ID'] ?? null);

        $tasks = readTasks();
        $isSuccess = false;
        $taskToSync = $task;

        if ($action === 'add') {
            if (!empty($task)) {
                $syncResponse = triggerAppsScriptSyncBlocking(['action' => 'add', 'task' => $task]);
                
                if ($syncResponse['status'] === 'success' && isset($syncResponse['taskId'])) {
                    $task['Task ID'] = $syncResponse['taskId'];
                    $tasks[] = $task;
                    $isSuccess = true;
                    $taskToSync = $task;
                    
                    if (writeTasks($tasks)) {
                        $response = ['status' => 'success', 'message' => 'Tugas berhasil ditambahkan.'];
                    } else {
                        http_response_code(500);
                        $response = ['status' => 'error', 'message' => 'Gagal menulis ke file JSON lokal setelah sinkronisasi.'];
                    }
                } else {
                    http_response_code(500);
                    $response = ['status' => 'error', 'message' => 'Gagal membuat tugas di Apps Script. Detail: ' . ($syncResponse['message'] ?? 'Unknown error.')];
                }
            }
        } elseif ($action === 'update') {
            $isFound = false;
            foreach ($tasks as &$t) {
                if (isset($t['Task ID']) && $t['Task ID'] === $task['Task ID']) {
                    foreach ($task as $key => $value) {
                        $t[$key] = $value;
                    }
                    $isFound = true;
                    $taskToSync = $t;
                    break;
                }
            }

            if ($isFound && writeTasks($tasks)) {
                $syncResponse = triggerAppsScriptSyncBlocking(['action' => $action, 'task' => $taskToSync]);
                
                if ($syncResponse['status'] === 'success') {
                    $response = ['status' => 'success', 'message' => 'Tugas berhasil disimpan dan disinkronkan.'];
                } else {
                    http_response_code(500);
                    $response = ['status' => 'error', 'message' => 'Gagal sinkronisasi ke Apps Script. Detail: ' . ($syncResponse['message'] ?? 'Unknown error.')];
                }
            } else {
                $response = ['status' => 'error', 'message' => 'Gagal menulis ke file JSON lokal atau tugas tidak ditemukan.'];
                http_response_code(500);
            }
        } elseif ($action === 'archive') {
             // Perbaikan: Lakukan sinkronisasi terlebih dahulu untuk mengarsipkan data di Apps Script
            $syncResponse = triggerAppsScriptSyncBlocking(['action' => 'archive', 'taskId' => $taskId]);
            
            if ($syncResponse['status'] === 'success') {
                // Hapus tugas dari daftar lokal setelah sukses di Apps Script
                $tasks = array_filter($tasks, function($t) use ($taskId) {
                    return $t['Task ID'] !== $taskId;
                });
                
                if (writeTasks(array_values($tasks))) { // array_values untuk re-index array
                    $response = ['status' => 'success', 'message' => 'Tugas berhasil diarsipkan dan disinkronkan.'];
                } else {
                    http_response_code(500);
                    $response = ['status' => 'error', 'message' => 'Gagal menulis ke file JSON lokal.'];
                }
            } else {
                http_response_code(500);
                $response = ['status' => 'error', 'message' => 'Gagal sinkronisasi ke Apps Script. Detail: ' . ($syncResponse['message'] ?? 'Unknown error.')];
            }
        } elseif ($action === 'restore') {
             // Perbaikan: Lakukan sinkronisasi terlebih dahulu untuk mengembalikan data di Apps Script
             $syncResponse = triggerAppsScriptSyncBlocking(['action' => 'restore', 'taskId' => $taskId]);
             
            if ($syncResponse['status'] === 'success') {
                // Setelah berhasil di Apps Script, ambil ulang semua data dari Apps Script.
                // Ini akan memastikan data lokal benar-benar sinkron dengan sumber kebenaran.
                $getTasksResponse = triggerAppsScriptSyncBlocking(['action' => 'getAllTasks']);
                if (isset($getTasksResponse['data']) && writeTasks($getTasksResponse['data'])) {
                     $response = ['status' => 'success', 'message' => 'Tugas berhasil dikembalikan dan disinkronkan ulang.'];
                } else {
                    http_response_code(500);
                    $response = ['status' => 'error', 'message' => 'Tugas berhasil dikembalikan, tetapi gagal memperbarui data lokal.'];
                }
            } else {
                http_response_code(500);
                $response = ['status' => 'error', 'message' => 'Gagal mengembalikan tugas di Apps Script. Detail: ' . ($syncResponse['message'] ?? 'Unknown error.')];
            }
        } elseif ($action === 'getArchivedTasks') {
            // Perbaikan: Tambahkan logika untuk mengambil tugas yang diarsipkan dari Apps Script.
            $archivedTasksResponse = triggerAppsScriptSyncBlocking(['action' => 'getArchivedTasks']);
            if ($archivedTasksResponse['status'] === 'success' && isset($archivedTasksResponse['data'])) {
                echo json_encode(['status' => 'success', 'data' => $archivedTasksResponse['data']]);
                exit();
            } else {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Gagal mengambil data arsip dari Apps Script.']);
                exit();
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
