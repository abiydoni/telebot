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

// Sinkronisasi items.expired_date agar konsisten dengan batch aktif & pengaturan gudang
// (Mencegah exp palsu untuk barang di gudang non-exp atau stok yang sudah 0)
try {
    $pdo->query("
        UPDATE items i
        LEFT JOIN (
            SELECT b.item_id, MIN(b.expired_date) as earliest_exp
            FROM item_batches b
            WHERE b.stock > 0 
              AND b.expired_date IS NOT NULL 
              AND b.expired_date != '' 
              AND b.expired_date != '0000-00-00'
              AND b.expired_date > '1970-01-01'
            GROUP BY b.item_id
        ) act ON act.item_id = i.id
        LEFT JOIN warehouses w ON w.id = i.warehouse_id
        SET i.expired_date = CASE 
            WHEN w.requires_expiration = 0 THEN NULL
            WHEN i.current_stock <= 0 THEN NULL
            ELSE act.earliest_exp
        END
    ");
} catch (Throwable $t) {
}

// Fungsi helper escape untuk pesan WA
if (!function_exists('escapeMarkdown')) {
    function escapeMarkdown(string $text): string {
        // Jangan tambahkan backslash karena di WhatsApp karakter \- atau \* akan tercetak apa adanya
        return $text;
    }
}

if (!function_exists('format_expired_line')) {
    function format_expired_line(int $no, array $it, bool $isPast): string
    {
        $name   = trim($it['name'] ?? '-');
        $code   = trim($it['code'] ?? '-');
        $wh     = trim($it['warehouse_name'] ?? '-');
        $stock  = (int) ($it['current_stock'] ?? 0);
        $unit   = trim($it['unit'] ?? '');
        $exp    = trim($it['expired_date'] ?? '');
        
        if (empty($exp) || $exp === '0000-00-00' || ($expTs = strtotime($exp)) === false) {
            return '';
        }

        $expFmt  = date('d/m/Y', $expTs);
        $todayTs = strtotime(date('Y-m-d'));

        if ($isPast) {
            $diffDays = (int) floor(($todayTs - $expTs) / 86400);
            $dayLabel = ' (' . max(0, $diffDays) . ' hari lalu)';
        } else {
            $diffDays = (int) floor(($expTs - $todayTs) / 86400);
            $dayLabel = ' (' . max(0, $diffDays) . ' hari lagi)';
        }

        $line  = "{$no}. *" . $name . "*\n";
        $line .= "   Stok: *" . $stock . "* " . $unit . "\n";
        $line .= "   Exp: *" . $expFmt . "*" . $dayLabel . "\n\n";

        return $line;
    }
}

try {
    // Filter ketat agar TIDAK muncul exp palsu:
    // 1. items.is_active = 1 (barang aktif)
    // 2. items.current_stock > 0 (stok fisik barang masih ada)
    // 3. warehouses.requires_expiration = 1 (hanya gudang yang memerlukan tanggal exp, misal F&B. Gudang non-exp diabaikan)
    // 4. item_batches.stock > 0 (batch masih memiliki sisa stok)
    // 5. item_batches.expired_date valid (bukan null, bukan kosong, bukan 0000-00-00, bukan 1970-01-01)
    // 6. item_batches.expired_date <= :warning_end (masuk rentang peringatan)
    $sql = "
        SELECT items.id, items.code, items.name, items.unit, 
               SUM(item_batches.stock) AS current_stock,
               item_batches.expired_date, warehouses.name AS warehouse_name
        FROM item_batches
        INNER JOIN items ON items.id = item_batches.item_id
        LEFT JOIN warehouses ON warehouses.id = items.warehouse_id
        WHERE items.is_active = 1
          AND items.current_stock > 0
          AND (warehouses.requires_expiration = 1 OR warehouses.requires_expiration IS NULL)
          AND item_batches.stock > 0
          AND item_batches.expired_date IS NOT NULL
          AND item_batches.expired_date != ''
          AND item_batches.expired_date != '0000-00-00'
          AND item_batches.expired_date > '1970-01-01'
          AND item_batches.expired_date <= :warning_end
        GROUP BY items.id, items.code, items.name, items.unit, item_batches.expired_date, warehouses.name
        ORDER BY item_batches.expired_date ASC, items.name ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':warning_end' => $warningEnd]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $itemsExpired = [];
    $itemsWarning = [];

    foreach ($rows as $row) {
        $exp = trim($row['expired_date'] ?? '');
        if (empty($exp) || $exp === '0000-00-00' || strtotime($exp) === false) {
            continue;
        }
        if ((int) ($row['current_stock'] ?? 0) <= 0) {
            continue;
        }

        if ($exp < $today) {
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
                $line = format_expired_line($no, $it, true);
                if ($line !== '') {
                    $pesan .= $line;
                    $no++;
                }
            }
            $pesan .= "\n";
        }

        if ($warningCount > 0) {
            $pesan .= "🟠 *HAMPIR KEDALUWARSA* (" . escapeMarkdown((string)$warningCount) . " barang)\n\n";
            $no = 1;
            foreach ($itemsWarning as $it) {
                $line = format_expired_line($no, $it, false);
                if ($line !== '') {
                    $pesan .= $line;
                    $no++;
                }
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
