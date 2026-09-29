<?php
// Atur batas waktu eksekusi agar tidak terkena timeout di cron/server
@ini_set('max_execution_time', '300');
@set_time_limit(300);

// Ambil konfigurasi (hardcoded karena tabel konfigurasi tidak ada di DB baru)
$filePesan = 'ambil_data_ultah.php';

// Helper kirim ke chat group
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/send_to_chat.php';

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
                "Hari baru, semangat baru! Jangan lupa untuk selalu menebar kebaikan dan senyuman kepada sesama tetangga.",
                "Kerukunan dan kebersamaan adalah kunci lingkungan yang tenteram dan harmonis. Selamat beraktivitas untuk seluruh warga!",
                "Rezeki bukan hanya berupa uang, tetapi juga kesehatan, keluarga yang bahagia, dan tetangga yang baik. Selamat pagi dan selamat beraktivitas!",
                "Setiap pagi adalah kesempatan baru untuk menjadi pribadi yang lebih baik dan bermanfaat bagi sesama.",
                "Tetap jaga kesehatan, keselamatan, dan kebersihan lingkungan kita bersama. RT 07 bersih, sehat, dan kompak selalu!",
                "Mulailah hari dengan pikiran positif dan niat yang tulus. Apapun pekerjaanmu hari ini, kerjakanlah dengan sepenuh hati.",
                "Kebaikan kecil yang kita lakukan hari ini bisa membawa kebahagiaan besar bagi orang lain. Selamat pagi warga!",
                "Jangan biarkan kesulitan kemarin meredupkan semangatmu hari ini. Setiap hari baru menyimpan harapan baru.",
                "Lingkungan yang nyaman berawal dari kepedulian dan kehangatan warganya. Mari terus jaga silaturahmi antar warga RT 07.",
                "Sukses itu bukan tentang seberapa cepat kita sampai, melainkan bagaimana kita terus melangkah tanpa menyerah. Semangat pagi!",
                "Syukurilah hembusan nafas di pagi hari ini. Semoga rezeki yang halal, berkah, dan berlimpah mengalir untuk keluarga kita.",
                "Jadikan hari ini penuh karya dan kebermanfaatan. Semangat menjemput rezeki untuk seluruh warga RT 07!",
                "Tetangga adalah saudara terdekat kita saat berada di rumah. Jaga selalu toleransi, rasa hormat, dan tolong-menolong.",
                "Pagi yang cerah adalah berkah Tuhan yang luar biasa. Sambutlah dengan rasa optimis dan doa terbaik.",
                "Keluarga adalah rumah tempat kita kembali, dan tetangga adalah sahabat saat saling membutuhkan. Selamat beraktivitas bapak & ibu warga!",
                "Senyum di pagi hari adalah sedekah termudah yang bisa mencerahkan hari orang-orang di sekitar kita. Tebarkan senyuman!",
                "Waktu yang kita miliki hari ini adalah anugerah tak ternilai. Gunakan untuk hal-hal positif yang membangun kebaikan.",
                "Bekerja keras, berdoa ikhlas, dan jangan lupa beristirahat yang cukup. Semoga kesehatan selalu menyertai kita semua.",
                "Semangat gotong royong dan kepedulian sosial adalah identitas kebanggaan warga kita. Terus jaga persaudaraan di RT 07!",
                "Tidak ada hari yang sia-sia jika kita mengisinya dengan amal baik dan senantiasa berprasangka baik pada takdir-Nya.",
                "Fokus pada apa yang bisa kita perbaiki dan berikan yang terbaik dalam setiap langkah hidup kita hari ini.",
                "Tetap semangat, sabar dalam ikhtiar, dan tawakal dalam doa. Semoga hari ini penuh dengan kemudahan dan kabar gembira.",
                "Selamat pagi! Mari kita wujudkan lingkungan RT 07 yang aman, damai, bersahaja, dan penuh berkah bagi seluruh warga.",
                "Sebaik-baik manusia adalah yang paling bermanfaat bagi orang lain. Selamat beraktivitas dan menebar manfaat!",
                "Jaga keharmonisan keluarga, jaga kerukunan tetangga. Bersama kita ciptakan lingkungan yang saling menguatkan.",
                "Kebahagiaan bukan didapat dari apa yang kita miliki, tetapi dari bagaimana kita mensyukuri dan membaginya. Selamat pagi!"
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

/**
 * =========================================================================
 * 1. KIRIM KE CHAT GROUP WARGA (village_001) - INPUT KE TABEL chat_messages
 * =========================================================================
 */
echo "\n--- Mengirim ke Chat Grup Warga (Database & Notifikasi) ---\n";
if (!empty($message)) {
    sendToGroupChat($pdo, $message, 'appsbee');
}

/**
 * =========================================================================
 * 2. KIRIM VIA WHATSAPP (APPSBEE WA)
 * =========================================================================
 */
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
curl_setopt($chAppsbee, CURLOPT_CONNECTTIMEOUT, 10);
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
?>

