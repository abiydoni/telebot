<?php

include __DIR__ . '/get_konfigurasi.php';

$groupId     = get_konfigurasi('wa_group_id');
$gatewayBase = get_konfigurasi('api_url_group');
$filePesan   = get_konfigurasi('report_expired') ?: 'ambil_data_expired.php';

$enabled = strtolower((string) (get_konfigurasi('wa_notify_enabled') ?: 'true'));
if (! in_array($enabled, ['1', 'true', 'yes', 'on'], true)) {
    die("ℹ️  Notifikasi WA dinonaktifkan (wa_notify_enabled di tb_konfigurasi).\n");
}

try {
    $pdo->query('SELECT 1 FROM wa_notification_log LIMIT 1');
    $chk = $pdo->prepare(
        "SELECT id FROM wa_notification_log WHERE notify_type = 'daily_expired' AND notify_date = CURDATE() LIMIT 1"
    );
    $chk->execute();
    if ($chk->fetch()) {
        die("ℹ️  Sudah dikirim hari ini (wa_notification_log).\n");
    }
} catch (Throwable) {
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
    die("✅ Tidak ada barang kedaluwarsa / hampir kedaluwarsa. Pesan tidak dikirim.\n");
}

if (empty($groupId)) {
    die("ERROR: wa_group_id kosong di tb_konfigurasi!\n");
}
if (empty($gatewayBase)) {
    die("ERROR: api_url_group kosong di tb_konfigurasi!\n");
}

$gatewayBase = rtrim($gatewayBase, '/');
if (strpos($gatewayBase, '/send-group-message') === false && strpos($gatewayBase, '.php') === false) {
    $gatewayUrl = $gatewayBase . '/send-group-message';
} else {
    $gatewayUrl = $gatewayBase;
}

echo "ℹ️  Info: Menggunakan URL Gateway: $gatewayUrl\n";

$data = [
    'id'      => $groupId,
    'message' => $message,
];

$maxRetries = 2;
$attempt    = 0;
$result     = false;
$httpCode   = 0;
$curlError  = '';
$curlErrno  = 0;

do {
    $attempt++;
    $ch = curl_init($gatewayUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);

    $result    = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlErrno = curl_errno($ch);
    curl_close($ch);

    if (($curlErrno == 28 || $curlErrno == 6) && strpos($gatewayUrl, 'telebot.appsbee.my.id') !== false && $attempt < $maxRetries) {
        echo "⚠️  WARNING: Gagal connect ke $gatewayUrl (Errno: $curlErrno). Retrying via localhost...\n";
        $gatewayUrl = str_replace('https://telebot.appsbee.my.id', 'http://localhost:3000', $gatewayUrl);
        continue;
    }
    break;
} while ($attempt < $maxRetries);

echo "=== Hasil Pengiriman Logistic Expired ===\n";
echo "Group ID: $groupId\n";
echo "URL Gateway: $gatewayUrl\n";
echo "HTTP Code: $httpCode\n";

if ($httpCode == 0) {
    echo "❌ ERROR: Tidak bisa connect ke wagateway!\n";
    echo 'CURL Error: ' . ($curlError ?: 'Connection failed') . "\n";
    echo "CURL Errno: $curlErrno\n";
} elseif ($httpCode == 200) {
    $response = json_decode($result, true);
    if (isset($response['status']) && $response['status']) {
        echo "✅ SUCCESS: Pesan berhasil dikirim ke WhatsApp!\n";

        try {
            $ins = $pdo->prepare(
                'INSERT INTO wa_notification_log (notify_type, notify_date, expired_count, warning_count, sent_at)
                 VALUES (\'daily_expired\', CURDATE(), :exp, :warn, NOW())'
            );
            $ins->execute([
                ':exp'  => isset($expiredCount) ? (int) $expiredCount : 0,
                ':warn' => isset($warningCount) ? (int) $warningCount : 0,
            ]);
        } catch (Throwable $e) {
            echo '⚠️  Gagal simpan log: ' . $e->getMessage() . "\n";
        }
    } else {
        echo "⚠️  WARNING: HTTP 200 tapi status false\n";
        echo 'Response: ' . substr((string) $result, 0, 500) . "\n";
    }
} else {
    echo "❌ ERROR: HTTP $httpCode\n";
    echo 'Response: ' . substr((string) $result, 0, 500) . "\n";
}
