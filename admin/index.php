<?php
declare(strict_types=1);
/*
 * ALUPROF — простая панель управления сайтом.
 * Меняет телефоны, почту, соцсети, каталог THERMO (PDF) и получателей заявок.
 *
 * Файлы вне папки сайта (рядом с httpdocs):
 *   aluprof-config.php      — tg_token, admin_user, admin_hash (bcrypt)
 *   aluprof-settings.json   — текущие значения (создаётся при первом сохранении)
 * Страницы сайта статические: при сохранении значения подставляются во все *.html.
 */

date_default_timezone_set('Asia/Tashkent');
define('SITE_DIR', dirname(__DIR__));
define('HOME_DIR', dirname(__DIR__, 2));
define('CFG_FILE', HOME_DIR . '/aluprof-config.php');
define('SET_FILE', HOME_DIR . '/aluprof-settings.json');
const CAT_FILE = 'assets/docs/thermo-catalog.pdf';
const MAX_PDF_MB = 40;
const IDLE_SEC = 7200;

// значения, с которыми собран сайт
const DEFAULTS = [
    'phone1' => '+998 77 420-49-94',
    'phone2' => '+998 77 420-49-95',
    'email' => 'info@alu-prof.uz',
    'telegram' => 'aluprof_uz',
    'instagram' => 'aluprofuz',
    'cat_mb' => '7.4',
    'cat_v' => '',
    'lead_email' => 'info@alu-prof.uz',
    'lead_tg' => '',
    'lead_tg_title' => '',
    'tg_seen' => [],
    'addr_ru' => 'Ташкентская область, Зангиатинский район, ул. Магистральная, 40',
    'addr_uz' => 'Toshkent viloyati, Zangiota tumani, Magistral koʻchasi, 40',
    'addr_en' => '40 Magistralnaya St., Zangiata District, Tashkent Region',
    'h1_ru' => 'Пн–Пт 9:00–17:00', 'h1_uz' => 'Du–Ju 9:00–17:00', 'h1_en' => 'Mon–Fri 9:00–17:00',
    'h2_ru' => 'Сб 9:00–14:00', 'h2_uz' => 'Sha 9:00–14:00', 'h2_en' => 'Sat 9:00–14:00',
];
const SITE_KEYS = ['phone1', 'phone2', 'email', 'telegram', 'instagram', 'cat_mb'];
const LANGS = ['ru' => 'Русский', 'uz' => 'Oʻzbekcha', 'en' => 'English'];

/* ---------- заголовки и сессия ---------- */
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");

session_name('aluprof_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();
if (!empty($_SESSION['auth']) && time() - ($_SESSION['seen'] ?? 0) > IDLE_SEC) {
    $_SESSION = [];
    session_regenerate_id(true);
}
$_SESSION['seen'] = time();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));

/* ---------- данные ---------- */
function cfg(): array {
    static $c = null;
    if ($c === null) { $r = is_file(CFG_FILE) ? @include CFG_FILE : null; $c = is_array($r) ? $r : []; }
    return $c;
}
function settings(): array {
    $s = is_file(SET_FILE) ? json_decode((string)file_get_contents(SET_FILE), true) : null;
    $s = is_array($s) ? $s : [];
    if (!isset($s['lead_tg']) && !empty(cfg()['tg_chat'])) $s['lead_tg'] = (string)cfg()['tg_chat'];
    return array_merge(DEFAULTS, array_intersect_key($s, DEFAULTS));
}
function write_atomic(string $file, string $data, int $mode = 0644): bool {
    $tmp = $file . '.tmp' . bin2hex(random_bytes(3));
    if (@file_put_contents($tmp, $data, LOCK_EX) === false) return false;
    @chmod($tmp, $mode);
    if (!@rename($tmp, $file)) { @unlink($tmp); return false; }
    return true;
}
function save_settings(array $s): bool {
    return write_atomic(SET_FILE, json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), 0600);
}

/* ---------- подстановка на страницах ---------- */
function digits(string $p): string { return preg_replace('/\D/', '', $p); }
function mb_fmt(string $mb, string $lang): string {
    $n = number_format((float)$mb, 1, $lang === 'en' ? '.' : ',', '');
    return 'PDF, ' . $n . ($lang === 'ru' ? ' МБ' : ' MB');
}
// все формы, в которых значение встречается в HTML (позиции старой и новой формы совпадают)
function forms(string $key, string $v): array {
    switch ($key) {
        case 'phone1': case 'phone2':
            $d = digits($v);
            return ['tel:+' . $d, '"+' . $d . '"', $v];
        case 'email': return [$v];
        case 'telegram': return ['https://t.me/' . $v, '@' . $v];
        case 'instagram': return ['https://www.instagram.com/' . $v];
        case 'cat_mb': return [mb_fmt($v, 'ru'), mb_fmt($v, 'uz'), mb_fmt($v, 'en')];
    }
    return [];
}
function html_files(): array {
    $f = array_merge(glob(SITE_DIR . '/*.html') ?: [], glob(SITE_DIR . '/uz/*.html') ?: [], glob(SITE_DIR . '/en/*.html') ?: []);
    return array_values(array_filter($f, 'is_file'));
}
/** Переписывает страницы: значения из $from_list заменяются на $to. Возвращает число изменённых файлов или -1 при ошибке. */
function apply_site(array $from_list, array $to): int {
    $map = [];
    foreach ($from_list as $from) {
        foreach (SITE_KEYS as $k) {
            if ((string)$from[$k] === '' || (string)$from[$k] === (string)$to[$k]) continue;
            $o = forms($k, (string)$from[$k]); $n = forms($k, (string)$to[$k]);
            foreach ($o as $i => $old) if ($old !== '' && !isset($map[$old])) $map[$old] = $n[$i];
        }
    }
    $changed = 0;
    foreach (html_files() as $file) {
        $html = (string)file_get_contents($file);
        $out = $map ? strtr($html, $map) : $html;
        if ($to['cat_v'] !== '') {
            $out = preg_replace('~(assets/docs/thermo-catalog\.pdf)(\?v=\d+)?~', '$1?v=' . $to['cat_v'], $out);
        }
        // адрес и график: размеченные места <span data-s="…"> на языке страницы
        $dir = basename(dirname($file));
        $lang = ($dir === 'uz' || $dir === 'en') ? $dir : 'ru';
        $esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
        $h1 = $esc($to['h1_' . $lang]); $h2 = $esc($to['h2_' . $lang]);
        $out = preg_replace_callback('~<span data-s="(addr|hours)"( data-sep="br")?>.*?</span>~s', function ($m) use ($to, $lang, $esc, $h1, $h2) {
            if ($m[1] === 'addr') $v = $esc($to['addr_' . $lang]);
            else $v = $h2 === '' ? $h1 : $h1 . (($m[2] ?? '') !== '' ? '<br>' : ', ') . $h2;
            return '<span data-s="' . $m[1] . '"' . ($m[2] ?? '') . '>' . $v . '</span>';
        }, $out);
        $out = preg_replace_callback('~("streetAddress": )"[^"]*"~', fn($m) => $m[1] . json_encode((string)$to['addr_ru'], JSON_UNESCAPED_UNICODE), $out);
        if ($out !== $html) {
            if (!write_atomic($file, $out, fileperms($file) & 0777)) return -1;
            $changed++;
        }
    }
    return $changed;
}
// после обновления сайта страницы снова содержат исходные значения — возвращаем сохранённые
function sync_site(): void {
    apply_site([DEFAULTS], settings());
}

/* ---------- проверка ввода ---------- */
function norm_phone(string $v): ?string {
    $v = trim(preg_replace('/\s+/', ' ', $v));
    $d = digits($v);
    if (strlen($d) < 9 || strlen($d) > 15 || !preg_match('/^[+\d\s()\-]+$/', $v)) return null;
    if ($v[0] !== '+') $v = '+' . $v;
    return mb_substr($v, 0, 30);
}
function norm_handle(string $v): ?string {
    $v = trim($v);
    $v = preg_replace('~^(https?://)?(www\.)?(t\.me|telegram\.me|instagram\.com)/~i', '', $v);
    $v = preg_replace('~[/?#].*$~', '', ltrim($v, '@'));
    return preg_match('/^[A-Za-z0-9_.]{3,40}$/', $v) ? $v : null;
}
function norm_email(string $v): ?string {
    $v = trim($v);
    return (strlen($v) <= 100 && filter_var($v, FILTER_VALIDATE_EMAIL)) ? $v : null;
}

/* ---------- Telegram ---------- */
function tg(string $method, array $params = []): ?array {
    $token = (string)(cfg()['tg_token'] ?? '');
    if ($token === '') return null;
    $url = 'https://api.telegram.org/bot' . $token . '/' . $method;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($params),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        $r = curl_exec($ch);
        curl_close($ch);
    } else {
        $r = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'timeout' => 10,
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => http_build_query($params)]]));
    }
    $j = is_string($r) ? json_decode($r, true) : null;
    return is_array($j) ? $j : null;
}

/* ---------- вход ---------- */

function flash(string $type, string $msg): void { $_SESSION['flash'][] = [$type, $msg]; }
function back(string $anchor = ''): void { header('Location: ./' . $anchor, true, 303); exit; }
function h($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

/* ---------- действия ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) { flash('err', 'Сессия устарела, попробуйте ещё раз.'); back(); }
    $a = (string)($_POST['a'] ?? '');

    if ($a === 'login') {
        $user = (string)(cfg()['admin_user'] ?? ''); $hash = (string)(cfg()['admin_hash'] ?? '');
        $ok = $hash !== '' && hash_equals($user, trim((string)($_POST['user'] ?? '')))
            && password_verify((string)($_POST['pass'] ?? ''), $hash);
        if (!$ok) { usleep(400000); flash('err', 'Неверный логин или пароль.'); back(); }
        session_regenerate_id(true);
        $_SESSION['auth'] = true;
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        back();
    }
    if (empty($_SESSION['auth'])) back();

    if ($a === 'logout') { $_SESSION = []; session_destroy(); back(); }

    $s = settings();
    if ($a === 'save') {
        $new = $s; $errs = [];
        foreach (['phone1' => 'Основной телефон', 'phone2' => 'Второй телефон'] as $k => $label) {
            $v = norm_phone((string)($_POST[$k] ?? '')); if ($v === null) $errs[] = "$label: проверьте номер."; else $new[$k] = $v;
        }
        if ($new['phone1'] === $new['phone2']) $errs[] = 'Телефоны должны отличаться.';
        $v = norm_email((string)($_POST['email'] ?? '')); if ($v === null) $errs[] = 'Email на сайте: проверьте адрес.'; else $new['email'] = $v;
        $v = norm_handle((string)($_POST['telegram'] ?? '')); if ($v === null) $errs[] = 'Telegram: укажите ссылку или @имя.'; else $new['telegram'] = $v;
        $v = norm_handle((string)($_POST['instagram'] ?? '')); if ($v === null) $errs[] = 'Instagram: укажите ссылку или имя.'; else $new['instagram'] = $v;
        $v = norm_email((string)($_POST['lead_email'] ?? '')); if ($v === null) $errs[] = 'Почта для заявок: проверьте адрес.'; else $new['lead_email'] = $v;
        foreach (LANGS as $l => $lname) {
            foreach (['addr' => 'Адрес', 'h1' => 'График (первая строка)', 'h2' => 'График (вторая строка)'] as $f => $label) {
                $v = trim(preg_replace('/\s+/u', ' ', strip_tags((string)($_POST[$f . '_' . $l] ?? ''))));
                if ($v === '' && $f !== 'h2') { $errs[] = "$label ($lname): заполните поле."; continue; }
                if (mb_strlen($v) > 150) { $errs[] = "$label ($lname): слишком длинно."; continue; }
                $new[$f . '_' . $l] = $v;
            }
        }
        if ($errs) { foreach ($errs as $e) flash('err', $e); $_SESSION['form'] = $_POST; back(); }
        if ($new === $s) { flash('ok', 'Изменений нет.'); back(); }
        $r = apply_site([DEFAULTS, $s], $new);
        if ($r < 0 || !save_settings($new)) { flash('err', 'Не удалось записать файлы на хостинге.'); back(); }
        flash('ok', 'Сохранено. Сайт обновлён.');
        back();
    }

    if ($a === 'catalog') {
        $f = $_FILES['pdf'] ?? null;
        $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) { flash('err', 'Файл слишком большой для хостинга.'); back('#catalog'); }
        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) { flash('err', 'Выберите PDF-файл.'); back('#catalog'); }
        if ($f['size'] > MAX_PDF_MB * 1048576) { flash('err', 'Файл больше ' . MAX_PDF_MB . ' МБ.'); back('#catalog'); }
        $head = (string)file_get_contents($f['tmp_name'], false, null, 0, 5);
        if ($head !== '%PDF-') { flash('err', 'Это не PDF-файл.'); back('#catalog'); }
        $dst = SITE_DIR . '/' . CAT_FILE; $tmp = $dst . '.upload';
        if (!move_uploaded_file($f['tmp_name'], $tmp)) { flash('err', 'Не удалось сохранить файл.'); back('#catalog'); }
        @chmod($tmp, 0644);
        if (!rename($tmp, $dst)) { @unlink($tmp); flash('err', 'Не удалось заменить каталог.'); back('#catalog'); }
        $new = $s;
        $new['cat_mb'] = number_format(max(0.1, $f['size'] / 1048576), 1, '.', '');
        $new['cat_v'] = (string)time();
        apply_site([DEFAULTS, $s], $new);
        save_settings($new);
        flash('ok', 'Каталог обновлён: ' . str_replace('PDF, ', '', mb_fmt($new['cat_mb'], 'ru')) . '.');
        back('#catalog');
    }

    if ($a === 'tgfind') {
        // группы, где бота отметили (их запоминает webhook /tg-hook.php)
        $chats = [];
        foreach ((array)$s['tg_seen'] as $id => $c) $chats[(string)$id] = ['title' => (string)($c['title'] ?? $id), 'type' => (string)($c['type'] ?? 'group')];
        $_SESSION['tg_found'] = $chats;
        if (!$chats) flash('err', 'Бот пока не видит ни одной группы. Напишите в группе «@AluprofLeadsBot тест» — с отметкой бота.');
        back('#leads');
    }
    if ($a === 'tgpick') {
        $id = (string)($_POST['chat'] ?? ''); $found = $_SESSION['tg_found'] ?? [];
        if (!isset($found[$id])) { flash('err', 'Выберите группу из списка.'); back('#leads'); }
        $new = $s; $new['lead_tg'] = $id; $new['lead_tg_title'] = $found[$id]['title'];
        save_settings($new); unset($_SESSION['tg_found']);
        flash('ok', 'Заявки будут приходить в «' . $found[$id]['title'] . '». Отправьте тест, чтобы проверить.');
        back('#leads');
    }
    if ($a === 'tgoff') {
        $new = $s; $new['lead_tg'] = ''; $new['lead_tg_title'] = '';
        save_settings($new); flash('ok', 'Telegram отключён, заявки приходят только на почту.'); back('#leads');
    }
    if ($a === 'test') {
        $text = "Тестовая заявка из панели управления ALUPROF\nВремя: " . date('d.m.Y H:i');
        $subject = '=?UTF-8?B?' . base64_encode('Тест заявок с сайта ALUPROF') . '?=';
        $mail = @mail($s['lead_email'], $subject, $text, "From: ALUPROF <noreply@alu-prof.uz>\r\nContent-Type: text/plain; charset=UTF-8\r\n", '-fnoreply@alu-prof.uz');
        flash($mail ? 'ok' : 'err', $mail ? 'Письмо отправлено на ' . $s['lead_email'] . '. Проверьте почту и папку «Спам».' : 'Почта не отправилась.');
        if ($s['lead_tg'] !== '') {
            $r = tg('sendMessage', ['chat_id' => $s['lead_tg'], 'text' => $text]);
            flash(!empty($r['ok']) ? 'ok' : 'err', !empty($r['ok']) ? 'Сообщение отправлено в Telegram.' : 'Telegram: ' . ($r['description'] ?? 'нет ответа'));
        }
        back('#leads');
    }
    back();
}

/* ---------- страница ---------- */
$auth = !empty($_SESSION['auth']);
if ($auth) sync_site();
$s = settings();
$form = $_SESSION['form'] ?? null; unset($_SESSION['form']);
$val = fn($k) => h($form[$k] ?? $s[$k]);
$flash = $_SESSION['flash'] ?? []; unset($_SESSION['flash']);
$found = $_SESSION['tg_found'] ?? null;
$csrf = h($_SESSION['csrf']);
$cat_ok = is_file(SITE_DIR . '/' . CAT_FILE);
$cat_date = $cat_ok ? date('d.m.Y', filemtime(SITE_DIR . '/' . CAT_FILE)) : '';
$up_max = ini_get('upload_max_filesize');
$setup = empty(cfg()['admin_hash']);
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ALUPROF — управление сайтом</title>
<link rel="icon" href="../assets/img/favicon-32.png">
<style>
@font-face { font-family: "Inter"; src: url("../assets/fonts/Inter-Regular.woff") format("woff"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Inter"; src: url("../assets/fonts/Inter-Medium.woff") format("woff"); font-weight: 500; font-display: swap; }
@font-face { font-family: "Inter"; src: url("../assets/fonts/Inter-SemiBold.woff") format("woff"); font-weight: 600; font-display: swap; }
@font-face { font-family: "Inter Display"; src: url("../assets/fonts/InterDisplay-SemiBold.woff") format("woff"); font-weight: 600; font-display: swap; }
:root { --navy:#00293d; --navy-deep:#001a28; --mist:#e6ebee; --mist-2:#d6dde2; --steel:#6f808c; --ink:#0b2230; --ink-soft:#4b5f6c; --red:#fd0201; --ok:#0f7b4f; --line:rgba(0,41,61,.13); --cut:12px; }
* { box-sizing: border-box; margin: 0; }
[hidden] { display: none !important; }
body { font: 400 15px/1.5 "Inter", system-ui, sans-serif; color: var(--ink); background: var(--mist); -webkit-font-smoothing: antialiased; min-height: 100vh; }
a { color: inherit; }
h1, h2 { font-family: "Inter Display", "Inter", sans-serif; font-weight: 600; letter-spacing: -.02em; }
.cut { clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%); }
.para { display: inline-block; width: 14px; height: 8px; background: var(--red); transform: skewX(-24deg); margin-right: 10px; vertical-align: 1px; }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--steel); }

/* вход */
.login { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--navy-deep);
  background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 64px 64px; }
.login__box { width: 100%; max-width: 400px; }
.login__logo { display: block; height: 34px; margin: 0 auto 32px; }
.login .card { padding: 32px; }
.login h1 { font-size: 24px; margin: 8px 0 22px; }

/* шапка */
.top { background: var(--navy); color: #fff; }
.top__in { max-width: 920px; margin: 0 auto; padding: 18px 16px; display: flex; align-items: center; gap: 16px; }
.top__in img { height: 26px; display: block; }
.top__tag { font-size: 13px; color: rgba(205,218,228,.7); padding-left: 16px; border-left: 1px solid rgba(255,255,255,.15); }
.top__nav { margin-left: auto; display: flex; gap: 18px; align-items: center; font-size: 14px; }
.top__nav a, .top__nav button { color: rgba(255,255,255,.85); text-decoration: none; background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
.top__nav a:hover, .top__nav button:hover { color: #fff; }
.hero { background: var(--navy); color: #fff; padding: 18px 16px 72px; }
.hero__in { max-width: 920px; margin: 0 auto; }
.hero h1 { font-size: clamp(28px, 4vw, 40px); margin-top: 10px; }
.hero p { color: rgba(205,218,228,.75); margin-top: 8px; max-width: 60ch; }
.hero .eyebrow { color: rgba(205,218,228,.6); }

main { max-width: 920px; margin: -44px auto 0; padding: 0 16px 64px; display: grid; gap: 20px; }
.card { background: #fff; padding: 28px; }
.card h2 { font-size: 21px; margin-bottom: 4px; }
.card > p.sub { color: var(--ink-soft); font-size: 14px; margin-bottom: 22px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .card { padding: 22px 18px; } .top__tag { display: none; } }
label { display: block; font-size: 13px; font-weight: 500; color: var(--ink-soft); margin-bottom: 6px; }
input[type=text], input[type=email], input[type=tel], input[type=password] { width: 100%; height: 46px; padding: 0 14px; border: 1px solid var(--mist-2); background: #f6f8f9; font: inherit; color: var(--ink); outline: none; border-radius: 0; transition: border-color .15s, background .15s; }
input:focus { border-color: var(--navy); background: #fff; }
.hint { font-size: 12px; color: var(--steel); margin-top: 5px; }
.sep { height: 1px; background: var(--line); margin: 24px 0; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 48px; padding: 0 26px; border: 0; cursor: pointer; font: 600 15px "Inter", sans-serif; text-decoration: none; background: var(--red); color: #fff; transition: background .2s; }
.btn:hover { background: #d40000; }
.btn--navy { background: var(--navy); } .btn--navy:hover { background: #0a3a52; }
.btn--ghost { background: var(--mist); color: var(--navy); } .btn--ghost:hover { background: var(--mist-2); }
.btn--sm { height: 40px; padding: 0 18px; font-size: 14px; }
.btn--wide { width: 100%; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.save { position: sticky; bottom: 0; background: rgba(255,255,255,.96); margin: 24px -28px -28px; padding: 16px 28px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 16px; }
@media (max-width: 640px) { .save { margin: 24px -18px -22px; padding: 14px 18px; } }
.save span { font-size: 13px; color: var(--steel); }
.msg { padding: 14px 18px; font-size: 14px; border-left: 3px solid; background: #fff; }
.msg--ok { border-color: var(--ok); color: var(--ok); }
.msg--err { border-color: var(--red); color: #b30000; }
.status { display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: #f6f8f9; border: 1px solid var(--mist-2); }
.status__ico { width: 40px; height: 48px; flex: none; background: var(--navy); color: #fff; font: 600 10px "Inter"; display: grid; place-items: end center; padding-bottom: 7px; clip-path: polygon(0 0, 70% 0, 100% 22%, 100% 100%, 0 100%); }
.status b { display: block; font-weight: 600; }
.status small { color: var(--steel); font-size: 13px; }
.status .btn { margin-left: auto; }
.file { position: relative; }
.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--steel); margin-right: 8px; }
.dot--on { background: var(--ok); }
.chats { display: grid; gap: 8px; margin: 14px 0; }
.chats label { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border: 1px solid var(--mist-2); color: var(--ink); font-size: 14px; cursor: pointer; margin: 0; }
.chats label:hover { border-color: var(--navy); }
.chats small { color: var(--steel); margin-left: auto; }
ol.steps { padding-left: 20px; color: var(--ink-soft); font-size: 14px; display: grid; gap: 4px; margin: 4px 0 16px; }
.langs { display: grid; gap: 16px; }
.langs fieldset { border: 1px solid var(--mist-2); padding: 14px 16px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; min-width: 0; }
.langs fieldset > div:first-of-type { grid-column: 1 / -1; }
.langs legend { font: 600 13px "Inter"; color: var(--navy); padding: 0 6px; letter-spacing: .06em; }
.langs legend span { font-weight: 400; color: var(--steel); letter-spacing: 0; margin-left: 4px; }
@media (max-width: 640px) { .langs fieldset { grid-template-columns: 1fr; } }
.foot { text-align: center; font-size: 12px; color: var(--steel); }
</style>
</head>
<body>
<?php if (!$auth): ?>
<div class="login">
  <div class="login__box">
    <img class="login__logo" src="../assets/img/logo-light.png" alt="ALUPROF">
    <?php foreach ($flash as [$t, $m]): ?><div class="msg msg--<?= h($t) ?>" style="margin-bottom:12px"><?= h($m) ?></div><?php endforeach; ?>
    <form class="card cut" method="post" autocomplete="on">
      <div class="eyebrow"><i class="para"></i>Панель управления</div>
      <h1>Вход</h1>
      <?php if ($setup): ?><div class="msg msg--err" style="margin-bottom:16px">Вход ещё не настроен.</div><?php endif; ?>
      <input type="hidden" name="a" value="login"><input type="hidden" name="csrf" value="<?= $csrf ?>">
      <div style="margin-bottom:14px"><label for="u">Логин</label><input id="u" type="text" name="user" autocomplete="username" required autofocus></div>
      <div style="margin-bottom:22px"><label for="p">Пароль</label><input id="p" type="password" name="pass" autocomplete="current-password" required></div>
      <button class="btn btn--wide" type="submit">Войти</button>
    </form>
  </div>
</div>
<?php else: ?>
<header class="top">
  <div class="top__in">
    <img src="../assets/img/logo-light.png" alt="ALUPROF">
    <span class="top__tag">Управление сайтом</span>
    <nav class="top__nav">
      <a href="../" target="_blank" rel="noopener">Открыть сайт ↗</a>
      <form method="post"><input type="hidden" name="a" value="logout"><input type="hidden" name="csrf" value="<?= $csrf ?>"><button type="submit">Выйти</button></form>
    </nav>
  </div>
</header>
<section class="hero"><div class="hero__in">
  <div class="eyebrow"><i class="para"></i>alu-prof.uz</div>
  <h1>Контакты, каталог и заявки</h1>
  <p>Изменения сразу появляются на всех страницах сайта: русской, узбекской и английской версиях.</p>
</div></section>

<main>
  <?php foreach ($flash as [$t, $m]): ?><div class="msg msg--<?= h($t) ?>"><?= h($m) ?></div><?php endforeach; ?>

  <form class="card cut" method="post" id="contacts">
    <input type="hidden" name="a" value="save"><input type="hidden" name="csrf" value="<?= $csrf ?>">
    <h2>Контакты</h2>
    <p class="sub">Показываются в шапке, блоке «Контакты», футере и ответах на частые вопросы.</p>
    <div class="grid">
      <div><label for="phone1">Основной телефон</label><input id="phone1" type="tel" name="phone1" value="<?= $val('phone1') ?>" required><div class="hint">В шапке сайта и в кнопке «Позвонить»</div></div>
      <div><label for="phone2">Второй телефон</label><input id="phone2" type="tel" name="phone2" value="<?= $val('phone2') ?>" required><div class="hint">Формат: +998 77 420-49-94</div></div>
      <div><label for="email">Email на сайте</label><input id="email" type="email" name="email" value="<?= $val('email') ?>" required></div>
    </div>
    <div class="sep"></div>
    <h2>Адрес и график работы</h2>
    <p class="sub">Для каждой версии сайта свой язык. Вторую строку графика можно оставить пустой.</p>
    <div class="langs">
      <?php foreach (LANGS as $l => $lname): ?>
      <fieldset>
        <legend><?= h(strtoupper($l)) ?> <span><?= h($lname) ?></span></legend>
        <div><label for="addr_<?= $l ?>">Адрес</label><input id="addr_<?= $l ?>" type="text" name="addr_<?= $l ?>" value="<?= $val('addr_' . $l) ?>" maxlength="150" required></div>
        <div><label for="h1_<?= $l ?>">График, строка 1</label><input id="h1_<?= $l ?>" type="text" name="h1_<?= $l ?>" value="<?= $val('h1_' . $l) ?>" maxlength="150" required></div>
        <div><label for="h2_<?= $l ?>">График, строка 2</label><input id="h2_<?= $l ?>" type="text" name="h2_<?= $l ?>" value="<?= $val('h2_' . $l) ?>" maxlength="150"></div>
      </fieldset>
      <?php endforeach; ?>
    </div>
    <div class="sep"></div>
    <h2>Соцсети</h2>
    <p class="sub">Можно вставить ссылку целиком или только имя аккаунта.</p>
    <div class="grid">
      <div><label for="telegram">Telegram</label><input id="telegram" type="text" name="telegram" value="<?= h($form['telegram'] ?? 'https://t.me/' . $s['telegram']) ?>" required></div>
      <div><label for="instagram">Instagram</label><input id="instagram" type="text" name="instagram" value="<?= h($form['instagram'] ?? 'https://www.instagram.com/' . $s['instagram']) ?>" required></div>
    </div>
    <div class="sep"></div>
    <h2>Куда приходят заявки</h2>
    <p class="sub">Заявки с формы на сайте отправляются на эту почту. Telegram настраивается ниже.</p>
    <div class="grid">
      <div><label for="lead_email">Почта для заявок</label><input id="lead_email" type="email" name="lead_email" value="<?= $val('lead_email') ?>" required></div>
    </div>
    <div class="save"><button class="btn" type="submit">Сохранить изменения</button><span>Сайт обновится сразу после сохранения</span></div>
  </form>

  <div class="card cut" id="catalog">
    <h2>Каталог THERMO</h2>
    <p class="sub">PDF, который скачивают с сайта по кнопкам «Каталог PDF». Новый файл заменит текущий.</p>
    <div class="status">
      <span class="status__ico">PDF</span>
      <div><b>thermo-catalog.pdf</b><small><?= $cat_ok ? h(str_replace('PDF, ', '', mb_fmt($s['cat_mb'], 'ru'))) . ' · обновлён ' . h($cat_date) : 'файл не найден' ?></small></div>
      <a class="btn btn--ghost btn--sm" href="../<?= CAT_FILE ?><?= $s['cat_v'] ? '?v=' . h($s['cat_v']) : '' ?>" target="_blank" rel="noopener">Открыть</a>
    </div>
    <form method="post" enctype="multipart/form-data" style="margin-top:16px" class="row">
      <input type="hidden" name="a" value="catalog"><input type="hidden" name="csrf" value="<?= $csrf ?>">
      <span class="btn btn--navy btn--sm file">Выбрать PDF<input type="file" name="pdf" accept="application/pdf,.pdf" required onchange="this.form.querySelector('.fname').textContent=this.files[0]?this.files[0].name:'';this.form.querySelector('[type=submit]').hidden=!this.files[0]"></span>
      <span class="fname hint" style="margin:0"></span>
      <button class="btn btn--sm" type="submit" hidden>Загрузить</button>
    </form>
    <div class="hint" style="margin-top:10px">До <?= h(min(MAX_PDF_MB, (int)$up_max ?: MAX_PDF_MB)) ?> МБ. Ссылки на сайте обновятся, посетители сразу получат новый файл.</div>
  </div>

  <div class="card cut" id="leads">
    <h2>Заявки в Telegram</h2>
    <p class="sub">Копия каждой заявки приходит в группу Telegram через бота.</p>
    <div class="status" style="margin-bottom:18px">
      <span class="dot <?= $s['lead_tg'] !== '' ? 'dot--on' : '' ?>"></span>
      <div><b><?= $s['lead_tg'] !== '' ? 'Подключено: ' . h($s['lead_tg_title'] ?: $s['lead_tg']) : 'Группа не подключена' ?></b><small>Почта: <?= h($s['lead_email']) ?></small></div>
    </div>
    <?php if ($found): ?>
      <form method="post">
        <input type="hidden" name="a" value="tgpick"><input type="hidden" name="csrf" value="<?= $csrf ?>">
        <b style="font-weight:600">Выберите, куда отправлять заявки:</b>
        <div class="chats">
          <?php foreach ($found as $id => $c): ?>
            <label><input type="radio" name="chat" value="<?= h($id) ?>" required> <?= h($c['title']) ?> <small><?= $c['type'] === 'private' ? 'личный чат' : 'группа' ?></small></label>
          <?php endforeach; ?>
        </div>
        <button class="btn btn--sm" type="submit">Подключить</button>
      </form>
      <div class="sep"></div>
    <?php else: ?>
      <ol class="steps">
        <li>Добавьте бота <b>@AluprofLeadsBot</b> в нужную группу Telegram.</li>
        <li>Напишите в группе <b>«@AluprofLeadsBot тест»</b> — обязательно с отметкой бота.</li>
        <li>Бот ответит «Активация успешна», и группа подключится сама. Чтобы сменить группу, нажмите «Найти группу».</li>
      </ol>
    <?php endif; ?>
    <div class="row">
      <form method="post"><input type="hidden" name="a" value="tgfind"><input type="hidden" name="csrf" value="<?= $csrf ?>"><button class="btn btn--navy btn--sm" type="submit">Найти группу</button></form>
      <form method="post"><input type="hidden" name="a" value="test"><input type="hidden" name="csrf" value="<?= $csrf ?>"><button class="btn btn--ghost btn--sm" type="submit">Отправить тестовую заявку</button></form>
      <?php if ($s['lead_tg'] !== ''): ?>
      <form method="post"><input type="hidden" name="a" value="tgoff"><input type="hidden" name="csrf" value="<?= $csrf ?>"><button class="btn btn--ghost btn--sm" type="submit">Отключить Telegram</button></form>
      <?php endif; ?>
    </div>
  </div>
  <p class="foot">Разработано NEX GROUP</p>
</main>
<?php endif; ?>
</body>
</html>
