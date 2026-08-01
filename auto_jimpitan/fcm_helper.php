<?php

function getFCMAccessTokenNew() {
    $jsonFile = __DIR__ . '/serviceAccountKey.json';
    if (!file_exists($jsonFile)) {
        return null;
    }

    $jsonContent = file_get_contents($jsonFile);
    $config = json_decode($jsonContent, true);
    if (!$config) {
        return null;
    }

    $clientEmail = $config['client_email'] ?? null;
    $privateKey = $config['private_key'] ?? null;
    $tokenUri = $config['token_uri'] ?? 'https://oauth2.googleapis.com/token';

    if (!$clientEmail || !$privateKey) {
        return null;
    }

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    
    // Fetch time from Google to avoid local clock sync issues
    $chTime = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($chTime, CURLOPT_NOBODY, true);
    curl_setopt($chTime, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chTime, CURLOPT_HEADER, true);
    curl_setopt($chTime, CURLOPT_SSL_VERIFYPEER, false);
    $responseHeader = curl_exec($chTime);
    curl_close($chTime);

    $now = time();
    if (preg_match('/^Date:\s+(.*)$/mi', $responseHeader, $matches)) {
        $dateStr = trim($matches[1]);
        $now = strtotime($dateStr);
    }

    $payload = json_encode([
        'iss' => $clientEmail,
        'scope' => 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging',
        'aud' => $tokenUri,
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = '';
    if (!openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
        echo "SSL Error: " . openssl_error_string() . "\n";
        return null;
    }
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUri);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        echo "Curl Error HTTP $httpCode: $response\n";
        return null;
    }

    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

function sendFCMNotificationNew($pdo, $messageText, $senderName, $villageId = 'village_001', $roomId = 'GROUP_village_001') {
    try {
        $accessToken = getFCMAccessTokenNew();
        if (!$accessToken) {
            echo "⚠️  FCM Notifikasi: Gagal mendapatkan Access Token dari serviceAccountKey.json\n";
            return false;
        }

        // Get all fcm tokens for the village
        $stmt = $pdo->prepare("SELECT fcmToken FROM users WHERE fcmToken IS NOT NULL AND fcmToken != '' AND villageId = :villageId AND status = 'ACTIVE'");
        $stmt->execute([':villageId' => $villageId]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($users)) {
            echo "⚠️  FCM Notifikasi: Tidak ada user dengan fcmToken yang aktif.\n";
            return false;
        }

        $fcmUrl = 'https://fcm.googleapis.com/v1/projects/jimpitan-26fda/messages:send';
        $successCount = 0;

        $bodyText = mb_strlen($messageText) > 100 ? mb_substr($messageText, 0, 97) . '...' : $messageText;

        foreach ($users as $user) {
            $token = $user['fcmToken'];

            $payload = [
                'message' => [
                    'token' => $token,
                    'notification' => [
                        'title' => $senderName,
                        'body' => $bodyText,
                    ],
                    'data' => [
                        'action' => 'OPEN_CHAT',
                        'senderUid' => 'SYSTEM',
                        'sender_uid' => 'SYSTEM',
                        'senderName' => $senderName,
                        'sender_name' => $senderName,
                        'uid' => 'SYSTEM',
                        'name' => $senderName,
                        'type' => 'chat',
                        'villageId' => $villageId,
                        'village_id' => $villageId,
                        'roomId' => $roomId,
                        'room_id' => $roomId,
                        'id' => $roomId,
                        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                    ],
                    'android' => [
                        'priority' => 'high',
                        'notification' => [
                            'channelId' => 'high_importance_channel',
                            'sound' => 'default',
                            'defaultVibrateTimings' => true
                        ]
                    ]
                ]
            ];

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $fcmUrl);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200) {
                $successCount++;
            } else {
                // Sembunyikan error panjang lebar, tampilkan ringkasannya saja atau sembunyikan sepenuhnya
                $respData = json_decode($response, true);
                $errMsg = $respData['error']['message'] ?? 'Unknown Error';
                // echo "⚠️  FCM Gagal untuk salah satu token (Mungkin token sudah kadaluarsa/tidak valid)\n";
            }
        }

        echo "✅ FCM Notifikasi: Berhasil dikirim ke $successCount perangkat!\n";
        return true;

    } catch (Exception $e) {
        echo "❌ FCM Notifikasi Error: " . $e->getMessage() . "\n";
        return false;
    }
}
