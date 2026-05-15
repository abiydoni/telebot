<?php
require_once __DIR__ . '/db.php';

echo "<h1>Debug Supardjo</h1>";

$stmt = $pdo->prepare("SELECT * FROM master_kk WHERE kk_name LIKE '%Supardjo%'");
$stmt->execute();
$warga = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($warga as $w) {
    echo "<h3>Warga: " . htmlspecialchars($w['kk_name']) . " (Code ID: " . htmlspecialchars($w['code_id']) . ")</h3>";
    
    // Check all scans for this user in April regardless of status/alasan
    $stmtScan = $pdo->prepare("SELECT * FROM report WHERE report_id = :code_id AND jimpitan_date LIKE '2026-04-%'");
    $stmtScan->execute([':code_id' => $w['code_id']]);
    $scans = $stmtScan->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Total Data di Tabel Report untuk April: <strong>" . count($scans) . "</strong> baris<br><br>";
    
    if (count($scans) > 0) {
        echo "<table border='1' cellpadding='5' style='border-collapse: collapse;'>";
        echo "<tr><th>ID Report</th><th>Tanggal</th><th>Nominal</th><th>Status</th><th>Alasan</th><th>Collector</th></tr>";
        $sum = 0;
        foreach ($scans as $s) {
            echo "<tr>";
            echo "<td>" . $s['id'] . "</td>";
            echo "<td>" . $s['jimpitan_date'] . "</td>";
            echo "<td>Rp " . $s['nominal'] . "</td>";
            echo "<td>" . $s['status'] . "</td>";
            echo "<td>" . htmlspecialchars($s['alasan'] ?? 'NULL') . "</td>";
            echo "<td>" . htmlspecialchars($s['collector']) . "</td>";
            echo "</tr>";
            $sum += (int)$s['nominal'];
        }
        echo "<tr><td colspan='2'><strong>TOTAL KESELURUHAN (tanpa filter):</strong></td><td colspan='4'><strong>Rp " . $sum . "</strong></td></tr>";
        echo "</table>";
    } else {
        echo "<em>Tidak ada data sama sekali di bulan April.</em><br>";
    }
}
?>
