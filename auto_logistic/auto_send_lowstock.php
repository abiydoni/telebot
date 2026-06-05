<?php

include __DIR__ . '/get_konfigurasi.php';

$groupId   = get_konfigurasi('wa_group_id');
$filePesan = get_konfigurasi('report_lowstock') ?: 'ambil_data_lowstock.php';

$enabled = strtolower((string) (get_konfigurasi('wa_notify_enabled') ?: 'true'));
if (! in_array($enabled, ['1', 'true', 'yes', 'on'], true)) {
    die("ℹ️  Notifikasi WA dinonaktifkan (wa_notify_enabled di tb_konfigurasi).\n");
}

try {
    $pdo->query('SELECT 1 FROM wa_notification_log LIMIT 1');
    $chk = $pdo->prepare(
        "SELECT id FROM wa_notification_log WHERE notify_type = 'daily_lowstock' AND notify_date = CURDATE() LIMIT 1"
    );
    $chk->execute();
    if ($chk->fetch()) {
        die("ℹ️  Sudah dikirim hari ini (wa_notification_log).\n");
    }
} catch (Throwable $e) {
}

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
 * KIRIM VIA WHATSAPP (INTEGRASI WA-AKG NEW GATEWAY)
 * Sesuai referensi dari auto_send_jaga.php
 * =========================================================================
 */
echo "\n--- Mengirim via WA-AKG ---\n";
$waAkgSession = 'Randuares-RT07'; 
$waAkgJid     = $groupId; // Menggunakan ID Group WA dari konfigurasi DB
$waAkgApiKey  = 'wag_OAbXNpfK7bI7xAtX217HWc8zdOKeJAiP';
$waAkgUrl     = "https://wa-akg.aikeigroup.net/api/messages/$waAkgSession/" . urlencode($waAkgJid) . "/send";

$waAkgData = [
    'message' => [
        'text' => $message
    ]
];

$chAkg = curl_init($waAkgUrl);
curl_setopt($chAkg, CURLOPT_POST, true);
curl_setopt($chAkg, CURLOPT_POSTFIELDS, json_encode($waAkgData));
curl_setopt($chAkg, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chAkg, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-API-Key: ' . $waAkgApiKey
]);
curl_setopt($chAkg, CURLOPT_TIMEOUT, 30);
curl_setopt($chAkg, CURLOPT_SSL_VERIFYPEER, false);

$akgResult = curl_exec($chAkg);
$akgHttpCode = curl_getinfo($chAkg, CURLINFO_HTTP_CODE);
curl_close($chAkg);

echo "Group ID / JID: $waAkgJid\n";
echo "URL Gateway: $waAkgUrl\n";
echo "HTTP Code: $akgHttpCode\n";

if ($akgHttpCode == 200) {
    echo "✅ WA-AKG: Berhasil dikirim ke WhatsApp!\n";
    
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
    echo "❌ WA-AKG: Gagal (HTTP $akgHttpCode)\n";
    echo "Response: $akgResult\n";
}
