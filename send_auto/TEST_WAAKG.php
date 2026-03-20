<?php
/**
 * TEST_WAAKG.php
 * Script ini khusus untuk mencari penyebab error 403 Forbidden.
 * Hanya dijalankan sementara dan akan dihapus setelah test selesai.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// INFORMASI TEST
$waAkgApiKey  = 'wag_OAbXNpfK7bI7xAtX217HWc8zdOKeJAiP';
$waAkgSession = 'cmmvhv1c10bg73qrxhbvdq6wc'; // Ganti dari 'Jimpitan' ke ID aslinya!
$personalJid  = '6285225106200@s.whatsapp.net';
$groupJid     = '120363398680818900@g.us';

// 1. CEK SESSION LIST (LISTING ALL SESSIONS)
echo "--- [1] Cek Daftar Session ---\n";
$chList = curl_init("https://wa-akg.aikeigroup.net/api/sessions");
curl_setopt($chList, CURLOPT_HTTPHEADER, ['X-API-Key: ' . $waAkgApiKey]);
curl_setopt($chList, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chList, CURLOPT_SSL_VERIFYPEER, false);
$resList = curl_exec($chList);
echo "Sessions List Response: " . $resList . "\n\n";
curl_close($chList);

// 2. CEK DETAIL SESSION (SPECIFIC SESSION)
echo "--- [2] Cek Detail Session '$waAkgSession' ---\n";
$chDetail = curl_init("https://wa-akg.aikeigroup.net/api/sessions/" . $waAkgSession);
curl_setopt($chDetail, CURLOPT_HTTPHEADER, ['X-API-Key: ' . $waAkgApiKey]);
curl_setopt($chDetail, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chDetail, CURLOPT_SSL_VERIFYPEER, false);
$resDetail = curl_exec($chDetail);
echo "Session Detail Response: " . $resDetail . "\n\n";
curl_close($chDetail);

// 3. TEST KIRIM KE NOMOR PRIBADI
echo "--- [3] Test Kirim ke Nomor Pribadi ($personalJid) ---\n";
$urlSendPribadi = "https://wa-akg.aikeigroup.net/api/messages/$waAkgSession/" . urlencode($personalJid) . "/send";
$dataPribadi = [
    'message' => ['text' => "Halo! Ini adalah pesan test dari skrip debugging WA-AKG Anda."]
];
$chPribadi = curl_init($urlSendPribadi);
curl_setopt($chPribadi, CURLOPT_POST, true);
curl_setopt($chPribadi, CURLOPT_POSTFIELDS, json_encode($dataPribadi));
curl_setopt($chPribadi, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chPribadi, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($chPribadi, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-API-Key: ' . $waAkgApiKey
]);
$resPribadi = curl_exec($chPribadi);
$codePribadi = curl_getinfo($chPribadi, CURLINFO_HTTP_CODE);
echo "Pribadi HTTP Code: $codePribadi\n";
echo "Pribadi Response: " . $resPribadi . "\n\n";
curl_close($chPribadi);

// 4. TEST KIRIM KE GRUP
echo "--- [4] Test Kirim ke Grup ($groupJid) ---\n";
$urlSendGrup = "https://wa-akg.aikeigroup.net/api/messages/$waAkgSession/" . urlencode($groupJid) . "/send";
$dataGrup = [
    'message' => ['text' => "Halo Grup! Ini adalah pesan test debugging untuk integrasi WA-AKG."]
];
$chGrup = curl_init($urlSendGrup);
curl_setopt($chGrup, CURLOPT_POST, true);
curl_setopt($chGrup, CURLOPT_POSTFIELDS, json_encode($dataGrup));
curl_setopt($chGrup, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chGrup, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($chGrup, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-API-Key: ' . $waAkgApiKey
]);
$resGrup = curl_exec($chGrup);
$codeGrup = curl_getinfo($chGrup, CURLINFO_HTTP_CODE);
echo "Grup HTTP Code: $codeGrup\n";
echo "Grup Response: " . $resGrup . "\n\n";
curl_close($chGrup);

echo "--- DEBUG SELESAI ---\n";
?>
