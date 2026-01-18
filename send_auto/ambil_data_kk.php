<?php
// Pastikan tidak ada output sebelum header
ob_start();

require 'db.php'; // koneksi PDO

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

try {
    $stmt = $pdo->query("SELECT code_id, kk_name FROM master_kk ORDER BY kk_name ASC");
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $text = "📋 *DATA KEPALA KELUARGA*\n";
    $text .= "━━━━━━━━━━━━━━━━━━━━\n";
    $text .= "🏡 " . escapeMarkdown("Randuares RT.07 RW.01") . "\n\n";
    
    if ($data && count($data) > 0) {
        $text .= "👥 *Daftar Kepala Keluarga:*\n\n";
        $no = 1;
        foreach ($data as $row) {
            $code_id = htmlspecialchars($row['code_id'], ENT_QUOTES, 'UTF-8');
            $kk_name = htmlspecialchars($row['kk_name'], ENT_QUOTES, 'UTF-8');
            $text .= $no . ". *" . escapeMarkdown($code_id) . "* - " . escapeMarkdown($kk_name) . "\n";
            $no++;
        }
        $text .= "\n━━━━━━━━━━━━━━━━━━━━\n";
        $text .= "📊 Total: " . count($data) . " KK\n";
    } else {
        $text .= "❌ " . escapeMarkdown("Tidak ada data tersedia.") . "\n";
    }
    
    $text .= "\n_Pesan Otomatis dari System_";
} catch (PDOException $e) {
    // Error handling untuk database
    $text = "❌ *Error*\n\n";
    $text .= "Terjadi kesalahan saat mengambil data KK.\n";
    $text .= "Silakan coba lagi nanti.\n\n";
    $text .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_kk.php: " . $e->getMessage());
} catch (Exception $e) {
    // Error handling umum
    $text = "❌ *Error*\n\n";
    $text .= "Terjadi kesalahan pada sistem.\n";
    $text .= "Silakan coba lagi nanti.\n\n";
    $text .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_kk.php: " . $e->getMessage());
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
    header('Pragma: no-cache');
    header('Expires: 0');
    echo $text;
    exit;
}
?>
