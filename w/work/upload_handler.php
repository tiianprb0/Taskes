<?php
// File: public_html/w/work/upload_handler.php
// Deskripsi: Menangani unggah file gambar dari frontend dan menyimpannya ke folder 'img'.
// Mengembalikan URL gambar yang disimpan dalam format JSON.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$uploadDir = __DIR__ . '/img/';
// Perbaikan: Gunakan URL absolut yang lengkap
$domain = 'https://daytian.fun/'; // Ganti dengan domain Anda
$uploadUrl = $domain . 'w/work/img/';

// Periksa apakah folder upload ada dan dapat ditulis
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}
if (!is_writable($uploadDir)) {
    echo json_encode(['status' => 'error', 'message' => 'Folder upload tidak dapat ditulis. Mohon periksa izinnya.']);
    exit();
}

// Periksa apakah file diunggah
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['status' => 'error', 'message' => 'Tidak ada file yang diunggah atau terjadi kesalahan.']);
    exit();
}

$file = $_FILES['image'];

// Validasi file
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!in_array($file['type'], $allowedTypes)) {
    echo json_encode(['status' => 'error', 'message' => 'Tipe file tidak didukung. Harap unggah file gambar (JPEG, PNG, GIF, WebP).']);
    exit();
}

// Batasi ukuran file (misal 5MB)
$maxFileSize = 5 * 1024 * 1024;
if ($file['size'] > $maxFileSize) {
    echo json_encode(['status' => 'error', 'message' => 'Ukuran file terlalu besar. Maksimal 5MB.']);
    exit();
}

// Buat nama file unik untuk mencegah penimpaan dan masalah keamanan
$fileName = uniqid('img_', true) . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
$destination = $uploadDir . $fileName;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    $imageUrl = $uploadUrl . $fileName;
    echo json_encode(['status' => 'success', 'message' => 'Gambar berhasil diunggah.', 'imageUrl' => $imageUrl]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan file di server.']);
}

?>
