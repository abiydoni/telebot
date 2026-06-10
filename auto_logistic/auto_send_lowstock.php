<?php

include __DIR__ . '/get_konfigurasi.php';

$groupId   = get_konfigurasi('wa_group_id');
$filePesan = get_konfigurasi('report_lowstock') ?: 'ambil_data_lowstock.php';

$enabled = strtolower((string) (get_konfigurasi('wa_notify_enabled') ?: 'true'));
if (! in_array($enabled, ['1', 'true', 'yes', 'on'], true)) {
    die("ℹ️  Notifikasi WA dinonaktifkan (wa_notify_enabled di tb_konfigurasi).\n");
}

try {
    if (empty($_GET['force'])) {
        $pdo->query("SELECT 1 FROM wa_notification_log LIMIT 1");
        $chk = $pdo->prepare("SELECT id FROM wa_notification_log WHERE notify_type = 'daily_lowstock' AND notify_date = CURDATE() LIMIT 1");
        $chk->execute();
        if ($chk->fetch()) {
            die("ℹ️  Sudah dikirim hari ini (wa_notification_log). Gunakan ?force=1 untuk memaksa kirim.\n");
        }
    }
} catch (Throwable $e) {}

$message = '';
if (! empty($filePesan)) {
    if (! file_exists($filePesan)) {
        $filePesan = __DIR__ . '/' . $filePesan;
    }
    if (file_exists($filePesan)) {
        include $filePesan;
        $message = isset($message) ? trim((string) $message) : '';
    }
}

error_reporting(E_ALL);
ini_set('display_errors', 1);

if (! isset($pdo)) {
    echo "⚠️  WARNING: Variable \$pdo tidak ditemukan!\n";
} else {
    echo "ℹ️  Info: DB logistic (\$pdo) OK.\n";
}

if (empty($message)) {
    die("✅ Tidak ada barang stok menipis / habis. Pesan tidak dikirim.\n");
}

if (empty($groupId)) {
    die("ERROR: wa_group_id kosong di tb_konfigurasi!\n");
}

echo "=== Hasil Pengiriman Logistic Low Stock ===\n";

/**
 * =========================================================================
 * KIRIM VIA WHATSAPP (INTEGRASI APPSBEE GATEWAY)
 * =========================================================================
 */
echo "\n--- Mengirim via Appsbee WA ---\n";
$targetNumber = $groupId; // Menggunakan ID Group WA dari konfigurasi DB
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

echo "Group ID / JID: $targetNumber\n";
echo "URL Gateway: $appsbeeUrl\n";
echo "HTTP Code: $appsbeeHttpCode\n";

if ($appsbeeHttpCode == 200) {
    echo "✅ Appsbee WA: Berhasil dikirim ke WhatsApp!\n";
    
    // Logging keberhasilan ke database agar tidak double send hari ini
    try {
        $ins = $pdo->prepare(
            'INSERT INTO wa_notification_log (notify_type, notify_date, expired_count, warning_count, sent_at)
             VALUES (\'daily_lowstock\', CURDATE(), :habis, :menipis, NOW())'
        );
        $ins->execute([
            ':habis'   => isset($habisCount) ? (int) $habisCount : 0,
            ':menipis' => isset($menipisCount) ? (int) $menipisCount : 0,
        ]);
        echo "ℹ️  Log pengiriman berhasil disimpan ke database.\n";
    } catch (Throwable $e) {
        echo '⚠️  Gagal simpan log ke database: ' . $e->getMessage() . "\n";
    }
} else {
    echo "❌ Appsbee WA: Gagal (HTTP $appsbeeHttpCode)\n";
    echo "Response: $appsbeeResult\n";
}
