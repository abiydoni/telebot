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

        // Trigger push notification FCM via endpoint /chat/system-send di jimpitan app
        // Endpoint ini akan membaca fcm_subscriptions dan mengirim push ke semua user
        $systemSendUrl = 'https://jimpitan.appsbee.my.id/chat/system-send';
        $systemKey     = 'jimpitan_secret_batch_2024';

        $notifData = [
            'key'         => $systemKey,
            'receiver_id' => 'GROUP_ALL',
            'message'     => mb_substr($message, 0, 200),
            'sender_id'   => 'SYSTEM',
            'sender_name' => $senderName,
        ];

        $chFcm = curl_init($systemSendUrl);
        curl_setopt($chFcm, CURLOPT_POST, true);
        curl_setopt($chFcm, CURLOPT_POSTFIELDS, http_build_query($notifData)); // Send as application/x-www-form-urlencoded
        curl_setopt($chFcm, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chFcm, CURLOPT_TIMEOUT, 15);
        curl_setopt($chFcm, CURLOPT_SSL_VERIFYPEER, false);

        $fcmResult   = curl_exec($chFcm);
        $fcmHttpCode = curl_getinfo($chFcm, CURLINFO_HTTP_CODE);
        curl_close($chFcm);

        if ($fcmHttpCode == 200) {
            $fcmResp = json_decode($fcmResult, true);
            if (isset($fcmResp['status']) && $fcmResp['status'] === 'success') {
                echo "✅ FCM Notifikasi: Berhasil dikirim!\n";
            } else {
                echo "⚠️  FCM Notifikasi: HTTP 200 tapi status tidak success. Response: " . substr($fcmResult, 0, 200) . "\n";
            }
        } else {
            echo "⚠️  FCM Notifikasi: Gagal (HTTP $fcmHttpCode). Pesan tetap tersimpan di chat.\n";
        }

        return true;

    } catch (Exception $e) {
        echo "❌ Chat Group Error: " . $e->getMessage() . "\n";
        return false;
    }
}
