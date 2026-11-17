<?php
declare(strict_types=1);
/*
 * ALUPROF — webhook Telegram-бота @AluprofLeadsBot.
 * Когда бота отмечают в группе (или добавляют в неё), группа запоминается.
 * Если группа для заявок ещё не выбрана — подключается автоматически, бот отвечает «Активация успешна».
 * Telegram подписывает запросы заголовком X-Telegram-Bot-Api-Secret-Token.
 */
header('Content-Type: application/json; charset=utf-8');
$home = dirname(__DIR__);
$cfg = @include $home . '/aluprof-config.php';
$token = is_array($cfg) ? (string)($cfg['tg_token'] ?? '') : '';
if ($token === '' || $_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(404); exit; }
$secret = substr(hash('sha256', 'aluprof-hook|' . $token), 0, 48);
if (!hash_equals($secret, (string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? ''))) { http_response_code(403); exit; }

$u = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($u)) { echo '{}'; exit; }

$msg = $u['message'] ?? null;
$member = $u['my_chat_member'] ?? null;
$chat = $msg['chat'] ?? ($member['chat'] ?? null);
if (!$chat || !in_array($chat['type'] ?? '', ['group', 'supergroup'], true)) { echo '{}'; exit; }

// бот удалён из группы — ничего не делаем
if ($member && in_array($member['new_chat_member']['status'] ?? '', ['left', 'kicked'], true)) { echo '{}'; exit; }

// реагируем на добавление бота или на сообщение с упоминанием/командой
$text = (string)($msg['text'] ?? '');
$mentioned = $member !== null || stripos($text, '@AluprofLeadsBot') !== false;
if (!$mentioned) { echo '{}'; exit; }

$id = (string)$chat['id'];
$title = mb_substr((string)($chat['title'] ?? $id), 0, 100);

$file = $home . '/aluprof-settings.json';
$fp = fopen($file, 'c+');
if (!$fp) { echo '{}'; exit; }
flock($fp, LOCK_EX);
$s = json_decode((string)stream_get_contents($fp), true);
$s = is_array($s) ? $s : [];
$seen = is_array($s['tg_seen'] ?? null) ? $s['tg_seen'] : [];
$seen[$id] = ['title' => $title, 'type' => $chat['type'], 't' => time()];
$s['tg_seen'] = array_slice($seen, -10, null, true);

$current = (string)($s['lead_tg'] ?? (is_array($cfg) ? ($cfg['tg_chat'] ?? '') : ''));
if ($current === '' || $current === $id) {
    $s['lead_tg'] = $id;
    $s['lead_tg_title'] = $title;
    $reply = "✅ Активация успешна!\nЗаявки с сайта alu-prof.uz будут приходить в эту группу.";
} else {
    $reply = "Бот уже подключён к другой группе. Сменить группу можно в панели управления сайтом.";
}
ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);
@chmod($file, 0600);

// ответ прямо в ответе на webhook — исходящее соединение с сервера не нужно
echo json_encode(['method' => 'sendMessage', 'chat_id' => $chat['id'], 'text' => $reply], JSON_UNESCAPED_UNICODE);
