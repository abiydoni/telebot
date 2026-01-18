<?php
// Pastikan tidak ada output sebelum header
ob_start();

require 'db.php';
date_default_timezone_set('Asia/Jakarta');

// Terjemahan hari dan bulan ke Bahasa Indonesia
$hariIndo = [
    'Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa',
    'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat', 'Saturday' => 'Sabtu',
];
$bulanIndo = [
    'January' => 'Januari', 'February' => 'Februari', 'March' => 'Maret',
    'April' => 'April', 'May' => 'Mei', 'June' => 'Juni',
    'July' => 'Juli', 'August' => 'Agustus', 'September' => 'September',
    'October' => 'Oktober', 'November' => 'November', 'December' => 'Desember'
];

try {
    // Ambil parameter hari dari URL
    $hari = isset($_GET['hari']) ? $_GET['hari'] : date('l'); // default: hari ini
    
    // Validasi hari yang diinput
    if (!isset($hariIndo[$hari])) {
        $hari = date('l'); // fallback ke hari ini jika tidak valid
    }
    
    $hariInd = $hariIndo[$hari] ?? $hari;
    $tanggal = date('j');
    $bulanEng = date('F');
    $bulanInd = isset($bulanIndo[$bulanEng]) ? $bulanIndo[$bulanEng] : $bulanEng;
    $tahun = date('Y');

    // Ambil data jaga dari DB berdasarkan shift
    $stmt = $pdo->prepare("SELECT name FROM users WHERE shift = :hari ORDER BY name ASC");
    $stmt->execute(['hari' => $hari]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fungsi helper untuk escape markdown Telegram
    function escapeMarkdown($text) {
        // Escape karakter khusus markdown yang tidak ingin di-format
        // Jangan escape: titik (.), tanda kurung () karena digunakan untuk format normal
        $chars = ['_', '*', '[', ']', '~', '`', '>', '#', '+', '=', '|', '{', '}', '!'];
        foreach ($chars as $char) {
            $text = str_replace($char, '\\' . $char, $text);
        }
        // Escape minus hanya jika bukan bagian dari angka negatif
        $text = preg_replace('/(?<!\d)-(?!\d)/', '\\-', $text);
        return $text;
    }

    // Susun pesan
    $text = "⏰ *JADWAL JAGA*\n";
    $text .= "━━━━━━━━━━━━━━━━━━━━\n";
    $text .= "📅 *Hari: " . escapeMarkdown($hariInd) . "*\n\n";
    
    if ($users && count($users) > 0) {
        $text .= "👥 *Daftar Petugas Jaga:*\n\n";
        $no = 1;
        foreach ($users as $user) {
            $nama = htmlspecialchars($user['name'], ENT_QUOTES, 'UTF-8');
            $text .= $no . ". " . escapeMarkdown($nama) . "\n";
            $no++;
        }
        $text .= "\n━━━━━━━━━━━━━━━━━━━━\n";
        $text .= "📊 Total: " . count($users) . " petugas\n";
    } else {
        $text .= "❌ " . escapeMarkdown("Tidak ada petugas jaga.") . "\n";
    }
    
    $text .= "\n━━━━━━━━━━━━━━━━━━━━\n";
    $text .= "🌟 *Selamat bertugas*\n";
    $text .= "🏡 " . escapeMarkdown("RT.07 RW.01") . "\n\n";
    $text .= "🕸️ *Link Scan:*\n";
    $text .= "https://rt07.appsbee.my.id\n";
    $text .= "\n_Pesan Otomatis dari System_";

} catch (PDOException $e) {
    // Error handling untuk database
    $text = "❌ *Error*\n\n";
    $text .= "Terjadi kesalahan saat mengambil data jadwal jaga.\n";
    $text .= "Silakan coba lagi nanti.\n\n";
    $text .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_jaga_semua.php: " . $e->getMessage());
} catch (Exception $e) {
    // Error handling umum
    $text = "❌ *Error*\n\n";
    $text .= "Terjadi kesalahan pada sistem.\n";
    $text .= "Silakan coba lagi nanti.\n\n";
    $text .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_jaga_semua.php: " . $e->getMessage());
}

// Cek apakah di-include atau diakses langsung
$isIncluded = !isset($_SERVER['REQUEST_METHOD']);

if ($isIncluded) {
    // Jika di-include, set variabel $pesan untuk kompatibilitas
    $pesan = $text;
    ob_end_clean();
} else {
    // Jika diakses langsung via HTTP, output seperti biasa
    ob_end_clean();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo $text;
    exit;
}
