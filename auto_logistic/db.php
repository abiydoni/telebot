<?php

// Koneksi ke appsbeem_logistic (data barang + tb_konfigurasi + log WA)
$host = 'localhost';
$db   = 'appsbeem_logistic';
$user = 'appsbeem_admin';
$pass = 'A7by777__';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->query('SELECT 1');
} catch (PDOException $e) {
    error_log('auto_logistik db: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}
