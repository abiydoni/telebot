<?php
// Pastikan tidak ada output sebelum header
ob_start();

require 'db.php';
date_default_timezone_set('Asia/Jakarta');

// Array bulan Indonesia
$bulanIndo = [
    '01' => 'Januari',
    '02' => 'Februari',
    '03' => 'Maret',
    '04' => 'April',
    '05' => 'Mei',
    '06' => 'Juni',
    '07' => 'Juli',
    '08' => 'Agustus',
    '09' => 'September',
    '10' => 'Oktober',
    '11' => 'November',
    '12' => 'Desember',
];

try {
    // Ambil tanggal hari ini (tanpa tahun)
    $today = date('m-d');

    // Query warga yang ulang tahun hari ini
    $stmt = $pdo->prepare("SELECT nama, tgl_lahir FROM tb_warga WHERE DATE_FORMAT(tgl_lahir, '%m-%d') = ?");
    $stmt->execute([$today]);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

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

    // Bangun pesan ucapan ultah
    $pesan = "🎉 *SELAMAT ULANG TAHUN!* 🎂\n";
    $pesan .= "━━━━━━━━━━━━━━━━━━━━\n\n";

    if ($data && count($data) > 0) {
        $pesan .= "📅 *Hari ini ada yang berulang tahun:*\n\n";
        $no = 1;
        foreach ($data as $warga) {
            // Format tanggal lahir ke Indonesia (tanpa tahun)
            $tglObj = date_create($warga['tgl_lahir']);
            if ($tglObj) {
                $tgl = date_format($tglObj, 'd');
                $blnKey = date_format($tglObj, 'm');
                $bln = isset($bulanIndo[$blnKey]) ? $bulanIndo[$blnKey] : $blnKey;
                $nama = htmlspecialchars($warga['nama'], ENT_QUOTES, 'UTF-8');
                $pesan .= $no . ". *" . escapeMarkdown($nama) . "*\n";
                $pesan .= "   🎂 Lahir: " . escapeMarkdown($tgl . " " . $bln) . "\n\n";
                $no++;
            }
        }
        if ($no > 1) {
            $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
            $pesan .= "🎈 *Semoga panjang umur, sehat selalu, dan bahagia!* ✨\n";
        } else {
            $pesan .= escapeMarkdown("Tidak ada warga yang berulang tahun hari ini.") . "\n";
        }
    } else {
        $pesan .= escapeMarkdown("Tidak ada warga yang berulang tahun hari ini.") . "\n";
    }

    $pesan .= "\n━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "💐 *Salam hangat dari RT 07!*\n";
    $pesan .= "\n_Pesan Otomatis dari System_";

} catch (PDOException $e) {
    // Error handling untuk database
    $pesan = "❌ *Error*\n\n";
    $pesan .= "Terjadi kesalahan saat mengambil data ulang tahun.\n";
    $pesan .= "Silakan coba lagi nanti.\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_ultah.php: " . $e->getMessage());
} catch (Exception $e) {
    // Error handling umum
    $pesan = "❌ *Error*\n\n";
    $pesan .= "Terjadi kesalahan pada sistem.\n";
    $pesan .= "Silakan coba lagi nanti.\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_ultah.php: " . $e->getMessage());
}

// Cek apakah di-include atau diakses langsung
$isIncluded = !isset($_SERVER['REQUEST_METHOD']);

if ($isIncluded) {
    // Jika di-include, jangan output, biarkan variabel $pesan tersedia
    ob_end_clean();
} else {
    // Jika diakses langsung via HTTP, output seperti biasa
    ob_end_clean();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo $pesan;
    exit;
}