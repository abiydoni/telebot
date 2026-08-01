<?php
// Ambil konfigurasi (hardcoded karena tabel konfigurasi tidak ada di DB baru)
$filePesan = 'ambil_data_ultah.php';

// Ambil pesan dari file jika ada
$message = '';
if (!empty($filePesan)) {
    if (!file_exists($filePesan)) {
        $filePesan = __DIR__ . '/' . $filePesan;
    }
    if (file_exists($filePesan)) {
        include $filePesan;
        $message = isset($pesan) ? trim((string)$pesan) : '';
        
        // Jika tidak ada warga yang ulang tahun, ubah pesan menjadi motivasi harian
        if (isset($data) && is_array($data) && count($data) === 0) {
            $motivasi = [
                "Selamat pagi warga RT 07! Awali hari ini dengan senyuman dan semangat yang baru. Semoga hari ini membawa berkah untuk kita semua.",
                "Semangat pagi! Tidak ada keberhasilan tanpa kerja keras. Mari kita jadikan hari ini lebih baik dari hari kemarin.",
                "Selamat pagi! Tetap bersyukur atas apapun yang kita miliki hari ini. Semoga segala aktivitas hari ini selalu dilancarkan.",
                "Semangat pagi! Jadikan setiap tantangan hari ini sebagai batu loncatan menuju kesuksesan. Terus melangkah maju, RT 07!",
                "Awali pagimu dengan rasa syukur dan secangkir semangat. Mari bina kerukunan dan saling peduli antar sesama warga RT 07.",
                "Hari baru, semangat baru! Jangan lupa untuk selalu menebar kebaikan kepada sesama warga di lingkungan kita."
            ];
            $pesanMotivasi = $motivasi[array_rand($motivasi)];
            
            // Format pesan motivasi
            $message = "✨ *MOTIVASI HARI INI* ✨\n";
            $message .= "━━━━━━━━━━━━━━━━━━━━\n\n";
            if (function_exists('escapeMarkdown')) {
                $message .= "_" . escapeMarkdown($pesanMotivasi) . "_\n\n";
            } else {
                $message .= "_" . $pesanMotivasi . "_\n\n";
            }
            $message .= "━━━━━━━━━━━━━━━━━━━━\n";
            $message .= "💐 *Salam hangat dari RT 07!*\n\n";
            $message .= "_- Pesan Otomatis dari System -_";
            
            echo "ℹ️  Info: Tidak ada yang ulang tahun, mengirimkan pesan motivasi.\n";
        }
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
 * END INTEGRASI APPSBEE WA
 * =========================================================================
 */
?>
