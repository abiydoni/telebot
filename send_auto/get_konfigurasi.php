<?php
include 'db.php';

function get_konfigurasi($nama) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT value FROM tb_konfigurasi WHERE nama = :nama LIMIT 1");
    $stmt->execute([':nama' => $nama]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? $row['value'] : null;
}
?>
