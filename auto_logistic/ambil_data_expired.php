<?php
// Pastikan tidak ada output sebelum header
ob_start();

require_once __DIR__ . '/db.php';
if (! function_exists('get_konfigurasi')) {
    require_once __DIR__ . '/get_konfigurasi.php';
}
date_default_timezone_set('Asia/Jakarta');

$pesan = '';
$hasAlert = false;
$expiredCount = 0;
$warningCount = 0;

$companyName = 'AppsBeem Logistic';
$notifyDays  = (int) (get_konfigurasi('wa_notify_days') ?: 30);
if ($notifyDays <= 0) {
    $notifyDays = 30;
}

$today      = date('Y-m-d');
$warningEnd = date('Y-m-d', strtotime("+{$notifyDays} days"));

try {
    $stmt = $pdo->query('SELECT company_name FROM app_settings WHERE id = 1 LIMIT 1');
    $row  = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && ! empty($row['company_name'])) {
        $companyName = $row['company_name'];
    }
} catch (Throwable $t) {
}

// Fungsi helper untuk escape markdown Telegram
if (!function_exists('escapeMarkdown')) {
    function escapeMarkdown(string $text): string {
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
}

if (!function_exists('format_expired_line')) {
    function format_expired_line(int $no, array $it, bool $isPast): string
    {
        $name   = $it['name'] ?? '-';
        $code   = $it['code'] ?? '-';
        $wh     = $it['warehouse_name'] ?? '-';
        $stock  = (int) ($it['current_stock'] ?? 0);
        $unit   = $it['unit'] ?? '';
        $exp    = $it['expired_date'] ?? '';
        $expFmt = $exp ? date('d/m/Y', strtotime($exp)) : '-';

        $todayTs = strtotime(date('Y-m-d'));
        $expTs   = $exp ? strtotime($exp) : $todayTs;

        if ($isPast && $exp) {
            $dayLabel = ' (' . (int) floor(($todayTs - $expTs) / 86400) . ' hari lalu)';
        } else {
            $dayLabel = ' (' . ($exp ? (int) floor(($expTs - $todayTs) / 86400) : 0) . ' hari lagi)';
        }

        $line  = "{$no}. *" . escapeMarkdown($name) . "*\n";
        $line .= "   Stok: *" . escapeMarkdown((string)$stock) . "* " . escapeMarkdown($unit) . "\n";
        $line .= "   Exp: *" . escapeMarkdown($expFmt) . "*" . escapeMarkdown($dayLabel) . "\n\n";

        return $line;
    }
}

try {
    $sql = "
        SELECT items.id, items.code, items.name, items.unit, 
               item_batches.stock AS current_stock,
               item_batches.expired_date, warehouses.name AS warehouse_name
        FROM item_batches
        INNER JOIN items ON items.id = item_batches.item_id
        LEFT JOIN warehouses ON warehouses.id = items.warehouse_id
        WHERE items.is_active = 1
          AND item_batches.stock > 0
          AND item_batches.expired_date IS NOT NULL
          AND item_batches.expired_date <= :warning_end
        ORDER BY item_batches.expired_date ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':warning_end' => $warningEnd]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $itemsExpired = [];
    $itemsWarning = [];

    foreach ($rows as $row) {
        if ($row['expired_date'] < $today) {
            $itemsExpired[] = $row;
        } else {
            $itemsWarning[] = $row;
        }
    }

    $expiredCount = count($itemsExpired);
    $warningCount = count($itemsWarning);
    $hasAlert     = ($expiredCount + $warningCount) > 0;

    if ($hasAlert) {
        $pesan = "⚠️ *ALERT STOK KEDALUWARSA*\n";
        $pesan .= "🏢 *" . escapeMarkdown($companyName) . "*\n";
        $pesan .= "━━━━━━━━━━━━━━━━━━━━\n\n";
        $pesan .= "📅 " . escapeMarkdown(date('d M Y H:i') . " WIB") . "\n";
        $pesan .= "ℹ️ Peringatan ≤ *" . escapeMarkdown((string)$notifyDays) . "* hari ke depan\n\n";

        if ($expiredCount > 0) {
            $pesan .= "🔴 *SUDAH KEDALUWARSA* (" . escapeMarkdown((string)$expiredCount) . " barang)\n\n";
            $no = 1;
            foreach ($itemsExpired as $it) {
                $pesan .= format_expired_line($no++, $it, true);
            }
            $pesan .= "\n";
        }

        if ($warningCount > 0) {
            $pesan .= "🟠 *HAMPIR KEDALUWARSA* (" . escapeMarkdown((string)$warningCount) . " barang)\n\n";
            $no = 1;
            foreach ($itemsWarning as $it) {
                $pesan .= format_expired_line($no++, $it, false);
            }
            $pesan .= "\n";
        }

        $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
        $pesan .= "📦 Segera cek & mutasi stok di aplikasi Logistic.\n";
        $pesan .= "🔗 " . escapeMarkdown("logistic.appsbee.my.id") . "\n\n";
        $pesan .= "_Pesan otomatis — System Logistic_";
    }
} catch (PDOException $e) {
    // Error handling untuk database
    $pesan = "❌ *Error Logistic Notify*\n\n";
    $pesan .= "Gagal ambil data: " . escapeMarkdown($e->getMessage()) . "\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_expired.php: " . $e->getMessage());
} catch (Exception $e) {
    // Error handling umum
    $pesan = "❌ *Error*\n\n";
    $pesan .= "Terjadi kesalahan pada sistem.\n";
    $pesan .= "Silakan coba lagi nanti.\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_expired.php: " . $e->getMessage());
}

// Supaya tetap kompatibel jika ada file yang meng-include mencari $message
$message = $pesan;

// Cek apakah di-include atau diakses langsung
$included_files = get_included_files();
$isIncluded = (realpath($included_files[0]) !== realpath(__FILE__));

if ($isIncluded) {
    // Jika di-include, jangan output, biarkan variabel $pesan (dan $message) tersedia
    ob_end_clean();
} else {
    // Jika diakses langsung via HTTP, output seperti biasa
    ob_end_clean();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    if (empty($pesan)) {
        echo "✅ Tidak ada data barang yang kedaluwarsa atau hampir kedaluwarsa saat ini.";
    } else {
        echo $pesan;
    }
    exit;
}
