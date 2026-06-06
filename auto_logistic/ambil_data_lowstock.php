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
$habisCount = 0;
$menipisCount = 0;

$companyName = 'AppsBeem Logistic';

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
        $chars = ['_', '*', '[', ']', '~', '`', '>', '#', '+', '=', '|', '{', '}', '!'];
        foreach ($chars as $char) {
            $text = str_replace($char, '\\' . $char, $text);
        }
        $text = preg_replace('/(?<!\d)-(?!\d)/', '\\-', $text);
        return $text;
    }
}

if (!function_exists('format_lowstock_line')) {
    function format_lowstock_line(int $no, array $it): string
    {
        $name   = $it['name'] ?? '-';
        $stock  = (int) ($it['current_stock'] ?? 0);
        $min    = (int) ($it['min_stock'] ?? 0);

        return "{$no}. *" . escapeMarkdown($name) . "* (" . escapeMarkdown((string)$stock) . "/" . escapeMarkdown((string)$min) . ")\n";
    }
}

try {
    $sql = "
        SELECT items.id, items.code, items.name, items.unit, 
               items.current_stock, items.min_stock, warehouses.name AS warehouse_name
        FROM items
        LEFT JOIN warehouses ON warehouses.id = items.warehouse_id
        WHERE items.is_active = 1
          AND items.current_stock <= items.min_stock
        ORDER BY items.current_stock ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $itemsHabis = [];
    $itemsMenipis = [];

    foreach ($rows as $row) {
        if ($row['current_stock'] <= 0) {
            $itemsHabis[] = $row;
        } else {
            $itemsMenipis[] = $row;
        }
    }

    $habisCount = count($itemsHabis);
    $menipisCount = count($itemsMenipis);
    $hasAlert = ($habisCount + $menipisCount) > 0;

    if ($hasAlert) {
        $pesan = "⚠️ *ALERT STOK MENIPIS / HABIS*\n";
        $pesan .= "🏢 *" . escapeMarkdown($companyName) . "*\n";
        $pesan .= "━━━━━━━━━━━━━━━━━━━━\n\n";
        $pesan .= "📅 " . escapeMarkdown(date('d M Y H:i') . " WIB") . "\n\n";

        if ($habisCount > 0) {
            $pesan .= "🔴 *STOK HABIS (KOSONG)* (" . escapeMarkdown((string)$habisCount) . " barang)\n\n";
            $no = 1;
            foreach ($itemsHabis as $it) {
                $pesan .= format_lowstock_line($no++, $it);
            }
            $pesan .= "\n";
        }

        if ($menipisCount > 0) {
            $pesan .= "🟠 *STOK MENIPIS* (" . escapeMarkdown((string)$menipisCount) . " barang)\n\n";
            $no = 1;
            foreach ($itemsMenipis as $it) {
                $pesan .= format_lowstock_line($no++, $it);
            }
            $pesan .= "\n";
        }

        $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
        $pesan .= "📦 Segera lakukan pengadaan stok di aplikasi Logistic.\n";
        $pesan .= "🔗 " . escapeMarkdown("logistic.appsbee.my.id") . "\n\n";
        $pesan .= "_Pesan otomatis — System Logistic_";
    }
} catch (PDOException $e) {
    // Error handling untuk database
    $pesan = "❌ *Error Logistic Notify*\n\n";
    $pesan .= "Gagal ambil data low stock: " . escapeMarkdown($e->getMessage()) . "\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_lowstock.php: " . $e->getMessage());
} catch (Exception $e) {
    // Error handling umum
    $pesan = "❌ *Error*\n\n";
    $pesan .= "Terjadi kesalahan pada sistem saat cek low stock.\n";
    $pesan .= "Silakan coba lagi nanti.\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_lowstock.php: " . $e->getMessage());
}

$message = $pesan;
// Cek apakah di-include atau diakses langsung
$included_files = get_included_files();
$isIncluded = (realpath($included_files[0]) !== realpath(__FILE__));

if ($isIncluded) {
    // Jika di-include
    ob_end_clean();
} else {
    // Jika diakses langsung via HTTP
    ob_end_clean();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    if (empty($pesan)) {
        echo "✅ Semua stok barang masih aman (di atas batas minimal).";
    } else {
        echo $pesan;
    }
    exit;
}
