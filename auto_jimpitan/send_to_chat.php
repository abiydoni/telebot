<?php
/**
 * Helper: Kirim pesan ke chat_messages dan trigger notifikasi FCM
 * 
 * Menyimpan pesan ke tabel chat_messages di database appsbeem_jimpitan_admin
 * dengan roomId GROUP_village_001 agar masuk ke Group Warga.
 * 
 * @param PDO    $pdo      Koneksi PDO (dari db.php)
 * @param string $message  Isi pesan yang akan dikirim
 * @param string $senderName Nama pengirim (default: Pengurus RT)
 * @return bool
 */
function sendToGroupChat($pdo, $message, $senderName = 'appsbee') {
    try {
        $msgId = 'msg_' . str_replace('-', '', sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        ));

        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO chat_messages 
                (id, senderUid, receiverUid, message, isRead, villageId, createdAt, updatedAt, roomId, senderName, isDeleted, isEdited)
            VALUES 
                (:id, 'SYSTEM', NULL, :message, 0, 'village_001', :createdAt, :updatedAt, 'GROUP_village_001', :senderName, 0, 0)
        ");

        $stmt->execute([
            ':id'         => $msgId,
            ':message'    => $message,
            ':createdAt'  => $now,
            ':updatedAt'  => $now,
            ':senderName' => $senderName,
        ]);

        echo "✅ Chat Group: Pesan berhasil disimpan ke chat_messages (ID: $msgId)\n";

        // Trigger push notification FCM secara langsung menggunakan service account json (Firebase V1 HTTP API)
        require_once __DIR__ . '/fcm_helper.php';
        sendFCMNotificationNew($pdo, $message, $senderName);

        return true;

    } catch (Exception $e) {
        echo "❌ Chat Group Error: " . $e->getMessage() . "\n";
        return false;
    }
}
