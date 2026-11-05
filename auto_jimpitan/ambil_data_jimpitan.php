<?php
// Pastikan tidak ada output sebelum header
ob_start();

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/get_konfigurasi.php';
date_default_timezone_set('Asia/Jakarta');

// Terjemahan hari dan bulan ke Bahasa Indonesia
$hariIndo = [
    'Sunday'    => 'Minggu',
    'Monday'    => 'Senin',
    'Tuesday'   => 'Selasa',
    'Wednesday' => 'Rabu',
    'Thursday'  => 'Kamis',
    'Friday'    => 'Jumat',
    'Saturday'  => 'Sabtu',
];

$bulanIndo = [
    'January'   => 'Januari',
    'February'  => 'Februari',
    'March'     => 'Maret',
    'April'     => 'April',
    'May'       => 'Mei',
    'June'      => 'Juni',
    'July'      => 'Juli',
    'August'    => 'Agustus',
    'September' => 'September',
    'October'   => 'Oktober',
    'November'  => 'November',
    'December'  => 'Desember',
];

// Helper escape untuk pesan WhatsApp (hindari backslash karena di WhatsApp karakter \* atau \- dicetak literal)
if (!function_exists('escapeMarkdown')) {
    function escapeMarkdown($text) {
        return trim((string)$text);
    }
}

try {
    // Village ID dinamis dari pengaturan sistem
    $villageId = isset($villageId) && !empty($villageId)
        ? $villageId
        : (function_exists('get_konfigurasi') ? get_konfigurasi('WA_GROUP_VILLAGE_ID', 'village_001') : 'village_001');

    // Tanggal target: default kemarin (semalam), mendukung parameter GET ?date=YYYY-MM-DD
    $targetDate = isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'])
        ? $_GET['date']
        : (new DateTime('yesterday'))->format('Y-m-d');

    $targetDateTime = new DateTime($targetDate);
    $hariEng = $targetDateTime->format('l');
    $hariInd = $hariIndo[$hariEng] ?? $hariEng;
    $tgl     = $targetDateTime->format('j');
    $bulanEng = $targetDateTime->format('F');
    $bulanInd = $bulanIndo[$bulanEng] ?? $bulanEng;
    $tahun   = $targetDateTime->format('Y');
    $tanggalLengkap = "$hariInd, $tgl $bulanInd $tahun";

    // Ambil nama Desa/RT jika tersedia
    $villageTitle = 'RT 07 RW 01';
    try {
        $stmtV = $pdo->prepare("SELECT name FROM villages WHERE id = :villageId LIMIT 1");
        $stmtV->execute([':villageId' => $villageId]);
        $vRow = $stmtV->fetch(PDO::FETCH_ASSOC);
        if ($vRow && !empty($vRow['name'])) {
            $villageTitle = $vRow['name'];
        }
    } catch (Throwable $e) {}

    // =========================================================================
    // 1. DATA JIMPITAN FISIK RONDA LAPANGAN (QR SCAN & INPUT MANUAL)
    // =========================================================================
    // PENTING: Filter (type != 'TAGIHAN') agar uang pelunasan hutang/tagihan 
    // TIDAK bercampur dengan setoran fisik jimpitan semalam di pos ronda!
    $stmtFisik = $pdo->prepare("
        SELECT 
            m.uniqueCode AS code_id, 
            m.name AS kk_name, 
            COALESCE(SUM(r.amount), 0) AS jumlah_nominal,
            COUNT(r.id) AS jumlah_scan,
            SUM(CASE WHEN r.type = 'MANUAL' THEN 1 ELSE 0 END) AS manual_count,
            SUM(CASE WHEN r.type = 'JIMPITAN' OR r.type IS NULL OR r.type = '' THEN 1 ELSE 0 END) AS qr_count
        FROM users m
        LEFT JOIN jimpitan_history r ON (
            m.uniqueCode = r.kkId 
            OR (r.kkId IS NOT NULL AND (r.kkId = m.familyId OR r.kkId = m.noKK))
        )
        AND r.date = :targetDate 
        AND r.villageId = :villageId
        AND (r.type IS NULL OR r.type = '' OR r.type != 'TAGIHAN')
        WHERE m.statusHubungan = 'Kepala Keluarga' 
          AND m.villageId = :villageId
        GROUP BY m.uniqueCode, m.name
        ORDER BY m.uniqueCode ASC
    ");
    $stmtFisik->execute([
        ':targetDate' => $targetDate,
        ':villageId'  => $villageId,
    ]);
    $dataFisik = $stmtFisik->fetchAll(PDO::FETCH_ASSOC);

    $totalFisikNominal = (int) array_sum(array_column($dataFisik, 'jumlah_nominal'));
    $totalQrCount      = (int) array_sum(array_column($dataFisik, 'qr_count'));
    $totalManualCount  = (int) array_sum(array_column($dataFisik, 'manual_count'));
    $totalFisikScan    = $totalQrCount + $totalManualCount;
    $totalKk           = count($dataFisik);

    $dataKosong = [];
    foreach ($dataFisik as $row) {
        if ((int)$row['jumlah_nominal'] === 0) {
            $dataKosong[] = $row;
        }
    }
    $totalKosong = count($dataKosong);
    $totalTerisi = $totalKk - $totalKosong;

    // =========================================================================
    // 2. DATA PETUGAS JIMPITAN RONDA (HANYA DARI SCAN & MANUAL LAPANGAN)
    // =========================================================================
    // TAGIHAN tidak dimasukkan sebagai petugas, nama petugas manual diambil dari scannedByName
    $stmtPetugas = $pdo->prepare("
        SELECT 
            COALESCE(NULLIF(TRIM(r.scannedByName), ''), NULLIF(TRIM(u.name), ''), r.scannedBy, 'Petugas Ronda') AS nama_petugas,
            COUNT(*) AS total_scan,
            SUM(CASE WHEN r.type = 'MANUAL' THEN 1 ELSE 0 END) AS manual_count,
            SUM(CASE WHEN r.type = 'JIMPITAN' OR r.type IS NULL OR r.type = '' THEN 1 ELSE 0 END) AS qr_count
        FROM jimpitan_history r
        LEFT JOIN users u ON r.scannedBy = u.uid
        WHERE r.date = :targetDate 
          AND r.villageId = :villageId
          AND (r.type IS NULL OR r.type = '' OR r.type != 'TAGIHAN')
        GROUP BY nama_petugas
        HAVING total_scan > 0
        ORDER BY total_scan DESC, nama_petugas ASC
    ");
    $stmtPetugas->execute([
        ':targetDate' => $targetDate,
        ':villageId'  => $villageId,
    ]);
    $dataPetugas = $stmtPetugas->fetchAll(PDO::FETCH_ASSOC);

    // =========================================================================
    // 3. DATA PELUNASAN TAGIHAN JIMPITAN (NON-FISIK / VIA APLIKASI / BENDAHARA)
    // =========================================================================
    $stmtTagihan = $pdo->prepare("
        SELECT 
            r.id,
            r.kkId,
            COALESCE(NULLIF(TRIM(r.name), ''), NULLIF(TRIM(u.name), ''), r.kkId) AS nama_kk,
            r.amount,
            COALESCE(NULLIF(TRIM(r.scannedByName), ''), 'Bendahara/Admin') AS dicatat_oleh,
            r.timestamp
        FROM jimpitan_history r
        LEFT JOIN users u ON (
            r.kkId = u.uniqueCode OR r.kkId = u.noKK OR r.kkId = u.familyId
        ) AND u.statusHubungan = 'Kepala Keluarga' AND u.villageId = :villageId
        WHERE r.date = :targetDate 
          AND r.villageId = :villageId
          AND r.type = 'TAGIHAN'
        ORDER BY r.timestamp ASC
    ");
    $stmtTagihan->execute([
        ':targetDate' => $targetDate,
        ':villageId'  => $villageId,
    ]);
    $dataTagihan = $stmtTagihan->fetchAll(PDO::FETCH_ASSOC);

    $totalTagihanNominal = (int) array_sum(array_column($dataTagihan, 'amount'));
    $jumlahPelunasan      = count($dataTagihan);

    // =========================================================================
    // 4. RINGKASAN TOTAL KESELURUHAN (SESUAI LAPORAN JIMPITAN DI APLIKASI)
    // =========================================================================
    $grandTotalKas   = $totalFisikNominal + $totalTagihanNominal;
    $totalWargaData  = $totalFisikScan + $jumlahPelunasan;

    // =========================================================================
    // 5. PENYUSUNAN FORMAT PESAN WHATSAPP
    // =========================================================================
    $pesan = "📊 *LAPORAN JIMPITAN*\n";
    if (!empty($villageTitle)) {
        $pesan .= "🏡 *" . escapeMarkdown($villageTitle) . "*\n";
    }
    $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "📅 *" . escapeMarkdown($tanggalLengkap) . "* _(Semalam)_\n\n";

    // Ringkasan Header Utama
    $pesan .= "💰 *Total Terkumpul:* Rp " . number_format($grandTotalKas, 0, ',', '.') . "\n";
    $pesan .= "👥 *Total Transaksi:* " . $totalWargaData . " data\n";
    $pesan .= "   • Scan QR: " . $totalQrCount . " rumah\n";
    $pesan .= "   • Input Manual: " . $totalManualCount . " rumah\n";
    $pesan .= "   • Pelunasan Tagihan: " . $jumlahPelunasan . " transaksi\n\n";

    // Rincian Fisik Jimpitan Ronda
    $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "📦 *HASIL RONDA FISIK (LAPANGAN)*\n";
    $pesan .= "• Total Uang Fisik: *Rp " . number_format($totalFisikNominal, 0, ',', '.') . "*\n";
    $pesan .= "• Kotak Terisi: *" . $totalTerisi . "* dari " . $totalKk . " KK\n";
    $pesan .= "• Kotak Kosong: *" . $totalKosong . "* KK\n\n";

    // Daftar Jimpitan yang Kosong
    $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "📋 *Jimpitan yang Kosong:*\n\n";

    if ($totalKosong > 0) {
        $no = 1;
        foreach ($dataKosong as $user) {
            $code_id = escapeMarkdown($user['code_id']);
            $kk_name = escapeMarkdown($user['kk_name']);
            $pesan .= $no . ". *" . $code_id . "* - " . $kk_name . "\n";
            $no++;
        }
    } else {
        $pesan .= "✅ *Alhamdulillah, seluruh kotak jimpitan terisi (100%).*\n";
    }

    // Data Petugas Jimpitan Ronda
    $pesan .= "\n━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "👤 *Petugas Jimpitan (Ronda):*\n\n";

    if ($dataPetugas && count($dataPetugas) > 0) {
        $no_petugas = 1;
        foreach ($dataPetugas as $petugas) {
            $nama_u      = escapeMarkdown($petugas['nama_petugas']);
            $total_scan  = (int)$petugas['total_scan'];
            $qr_scan     = (int)$petugas['qr_count'];
            $manual_scan = (int)$petugas['manual_count'];

            $rincian = [];
            if ($qr_scan > 0)     $rincian[] = "$qr_scan QR";
            if ($manual_scan > 0) $rincian[] = "$manual_scan Manual";
            $rincianStr = !empty($rincian) ? " (" . implode(', ', $rincian) . ")" : "";

            $pesan .= $no_petugas . ". *" . $nama_u . "*\n";
            $pesan .= "   ➤ Scan: " . $total_scan . " rumah" . $rincianStr . "\n";
            $no_petugas++;
        }
    } else {
        $pesan .= "👤 Tidak ada data petugas ronda tercatat.\n";
    }

    // Data Pelunasan Tagihan (Jimpitan) - Dipisahkan secara eksplisit
    $pesan .= "\n━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "💳 *Pelunasan Tagihan Jimpitan:*\n";
    if ($jumlahPelunasan > 0) {
        $pesan .= "Total Pelunasan: *Rp " . number_format($totalTagihanNominal, 0, ',', '.') . "* (" . $jumlahPelunasan . " KK)\n\n";
        $no_tagihan = 1;
        foreach ($dataTagihan as $tagihan) {
            $nama_kk   = escapeMarkdown($tagihan['nama_kk']);
            $nominal_t = number_format((int)$tagihan['amount'], 0, ',', '.');
            $pencatat  = escapeMarkdown($tagihan['dicatat_oleh']);
            $pesan .= $no_tagihan . ". *" . $nama_kk . "* - Rp " . $nominal_t . "\n";
            $pesan .= "   (Dicatat oleh: " . $pencatat . ")\n";
            $no_tagihan++;
        }
    } else {
        $pesan .= "• Tidak ada transaksi pelunasan tagihan pada tanggal ini.\n";
    }

    // Rekapitulasi Kas Masuk
    $pesan .= "\n━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "📈 *Rekapitulasi Kas Masuk:*\n";
    $pesan .= "• Jimpitan Fisik Ronda : Rp " . number_format($totalFisikNominal, 0, ',', '.') . "\n";
    $pesan .= "• Pelunasan Tagihan    : Rp " . number_format($totalTagihanNominal, 0, ',', '.') . "\n";
    $pesan .= "────────────────────\n";
    $pesan .= "💰 *Total Kas Terkumpul : Rp " . number_format($grandTotalKas, 0, ',', '.') . "*\n";

    // Footer info aplikasi & kontak
    $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "ℹ️ *Info Aplikasi:*\n";
    $pesan .= "📲 *Link Download (Play Store):*\n";
    $pesan .= "https://play.google.com/store/apps/details?id=jimpitan.appsbee.my.id\n\n";
    $pesan .= "👤 Silahkan login menggunakan akun Gmail masing-masing\n";
    $pesan .= "━━━━━━━━━━━━━━━━━━━━\n";
    $pesan .= "🌟 *Terima kasih atas partisipasi seluruh warga & petugas.*\n";
    $pesan .= "📞 Info lebih lanjut hubungi *Pengurus RT*\n\n";
    $pesan .= "_Pesan Otomatis dari System_";

} catch (PDOException $e) {
    $pesan = "❌ *Error*\n\n";
    $pesan .= "Terjadi kesalahan saat mengambil data jimpitan.\n";
    $pesan .= "Silakan coba lagi nanti.\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_jimpitan.php: " . $e->getMessage());
} catch (Exception $e) {
    $pesan = "❌ *Error*\n\n";
    $pesan .= "Terjadi kesalahan pada sistem.\n";
    $pesan .= "Silakan coba lagi nanti.\n\n";
    $pesan .= "_- Pesan Otomatis dari System -_";
    error_log("Error in ambil_data_jimpitan.php: " . $e->getMessage());
}

// Cek apakah di-include atau diakses langsung
$included_files = get_included_files();
$isIncluded = (realpath($included_files[0]) !== realpath(__FILE__));

if ($isIncluded) {
    // Jika di-include, jangan echo langsung, biarkan variabel $pesan tersedia
    ob_end_clean();
} else {
    // Jika diakses langsung via HTTP / CLI, output pesan
    ob_end_clean();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo $pesan;
    exit;
}
