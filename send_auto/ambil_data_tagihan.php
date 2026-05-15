<?php
require_once __DIR__ . '/db.php';
date_default_timezone_set('Asia/Jakarta');

$lastMonth = new DateTime('first day of last month');
$prevMonth = $lastMonth->format('Y-m');
$namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
$bulanTeks = $namaBulan[(int)$lastMonth->format('n') - 1] . ' ' . $lastMonth->format('Y');
$daysInMonth = (int) $lastMonth->format('t');

$message = '';
try {
    global $pdo;
    
    if (!$pdo) {
        throw new Exception("Koneksi database tidak tersedia.");
    }
    
    // 1. Dapatkan tarif
    $stmt = $pdo->prepare("SELECT tarif FROM tb_tarif WHERE kode_tarif = 'TR001' LIMIT 1");
    $stmt->execute();
    $tarifRow = $stmt->fetch();
    $tarif = $tarifRow ? (int)$tarifRow['tarif'] : 500;
    
    // Total tagihan seharusnya selama sebulan
    $totalTagihanSeharusnya = $tarif * $daysInMonth;

    // 2. Ambil semua data master_kk
    $stmtKK = $pdo->prepare("SELECT code_id, kk_name FROM master_kk ORDER BY kk_name ASC");
    $stmtKK->execute();
    $wargaList = $stmtKK->fetchAll();

    $semuaWarga = [];
    $adaTunggakan = false;

    foreach ($wargaList as $warga) {
        $codeId = $warga['code_id'];
        $namaWarga = $warga['kk_name'];

        // 3. Hitung jumlah yang sudah discan (Hanya yang status = 1 / valid)
        $stmtScan = $pdo->prepare("SELECT SUM(nominal) as total_scanned, COUNT(id) as scan_count FROM report WHERE report_id = :code_id AND jimpitan_date LIKE :prev_month AND status = 1 AND (alasan != 'Tagihan Bulan Sebelumnya' OR alasan IS NULL)");
        $stmtScan->execute([
            ':code_id' => $codeId,
            ':prev_month' => $prevMonth . '-%'
        ]);
        $scanRow = $stmtScan->fetch();
        $totalScanned = $scanRow['total_scanned'] ? (int)$scanRow['total_scanned'] : 0;
        $scanCount = $scanRow['scan_count'] ? (int)$scanRow['scan_count'] : 0;

        // 4. Hitung sisa tagihan
        $sisaTagihan = $totalTagihanSeharusnya - $totalScanned;

        $semuaWarga[] = [
            'nama' => $namaWarga,
            'sisa_tagihan' => $sisaTagihan,
            'scan_count' => $scanCount
        ];

        if ($sisaTagihan > 0) {
            $adaTunggakan = true;
        }
    }

    if (count($semuaWarga) > 0) {
        $message = "📢 *INFORMASI TAGIHAN JIMPITAN*\n";
        $message .= "━━━━━━━━━━━━━━━━━━━━\n\n";
        $message .= "🗓 Bulan: *$bulanTeks*\n";
        $message .= "ℹ️ Info Tagihan: $daysInMonth hari x Rp $tarif = Rp " . number_format($totalTagihanSeharusnya, 0, ',', '.') . "\n\n";
        $message .= "📋 Berikut adalah rekapitulasi tagihan jimpitan warga:\n\n";
        
        $message .= "```\n";
        $no = 1;
        foreach ($semuaWarga as $w) {
            // Nomor (3 karakter)
            $colNo = str_pad($no . ".", 3, " ", STR_PAD_RIGHT);
            
            // Nama dibatasi 18 karakter
            $namaPendek = mb_substr($w['nama'], 0, 18);
            $colNama = $namaPendek . str_repeat(" ", 18 - mb_strlen($namaPendek));
            
            if ($w['sisa_tagihan'] > 0) {
                $nominalStr = number_format($w['sisa_tagihan'], 0, ',', '.');
                $colNominal = str_pad($nominalStr, 6, " ", STR_PAD_LEFT);
                $message .= $colNo . " " . $colNama . " Rp" . $colNominal . "\n";
            } else {
                $message .= $colNo . " " . $colNama . "   LUNAS\n";
            }
            $no++;
        }
        $message .= "```\n";
        
        $message .= "\n━━━━━━━━━━━━━━━━━━━━\n";
        if ($adaTunggakan) {
            $message .= "💡 _Mohon untuk segera melunasi sisa tagihan tersebut. Abaikan pesan ini jika merasa sudah membayar lunas. Terima kasih._\n\n";
        } else {
            $message .= "✨ _Alhamdulillah, seluruh tagihan warga bulan $bulanTeks telah lunas. Terima kasih atas partisipasi aktif seluruh warga RT 07!_ ✨\n\n";
        }
        $message .= "🙏🏻 *- Pengurus RT 07 -*";
    } else {
        $message = "🎉 *INFORMASI JIMPITAN*\n";
        $message .= "━━━━━━━━━━━━━━━━━━━━\n\n";
        $message .= "🗓 Bulan: *$bulanTeks*\n\n";
        $message .= "Belum ada data warga di sistem.\n\n";
        $message .= "━━━━━━━━━━━━━━━━━━━━\n";
        $message .= "🙏🏻 *- Pengurus RT 07 -*";
    }

} catch (Exception $e) {
    die("ERROR Database: " . $e->getMessage() . "\n");
}

// Tampilkan pesan jika file ini diakses langsung dari browser
if (basename($_SERVER['PHP_SELF']) === 'ambil_data_tagihan.php') {
    echo "<pre>" . htmlspecialchars($message) . "</pre>";
}
?>
