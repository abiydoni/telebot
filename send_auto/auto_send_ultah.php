<?php
// Ambil konfigurasi dari database
include __DIR__ . '/get_konfigurasi.php';

$groupId = get_konfigurasi('group_id3');
$gatewayBase = get_konfigurasi('api_url_group');
$filePesan = get_konfigurasi('report3');

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
    $message = 'Info Ultah - ' . date('Y-m-d H:i:s');
}

// Validasi
if (empty($groupId)) {
    die("ERROR: Group ID kosong!\n");
}
if (empty($gatewayBase)) {
    die("ERROR: URL gateway kosong!\n");
}

// Validasi URL
// Bangun URL dengan logic sederhana sesuai original
$gatewayBase = rtrim($gatewayBase, '/');

// Jika belum ada endpoint, tambahkan /send-group-message (default original)
// Kecuali user sudah set full path di DB
if (strpos($gatewayBase, '/send-group-message') === false && strpos($gatewayBase, '.php') === false) {
    if (strpos($gatewayBase, 'api.telegram.org') !== false) {
         // Khusus warning jika config mengarah ke telegram tapi endpoint salah
         echo "⚠️  WARNING: Config URL mengarah ke api.telegram.org. Pastikan ini benar untuk WA Gateway Anda.\n";
    }
    $gatewayUrl = $gatewayBase . '/send-group-message';
} else {
    $gatewayUrl = $gatewayBase;
}

echo "ℹ️  Info: Menggunakan URL Gateway: $gatewayUrl\n";

// Payload data ORIGINAL (untuk WA Gateway / System sendiri)
$data = [
    'id' => $groupId,      // Kembali ke 'id'
    'message' => $message  // Kembali ke 'message'
];

$ch = curl_init($gatewayUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

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
    echo "- Base URL di database: " . get_konfigurasi('api_url_group') . "\n";
    echo "- Pastikan wagateway running dan bisa diakses\n";
} elseif ($httpCode == 200) {
    $response = json_decode($result, true);
    if (isset($response['status']) && $response['status']) {
        echo "✅ SUCCESS: Pesan berhasil dikirim ke WhatsApp!\n";

        // --- REALTIME NOTIFICATION ---
        // Alih-alih input database manual, kita panggil API Jimpitan
        // agar notifikasi FCM langsung terkirim secara instan.
        
        $jimpitanApiUrl = "https://jimpitan.appsbee.my.id/index.php/chat/system-send";
        $jimpitanApiKey = "jimpitan_secret_batch_2024";

        $jimpitanData = [
            'key'           => $jimpitanApiKey,
            'receiver_id'   => 'GROUP_ALL', // Kirim ke Forum Warga
            'message'       => $message,
            'sender_id'     => 'SYSTEM',
            'sender_name'   => 'System Alert'
        ];

        $chJ = curl_init($jimpitanApiUrl);
        curl_setopt($chJ, CURLOPT_POST, true);
        curl_setopt($chJ, CURLOPT_POSTFIELDS, $jimpitanData);
        curl_setopt($chJ, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chJ, CURLOPT_TIMEOUT, 10);
        
        $jResult = curl_exec($chJ);
        $jHttpCode = curl_getinfo($chJ, CURLINFO_HTTP_CODE);
        curl_close($chJ);

        if ($jHttpCode == 200) {
             echo "✅ Jimpitan: Pesan diteruskan ke aplikasi & Notifikasi dipicu (Realtime)!\n";
        } else {
             echo "❌ Jimpitan: Gagal panggil API. HTTP: $jHttpCode, Response: $jResult\n";
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
