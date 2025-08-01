<?php
// File: public_html/w/work/apps_script_proxy.php
// Deskripsi: Proxy PHP untuk meneruskan permintaan dari data_handler.php ke Google Apps Script Web App.
// File ini tidak diakses langsung oleh frontend.

const APPS_SCRIPT_REAL_URL = 'https://script.google.com/macros/s/AKfycby8gR_Ki7IlYP0o403qniePsAPysMnb-0VNgRzRo5DXg3QKTQK778EsoZMTL9Z38RJ61A/exec';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit();
}

$input = file_get_contents('php://input');

$ch = curl_init(APPS_SCRIPT_REAL_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

$apps_script_response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($apps_script_response === false) {
    echo json_encode(['status' => 'error', 'message' => 'Failed to fetch from Apps Script. cURL Error: ' . $curl_error]);
    http_response_code(500);
} else {
    $decoded_response = json_decode($apps_script_response, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo json_encode($decoded_response);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Apps Script returned non-JSON response.', 'raw_response' => $apps_script_response]);
        http_response_code(500);
    }
}
exit();
?>
