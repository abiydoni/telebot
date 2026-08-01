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
function sendToGroupChat($pdo, $message, $senderName = 'Pengurus RT') {
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

        // Tandai semua pesan group sebagai belum dibaca (isRead=0) sudah otomatis

        // Trigger push notification via FCM API (jika ada endpoint)
        // Endpoint API notifikasi dari appsbeem multi-village
        $fcmApiUrl = 'https://jimpitan.appsbee.my.id/api/v2/chat/notify-group';
        $fcmApiKey = 'jimpitan_secret_batch_2024';

        $chFcm = curl_init($fcmApiUrl);
        curl_setopt($chFcm, CURLOPT_POST, true);
        curl_setopt($chFcm, CURLOPT_POSTFIELDS, json_encode([
            'key'        => $fcmApiKey,
            'villageId'  => 'village_001',
            'roomId'     => 'GROUP_village_001',
            'message'    => mb_substr($message, 0, 150),
            'senderName' => $senderName,
        ]));
        curl_setopt($chFcm, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chFcm, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($chFcm, CURLOPT_TIMEOUT, 10);
        curl_setopt($chFcm, CURLOPT_SSL_VERIFYPEER, false);

        $fcmResult   = curl_exec($chFcm);
        $fcmHttpCode = curl_getinfo($chFcm, CURLINFO_HTTP_CODE);
        curl_close($chFcm);

        if ($fcmHttpCode == 200) {
            echo "✅ FCM Notifikasi: Berhasil dikirim!\n";
        } else {
            echo "⚠️  FCM Notifikasi: Gagal (HTTP $fcmHttpCode). Pesan tetap tersimpan di chat.\n";
        }

        return true;

    } catch (Exception $e) {
        echo "❌ Chat Group Error: " . $e->getMessage() . "\n";
        return false;
    }
}
