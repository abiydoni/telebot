<?php
// Ambil konfigurasi dari database
include 'get_konfigurasi.php';

$groupId = get_konfigurasi('group_id2'); //120363398680818900@g.us
$gatewayBase = get_konfigurasi('url_group'); //https://telebot.appsbee.my.id/send-group-message
$filePesan = get_konfigurasi('report3'); //ambil_data_ultah.php

// Ambil pesan dari file jika ada
$message = '';
if (!empty($filePesan)) {
    if (!file_exists($filePesan)) {
        $filePesan = __DIR__ . '/' . $filePesan;
    }
    if (file_exists($filePesan)) {
        include $filePesan;
        $message = isset($pesan) ? trim((string)$pesan) : '';
    }
}

// Jika pesan kosong, gunakan pesan default
if (empty($message)) {
    $message = 'Test pesan - ' . date('Y-m-d H:i:s');
}

// Validasi
if (empty($groupId)) {
    die("ERROR: Group ID kosong!\n");
}
if (empty($gatewayBase)) {
    die("ERROR: URL gateway kosong!\n");
}

// Bangun URL - jika sudah ada endpoint, jangan tambahkan lagi
$gatewayBase = rtrim($gatewayBase, '/');
if (strpos($gatewayBase, '/send-group-message') === false) {
    $gatewayUrl = $gatewayBase . '/send-group-message';
} else {
    $gatewayUrl = $gatewayBase;
}
$data = [
    'id' => $groupId,
    'message' => $message
];

$ch = curl_init($gatewayUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
// Jangan force IPv4, biarkan CURL pilih sendiri
// curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$curlErrno = curl_errno($ch);
curl_close($ch);

// Output hasil
echo "=== Hasil Pengiriman ===\n";
echo "Group ID: $groupId\n";
echo "URL Gateway: $gatewayUrl\n";
echo "HTTP Code: $httpCode\n";

if ($httpCode == 0) {
    echo "❌ ERROR: Tidak bisa connect ke wagateway!\n";
    echo "CURL Error: " . ($curlError ?: 'Connection failed') . "\n";
    echo "CURL Errno: $curlErrno\n";
} elseif ($httpCode == 404) {
    echo "❌ ERROR: Endpoint tidak ditemukan (404)!\n";
    echo "URL yang digunakan: $gatewayUrl\n";
    echo "\nKemungkinan masalah:\n";
    echo "1. URL di database salah atau endpoint tidak ada\n";
    echo "2. Wagateway tidak running di server tersebut\n";
    echo "3. Path endpoint berbeda (cek dokumentasi wagateway)\n";
    echo "\nCoba cek:\n";
    echo "- Base URL di database: " . get_konfigurasi('url_group') . "\n";
    echo "- Pastikan wagateway running dan bisa diakses\n";
} elseif ($httpCode == 200) {
    $response = json_decode($result, true);
    if (isset($response['status']) && $response['status']) {
        echo "✅ SUCCESS: Pesan berhasil dikirim ke WhatsApp!\n";

        // Input ke tabel chats
        try {
            $stmt = $pdo->prepare("INSERT INTO chats (sender_id, receiver_id, message, is_read, reply_to_id) VALUES ('USER000', 'GROUP_ALL', :message, '0', 'NULL')");
            $stmt->execute([':message' => $message]);
            echo "✅ Database: Data tersimpan di tabel chats\n";
        } catch (Exception $e) {
            echo "❌ Database Error (Insert Chats): " . $e->getMessage() . "\n";
        }

    } else {
        echo "⚠️  WARNING: HTTP 200 tapi status false\n";
        echo "Response: " . substr($result, 0, 500) . "\n";
    }
} else {
    $response = json_decode($result, true);
    if ($response && isset($response['message'])) {
        $errorMsg = is_array($response['message']) ? json_encode($response['message']) : $response['message'];
        echo "❌ ERROR: $errorMsg\n";
    } else {
        echo "❌ ERROR: HTTP $httpCode\n";
        echo "Response: " . substr($result, 0, 500) . "\n";
    }
}
?>
