<?php
/**
 * Helper: Ambil Konfigurasi dari Tabel system_settings (Database appsbeem_jimpitan_admin)
 */
require_once __DIR__ . '/db.php';

/**
 * Mengambil satu nilai konfigurasi berdasarkan key
 * 
 * @param string $key      Nama key setting
 * @param mixed  $default  Nilai default jika setting belum ada di database
 * @return mixed
 */
function get_konfigurasi($key, $default = null) {
    global $pdo;
    if (!isset($pdo) || !$pdo) {
        return $default;
    }

    try {
        $stmt = $pdo->prepare("SELECT value FROM system_settings WHERE `key` = :key LIMIT 1");
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['value'] !== null && $row['value'] !== '') {
            return $row['value'];
        }
    } catch (Throwable $e) {
        error_log("Gagal membaca konfigurasi {$key}: " . $e->getMessage());
    }

    return $default;
}

/**
 * Mengambil seluruh parameter integrasi WhatsApp Group sekaligus
 * 
 * @return array
 */
function get_wa_group_settings() {
    $rawEnabled = get_konfigurasi('WA_GROUP_NOTIFICATION_ENABLED', '1');
    $isEnabled = ($rawEnabled === '1' || $rawEnabled === 'true' || $rawEnabled === 1 || $rawEnabled === true);

    return [
        'targetNumber'  => get_konfigurasi('WA_GROUP_TARGET_NUMBER', '6285729705810-1505093181@g.us'),
        'appsbeeUrl'    => get_konfigurasi('WA_API_URL', 'https://wa-ab.appsbee.my.id/api/send-message'),
        'appsbeeApiKey' => get_konfigurasi('WA_API_KEY', 'wa-69aa3dbf930020c93f34b83add6374e8'),
        'sessionId'     => get_konfigurasi('WA_SESSION_ID', get_konfigurasi('WA_SENDER_NUMBER', 'appsbee')),
        'villageId'     => get_konfigurasi('WA_GROUP_VILLAGE_ID', 'village_001'),
        'isEnabled'     => $isEnabled,
    ];
}
?>
