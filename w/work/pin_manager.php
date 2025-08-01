<?php
// File: public_html/w/work/pin_manager.php
// Deskripsi: API minimal untuk membaca dan menulis data pengguna (terutama PIN) ke users.json.
// Ini adalah jembatan antara JavaScript frontend dan file users.json di server.

header('Content-Type: application/json'); // Memberi tahu browser bahwa respons adalah JSON
header('Access-Control-Allow-Origin: *'); // Mengizinkan akses dari domain manapun (untuk pengembangan)
// Untuk produksi, ganti '*' dengan domain spesifik Anda, misal: 'https://namadomainku.com'
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Tangani permintaan OPTIONS (preflight request untuk CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$usersFilePath = __DIR__ . '/users.json'; // Path absolut ke users.json

// Fungsi untuk membaca data pengguna dari users.json
function readUsers($filePath) {
    if (!file_exists($filePath) || filesize($filePath) === 0) {
        // Jika file tidak ada atau kosong, inisialisasi dengan struktur dasar
        return initializeUsersFile($filePath);
    }

    $usersJson = file_get_contents($filePath);
    if ($usersJson === false) {
        error_log("Error: Could not read users.json from " . $filePath);
        return initializeUsersFile($filePath); // Inisialisasi jika gagal baca
    }

    $data = json_decode($usersJson, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("Error decoding users.json: " . json_last_error_msg() . " Content: " . $usersJson);
        return initializeUsersFile($filePath); // Inisialisasi jika JSON tidak valid
    }
    
    // Pastikan data adalah array, jika tidak, inisialisasi
    if (!is_array($data)) {
        error_log("Error: users.json content is not an array. Content: " . $usersJson);
        return initializeUsersFile($filePath);
    }

    return $data;
}

// Fungsi untuk menginisialisasi atau memperbaiki file users.json
function initializeUsersFile($filePath) {
    $initialUsers = [
        ["name" => "Antony", "pin" => null, "firstLoginDone" => false],
        ["name" => "Tian", "pin" => null, "firstLoginDone" => false],
        ["name" => "Steven", "pin" => null, "firstLoginDone" => false],
        ["name" => "Mutia", "pin" => null, "firstLoginDone" => false]
    ];
    
    // Pastikan direktori bisa ditulis
    if (!is_writable(dirname($filePath)) && !file_exists(dirname($filePath))) {
        // Coba buat direktori jika tidak ada dan tidak bisa ditulis
        if (!mkdir(dirname($filePath), 0755, true)) {
            error_log("Error: Could not create directory for users.json: " . dirname($filePath));
            return [];
        }
    } elseif (!is_writable($filePath) && file_exists($filePath)) {
        // Jika file ada tapi tidak bisa ditulis, coba ubah izin
        if (!chmod($filePath, 0644)) { // Atau 0666 jika 0644 tidak cukup
            error_log("Error: Could not change permissions for users.json: " . $filePath);
            // Lanjutkan dengan array kosong, karena tidak bisa menulis
            return [];
        }
    }

    if (file_put_contents($filePath, json_encode($initialUsers, JSON_PRETTY_PRINT)) === false) {
        error_log("Error: Could not write initial users.json to " . $filePath);
        return [];
    }
    return $initialUsers;
}


// Fungsi untuk menulis data pengguna ke users.json
function writeUsers($filePath, $usersData) {
    // Pastikan data yang akan ditulis adalah array
    if (!is_array($usersData)) {
        error_log("Error: Data to write is not an array.");
        return false;
    }
    if (!is_writable($filePath) && file_exists($filePath)) {
        error_log("Error: users.json is not writable: " . $filePath);
        return false;
    }
    if (!is_writable(dirname($filePath))) {
        error_log("Error: Directory of users.json is not writable: " . dirname($filePath));
        return false;
    }
    return file_put_contents($filePath, json_encode($usersData, JSON_PRETTY_PRINT));
}

// Tangani permintaan GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = readUsers($usersFilePath);
    echo json_encode(['status' => 'success', 'data' => $users]);
    exit(); // Penting: Hentikan eksekusi setelah mengirim respons
}

// Tangani permintaan POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON input.']);
        http_response_code(400); // Bad Request
        exit();
    }

    $action = $requestData['action'] ?? '';

    if ($action === 'updatePin') {
        $username = $requestData['username'] ?? '';
        $newPin = $requestData['pin'] ?? null; // Bisa null jika ingin menghapus PIN
        $firstLoginDone = $requestData['firstLoginDone'] ?? null; // Bisa null jika tidak ingin update

        if (empty($username)) {
            echo json_encode(['status' => 'error', 'message' => 'Username diperlukan.']);
            http_response_code(400);
            exit();
        }

        $users = readUsers($usersFilePath);
        $found = false;
        foreach ($users as &$user) { // Gunakan referensi untuk memodifikasi array asli
            if ($user['name'] === $username) {
                $user['pin'] = $newPin;
                if ($firstLoginDone !== null) {
                    $user['firstLoginDone'] = (bool)$firstLoginDone;
                }
                $found = true;
                break;
            }
        }

        if ($found && writeUsers($usersFilePath, $users)) {
            echo json_encode(['status' => 'success', 'message' => 'Data pengguna berhasil diperbarui.']);
            exit();
        } else if (!$found) {
            echo json_encode(['status' => 'error', 'message' => 'Pengguna tidak ditemukan.']);
            http_response_code(404);
            exit();
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Gagal menulis ke file users.json. Pastikan izin tulis di server.']);
            http_response_code(500);
            exit();
        }
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Aksi tidak dikenal.']);
        http_response_code(400);
        exit();
    }
}

// Fallback untuk permintaan yang tidak ditangani
echo json_encode(['status' => 'error', 'message' => 'Metode permintaan tidak didukung atau tidak ada aksi yang valid.']);
http_response_code(405); // Method Not Allowed
exit();

?>
