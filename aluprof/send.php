<?php
/*
 * ALUPROF — приём заявок с сайта.
 * Письмо уходит на info@alu-prof.uz, копия — в закрытую группу Telegram.
 *
 * Настройка на хостинге (Plesk):
 *   1. TG_TOKEN — токен бота от @BotFather.
 *   2. TG_CHAT  — ID группы отдела продаж (бота нужно добавить в группу).
 *   Если TG_TOKEN пустой, заявки приходят только на почту.
 */
const MAIL_TO   = 'info@alu-prof.uz';
const MAIL_FROM = 'noreply@alu-prof.uz';
const TG_TOKEN  = '';
const TG_CHAT   = '';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = $_POST;
$clean = function ($v, $max) { return mb_substr(trim(strip_tags((string)$v)), 0, $max); };
$name  = $clean($in['name'] ?? '', 100);
$phone = $clean($in['phone'] ?? '', 40);
$who   = $clean($in['who'] ?? '', 100);
$msg   = $clean($in['message'] ?? '', 2000);
$page  = $clean($_SERVER['HTTP_REFERER'] ?? '', 300);

if ($name === '' || strlen(preg_replace('/\D/', '', $phone)) < 9) {
    http_response_code(422); echo '{"ok":false,"error":"fields"}'; exit;
}

$lines = [
    'Новая заявка с сайта ALUPROF',
    'Имя: ' . $name,
    'Телефон: ' . $phone,
    'Кто: ' . $who,
    'Комментарий: ' . ($msg !== '' ? $msg : '—'),
    'Страница: ' . $page,
    'Время: ' . date('d.m.Y H:i'),
];
$text = implode("\n", $lines);

$subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . $name) . '?=';
$headers = "From: ALUPROF <" . MAIL_FROM . ">\r\nContent-Type: text/plain; charset=UTF-8\r\n";
$mailOk = @mail(MAIL_TO, $subject, $text, $headers, '-f' . MAIL_FROM);

$tgOk = null;
if (TG_TOKEN !== '' && TG_CHAT !== '') {
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => 8,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(['chat_id' => TG_CHAT, 'text' => $text]),
    ]]);
    $tgOk = @file_get_contents('https://api.telegram.org/bot' . TG_TOKEN . '/sendMessage', false, $ctx) !== false;
}

echo json_encode(['ok' => $mailOk || $tgOk, 'mail' => $mailOk, 'telegram' => $tgOk]);
