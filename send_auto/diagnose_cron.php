<?php
// diagnose_cron.php
// Script untuk mengecek lingkungan PHP CLI (untuk Cron Job)

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== DIAGNOSTIC START ===\n";
echo "Waktu Server: " . date('Y-m-d H:i:s') . "\n";
echo "PHP Version: " . phpversion() . "\n";
echo "SAPI Name: " . php_sapi_name() . "\n";
echo "Current Dir: " . getcwd() . "\n";
echo "User: " . get_current_user() . "\n\n";

// 1. Cek Extension
echo "[1] Checking Extensions...\n";
$required = ['curl', 'pdo', 'pdo_mysql', 'json'];
foreach ($required as $ext) {
    if (extension_loaded($ext)) {
        echo "✅ Extension '$ext' loaded.\n";
    } else {
        echo "❌ Extension '$ext' NOT loaded!\n";
    }
}
echo "\n";

// 2. Cek File Access
echo "[2] Checking File Access...\n";
$files = [
    __DIR__ . '/db.php',
    __DIR__ . '/get_konfigurasi.php',
    __DIR__ . '/ambil_data_ultah.php'
];

foreach ($files as $f) {
    if (file_exists($f)) {
        echo "✅ File found: $f\n";
    } else {
        echo "❌ File NOT found: $f\n";
    }
}
echo "\n";

// 3. Cek Database Connection
echo "[3] Checking Database Connection...\n";
if (file_exists(__DIR__ . '/db.php')) {
    include __DIR__ . '/db.php';
    if (isset($pdo)) {
        echo "✅ \$pdo variable available.\n";
        try {
            $stmt = $pdo->query("SELECT 1");
            echo "✅ Database connection test: SUCCESS\n";
            
            // Cek Config
            $stmt = $pdo->query("SELECT value FROM tb_konfigurasi WHERE nama = 'api_url_group' LIMIT 1");
            if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                 echo "✅ Config 'api_url_group' found: " . $row['value'] . "\n";
            } else {
                 echo "⚠️ Config 'api_url_group' NOT found!\n";
            }
            
        } catch (Exception $e) {
            echo "❌ Database Error: " . $e->getMessage() . "\n";
        }
    } else {
        echo "❌ \$pdo variable NOT available after include!\n";
    }
} else {
    echo "❌ Skipped because db.php not found.\n";
}
echo "\n";

// 4. Cek Curl Connection (Network)
echo "[4] Checking Network (Curl)...\n";
// Ambil URL dari config atau default
$testUrl = isset($row['value']) ? $row['value'] : 'http://google.com';
if (empty($testUrl)) $testUrl = 'http://google.com';

// Jika URL internal, pastikan ada path yang valid
if (strpos($testUrl, 'api.telegram.org') === false && strpos($testUrl, '.php') === false && strpos($testUrl, '/send-group-message') === false) {
    $testUrl .= '/send-group-message';
}

echo "Testing URL: $testUrl (METHOD: POST)\n";
$ch = curl_init($testUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['id' => '120363398680818900@g.us', 'message' => 'Test from Diagnose Cron']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
// Verif SSL false dulu untuk testing internal
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);

$res = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
$info = curl_getinfo($ch); // Ambil info detail (IP, etc)
curl_close($ch);

echo "Connected to IP: " . $info['primary_ip'] . "\n";
echo "Content Type: " . $info['content_type'] . "\n";

if ($httpCode > 0) {
    if ($httpCode == 200) {
        echo "✅ Curl Success (HTTP 200)\n";
        echo "Response Body: " . substr($res, 0, 100) . "...\n";
    } else {
        echo "❌ Curl Failed (HTTP $httpCode)\n";
        echo "Response Body: " . substr($res, 0, 200) . "\n";
    }
} else {
    echo "❌ Curl Failed: $err\n";
}

// 5. Cek Write Permissions
echo "[5] Checking Write Permissions...\n";
$logFile = __DIR__ . '/php_write_test.txt';
if (file_put_contents($logFile, "Test write at " . date('Y-m-d H:i:s'))) {
    echo "✅ PHP can write to: $logFile\n";
    // Clean up
    unlink($logFile);
} else {
    echo "❌ PHP CANNOT write to: " . __DIR__ . "\n";
    echo "   Check folder permissions (chmod 755 or 777)\n";
}

echo "\n=== DIAGNOSTIC END ===\n";
?>
