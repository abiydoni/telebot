<?php
// Atur batas waktu eksekusi agar tidak terkena timeout di cron/server
@ini_set('max_execution_time', '300');
@set_time_limit(300);

// Ambil konfigurasi (hardcoded karena tabel konfigurasi tidak ada di DB baru)
$filePesan = 'ambil_data_jimpitan.php';

// Helper kirim ke chat group & ambil konfigurasi database
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/send_to_chat.php';
require_once __DIR__ . '/get_konfigurasi.php';

// Ambil konfigurasi WhatsApp Group dari tabel system_settings di database appsbeem_jimpitan_admin
$waConfig      = get_wa_group_settings();
$targetNumber  = $waConfig['targetNumber'];
$appsbeeUrl    = $waConfig['appsbeeUrl'];
$appsbeeApiKey = $waConfig['appsbeeApiKey'];
$sessionId     = $waConfig['sessionId'];
$villageId     = $waConfig['villageId'];
$isWaEnabled   = $waConfig['isEnabled'];

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
    $message = 'Report Jimpitan - ' . date('Y-m-d H:i:s');
}

/**
 * =========================================================================
 * 1. KIRIM KE CHAT GROUP WARGA ($villageId) - INPUT KE TABEL chat_messages
 * =========================================================================
 * Dijalankan terlebih dahulu agar riwayat chat dan database pasti tersimpan
 * tanpa terhambat jika koneksi WhatsApp lambat/timeout.
 */
echo "\n--- Mengirim ke Chat Grup Warga (Database & Notifikasi) ---\n";
if (!empty($message)) {
    sendToGroupChat($pdo, $message, $sessionId, $villageId);
}

/**
 * =========================================================================
 * 2. KIRIM VIA WHATSAPP (APPSBEE WA)
 * =========================================================================
 */
echo "\n--- Mengirim via Appsbee WA ---\n";
if (!$isWaEnabled) {
    echo "ℹ️  Pengiriman pesan WhatsApp dilewati (Dinonaktifkan di Pengaturan Sistem).\n";
} else {
    $appsbeeData = [
        'sessionId' => $sessionId,
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
    curl_setopt($chAppsbee, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($chAppsbee, CURLOPT_SSL_VERIFYPEER, false);

    $appsbeeResult = curl_exec($chAppsbee);
    $appsbeeHttpCode = curl_getinfo($chAppsbee, CURLINFO_HTTP_CODE);
    curl_close($chAppsbee);

    if ($appsbeeHttpCode == 200) {
        echo "✅ Appsbee WA: Berhasil dikirim ke $targetNumber!\n";
    } else {
        echo "❌ Appsbee WA: Gagal (HTTP $appsbeeHttpCode)\n";
        echo "Response: $appsbeeResult\n";
    }
}
?>

