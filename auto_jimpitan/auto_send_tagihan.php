<?php
// Ambil konfigurasi (hardcoded karena tabel konfigurasi tidak ada di DB baru)
$filePesan = 'ambil_data_tagihan.php';

// Helper kirim ke chat group & koneksi DB
require_once __DIR__ . '/send_to_chat.php';

// Eksekusi dan siapkan variabel $message berisi tagihan
include __DIR__ . '/ambil_data_tagihan.php';

// Output hasil
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Debug PDO connection
if (!isset($pdo)) {
    echo "⚠️  WARNING: Variable \$pdo tidak ditemukan!\n";
} else {
    echo "ℹ️  Info: Variable \$pdo tersedia.\n";
}

if (empty($message)) {
    $message = 'Info Ultah - ' . date('Y-m-d H:i:s');
}


echo "\n--- Mengirim via Appsbee WA ---\n";
$targetNumber = '120363398680818900@g.us';
//$targetNumber = '6285729705810-1505093181@g.us';
$appsbeeUrl   = "https://wa-ab.appsbee.my.id/api/send-message";
$appsbeeApiKey = "wa-69aa3dbf930020c93f34b83add6374e8";

$appsbeeData = [
    'sessionId' => 'appsbee',
    'number'    => $targetNumber,
    'message'   => $message
];

$chAppsbee = curl_init($appsbeeUrl);
curl_setopt($chAppsbee, CURLOPT_POST, true);
curl_setopt($chAppsbee, CURLOPT_POSTFIELDS, json_encode($appsbeeData));
curl_setopt($chAppsbee, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chAppsbee, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: ' . $appsbeeApiKey
]);
curl_setopt($chAppsbee, CURLOPT_TIMEOUT, 30);
curl_setopt($chAppsbee, CURLOPT_SSL_VERIFYPEER, false);

$appsbeeResult = curl_exec($chAppsbee);
$appsbeeHttpCode = curl_getinfo($chAppsbee, CURLINFO_HTTP_CODE);
curl_close($chAppsbee);

if ($appsbeeHttpCode == 200) {
    echo "✅ Appsbee WA: Berhasil dikirim!\n";
} else {
    echo "❌ Appsbee WA: Gagal (HTTP $appsbeeHttpCode)\n";
    echo "Response: $appsbeeResult\n";
}

/**
 * =========================================================================
 * KIRIM KE CHAT GROUP WARGA (village_001)
 * =========================================================================
 */
echo "\n--- Mengirim ke Chat Grup Warga ---\n";
if (!empty($message)) {
    sendToGroupChat($pdo, $message, 'Pengurus RT');
}
?>
