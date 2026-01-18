<?php
// Ambil konfigurasi dari database
include 'get_konfigurasi.php';

$token = get_konfigurasi('session_id');
$chatId = get_konfigurasi('group_id1');
$gatewayBase = get_konfigurasi('url_group');
$filePesan = get_konfigurasi('report1');

// Ambil pesan dari file
$message = '';
if (!empty($filePesan)) {
    // Coba path relatif dulu
    if (!file_exists($filePesan)) {
        // Coba path absolut
        $filePesan = __DIR__ . '/' . $filePesan;
    }
    if (file_exists($filePesan)) {
        include $filePesan;
        // Ambil variabel $pesan yang sudah di-set oleh file
        $message = isset($pesan) ? trim((string)$pesan) : '';
    }
}

// Normalisasi chat_id
$chatId = trim((string)$chatId);
$chatId = is_numeric($chatId) ? (int)$chatId : $chatId;

// Bangun URL Telegram API
$telegramApiBase = rtrim((string)$gatewayBase, '/');
$url = "{$telegramApiBase}/bot{$token}/sendMessage";
$data = [
    'chat_id' => $chatId,
    'text' => $message,
    'parse_mode' => 'Markdown'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Jika Markdown parse error, coba tanpa parse_mode
if ($httpCode === 400 && $result) {
    $error = json_decode($result, true);
    if (isset($error['description']) && 
        (stripos($error['description'], 'parse') !== false || 
         stripos($error['description'], 'markdown') !== false)) {
        // Coba kirim lagi tanpa parse_mode
        $dataNoMarkdown = [
            'chat_id' => $chatId,
            'text' => $message
        ];
        
        $ch2 = curl_init($url);
        curl_setopt($ch2, CURLOPT_POST, true);
        curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode($dataNoMarkdown));
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 30);
        
        $result = curl_exec($ch2);
        $httpCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch2);
        curl_close($ch2);
    }
}

// Log error jika gagal
if ($httpCode != 200) {
    $error = json_decode($result, true);
    $errorMsg = isset($error['description']) ? $error['description'] : ($curlError ?: 'Unknown');
    error_log("auto_send_jimpitan.php: Gagal kirim. HTTP: $httpCode, Error: $errorMsg, Chat ID: $chatId");
}
?>
