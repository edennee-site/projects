// Nomi server: Cloudflare Worker (бесплатный тариф).
// POST /recognize  — распознавание фото через Gemini с ключом владельца, дневной лимит на пользователя
// POST /sync       — сводка дня из приложения (для напоминаний)
// POST /bot        — webhook Telegram: /start, кнопка «Открыть Nomi», отписка от напоминаний
// cron (каждый час) — напоминания: серия в 21:00, белок в 21:00, взвешивание в понедельник 9:00, итоги недели в воскресенье 20:00
//
// Секреты (wrangler secret put): BOT_TOKEN, GEMINI_KEY
// Переменные (wrangler.toml [vars]): APP_URL, ALLOW_ORIGIN, DAILY_LIMIT, MODEL
// База: D1, привязка DB (схема в schema.sql)

const CATS = ["dish", "soup", "dough", "meat", "fish", "egg", "milk", "bread", "grain", "fruit", "veg", "nut", "sweet", "drink", "fast", "shaker"];
const PROMPT = (hint) => `Ты нутрициолог. На фото еда. Определи каждое отдельное блюдо или продукт, оцени вес порции в граммах по размеру тарелки и приборов, затем калорийность и БЖУ именно этой порции. Учитывай типичное количество масла при домашней готовке (особенно для узбекской и восточной кухни). Названия пиши по-русски, коротко, как в меню. Для каждого укажи категорию из списка: ${CATS.join(", ")}. Если на фото нет еды, верни пустой список.${hint ? "\nОписание от пользователя, оно важнее того, что видно на фото: " + hint : ""}`;
const SCHEMA = { type: "OBJECT", properties: { items: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, category: { type: "STRING", enum: CATS }, grams: { type: "NUMBER" }, kcal: { type: "NUMBER" }, protein: { type: "NUMBER" }, fat: { type: "NUMBER" }, carbs: { type: "NUMBER" } }, required: ["name", "grams", "kcal", "protein", "fat", "carbs"] } } }, required: ["items"] };

const json = (env, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors(env) } });
const cors = (env) => ({ "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*", "Access-Control-Allow-Headers": "Content-Type, X-Init-Data", "Access-Control-Allow-Methods": "POST, OPTIONS" });
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// ---------- проверка подписи Telegram initData ----------
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? new TextEncoder().encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
async function verify(initData, token) {
  if (!initData) return null;
  const p = new URLSearchParams(initData), hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac("WebAppData", token);
  if (hex(await hmac(secret, dcs)) !== hash) return null;
  if (Date.now() / 1000 - +p.get("auth_date") > 86400 * 7) return null; // initData старше недели не принимаем
  try { return JSON.parse(p.get("user")); } catch (e) { return null; }
}

// ---------- распознавание ----------
async function recognize(req, env, user) {
  const body = await req.json().catch(() => ({}));
  if (!body.image || body.image.length > 2_000_000) return json(env, { error: "bad_image" }, 400);
  const day = new Date().toISOString().slice(0, 10), limit = +(env.DAILY_LIMIT || 20);
  const row = await env.DB.prepare("SELECT n FROM usage WHERE uid = ? AND day = ?").bind(user.id, day).first();
  if (row && row.n >= limit) return json(env, { error: "daily_limit" }, 429);
  const hint = String(body.hint || "").slice(0, 300);
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.MODEL || "gemini-flash-latest"}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT(hint) }, { inline_data: { mime_type: "image/jpeg", data: body.image } }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA } }),
  });
  if (r.status === 429) return json(env, { error: "busy" }, 429);
  if (!r.ok) return json(env, { error: "upstream" }, 502);
  const j = await r.json();
  let data;
  try { data = JSON.parse(((j.candidates || [])[0] || {}).content.parts.map((p) => p.text || "").join("")); } catch (e) { return json(env, { error: "parse" }, 502); }
  await env.DB.prepare("INSERT INTO usage (uid, day, n) VALUES (?, ?, 1) ON CONFLICT(uid, day) DO UPDATE SET n = n + 1").bind(user.id, day).run();
  return json(env, { items: data.items || [] });
}

// ---------- сводка дня ----------
async function sync(req, env, user) {
  const s = await req.json().catch(() => null);
  if (!s || typeof s.tz !== "number") return json(env, { error: "bad" }, 400);
  await env.DB.prepare(`INSERT INTO users (uid, name, tz, summary, updated) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET name = excluded.name, tz = excluded.tz, summary = excluded.summary, updated = excluded.updated`)
    .bind(user.id, user.first_name || "", s.tz, JSON.stringify(s), Date.now()).run();
  return json(env, { ok: true });
}

// ---------- Telegram ----------
const tg = (env, method, payload) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const openBtn = (env, text = "Открыть Nomi") => ({ inline_keyboard: [[{ text, web_app: { url: env.APP_URL } }]] });

async function bot(req, env) {
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  const u = await req.json().catch(() => ({}));
  const m = u.message;
  if (!m || !m.text) return new Response("ok");
  const id = m.from.id;
  if (m.text.startsWith("/start")) {
    await env.DB.prepare("INSERT INTO users (uid, name, tz, summary, updated, muted) VALUES (?, ?, 300, '{}', ?, 0) ON CONFLICT(uid) DO UPDATE SET muted = 0").bind(id, m.from.first_name || "", Date.now()).run();
    await tg(env, "sendMessage", { chat_id: id, text: "Nomi считает калории и БЖУ по фото тарелки, ведёт к цели по весу и напоминает о главном.\n\nНапоминания можно отключить командой /stop.", reply_markup: openBtn(env) });
  } else if (m.text.startsWith("/stop")) {
    await env.DB.prepare("UPDATE users SET muted = 1 WHERE uid = ?").bind(id).run();
    await tg(env, "sendMessage", { chat_id: id, text: "Напоминания отключены. Включить снова: /start." });
  }
  return new Response("ok");
}

// ---------- напоминания ----------
function localNow(tz) { const d = new Date(Date.now() + tz * 60000); return { h: d.getUTCHours(), dow: d.getUTCDay(), day: d.toISOString().slice(0, 10) }; }
function pick(s, L, name) {
  const today = s.day === L.day, logged = today && s.logged, hi = name ? name + ", " : "";
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1), P = (t) => cap(hi + t);
  const RH = s.rh >= 19 && s.rh <= 22 ? s.rh : 21;
  const daysSince = s.last ? Math.round((Date.parse(L.day) - Date.parse(s.last)) / 864e5) : 99;
  // воскресенье 20:00: итоги недели
  if (L.dow === 0 && L.h === 20 && s.week && s.week.days >= 3) {
    const w = s.week, st = s.stage;
    let t = `Итоги недели\n\nДней с записями: ${w.days} из 7\nВ норме калорий: ${w.inNorm}\nВ среднем ${fmt(w.avgK)} ккал и ${fmt(w.avgP)} г белка в день`;
    const pc = s.pace;
    if (pc && !pc.brk) t += `\n\nТемп: ${Math.abs(pc.diff) <= 0.5 ? "по плану" : pc.diff > 0 ? `впереди плана на ${dec(pc.diff)} кг` : `отставание от плана ${dec(-pc.diff)} кг`}${pc.pw != null ? `, вес за неделю ${pc.pw > 0 ? "+" : pc.pw < 0 ? "−" : ""}${dec(Math.abs(pc.pw))} кг` : ""}.`;
    if (st) t += `\n\nТекущий этап цели: ${String(st.to).replace(".", ",")} кг к ${new Date(st.d).getDate()} ${MON[new Date(st.d).getMonth()]}.`;
    t += `\n\n${w.inNorm >= 5 ? "Сильная неделя. Так и держать." : w.inNorm >= 3 ? "Неплохо. На следующей неделе добавь ещё пару дней в норме." : "Результат даёт регулярность: попробуй держать норму хотя бы 4 дня из 7."}`;
    return t;
  }
  // 21:00: серия под угрозой
  if (L.h === RH && !logged && s.streak > 0) return P(`серия ${s.streak} ${plural(s.streak, "день", "дня", "дней")} сгорит в полночь. Добавь хотя бы один приём пищи, это займёт полминуты.`);
  // 21:00: белок не добран
  if (L.h === RH && logged && s.np && s.p < s.np * 0.8) {
    const left = Math.round(s.np - s.p);
    const tip = s.pf ? ` Из того, что ты обычно ешь, подойдёт ${s.pf.n.toLowerCase()}${s.pf.g ? `: ${s.pf.g} г дают ${s.pf.p} г белка` : ""}.` : "";
    return P(`до нормы белка сегодня ${left} г.${tip}`);
  }
  // 20:00: набор массы, калории сильно не добраны
  if (L.h === RH - 1 && logged && s.goal === "gain" && s.nk && s.k < s.nk * 0.65) return P(`до нормы ещё ${fmt(s.nk - s.k)} ккал. Для набора массы важно добирать калории каждый день, иначе вес стоит на месте.`);
  // 9:00 в день тренировки: норма на сегодня выше обычной
  const tr = s.tr && s.tr[L.day];
  if (L.h === 9 && tr > 0 && s.nb) return P(`сегодня тренировка. Норма на день ${fmt(s.nb + tr)} ккал, на ${fmt(tr)} больше обычного. Добавку лучше отдать углеводам до зала, а после добрать белок.`);
  // понедельник 9:00: взвешивание
  if (L.dow === 1 && L.h === 9 && s.plan && (!s.lastWeigh || (Date.parse(L.day) - Date.parse(s.lastWeigh)) / 864e5 >= 6)) return P(`пора взвеситься: утром натощак, после туалета. Так прогресс к цели будет точным.`);
  // 19:00: не заходил 3 дня, напоминаем один раз за перерыв
  if (L.h === 19 && daysSince === 3) return P(`три дня без записей. Ничего страшного, просто начни с сегодняшнего ужина. За возвращение есть отдельное достижение.`);
  return null;
}
const dec = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };

async function remind(env) {
  const { results } = await env.DB.prepare("SELECT uid, name, tz, summary, sent FROM users WHERE muted = 0 AND updated > ?").bind(Date.now() - 14 * 864e5).all();
  for (const r of results) {
    let s; try { s = JSON.parse(r.summary); } catch (e) { continue; }
    if (!s.day) continue;
    const L = localNow(r.tz), key = L.day + ":" + L.h;
    if (r.sent === key) continue;
    const text = pick(s, L, (s.name || r.name || "").trim().split(" ")[0]);
    if (!text) continue;
    const res = await tg(env, "sendMessage", { chat_id: r.uid, text, reply_markup: openBtn(env) });
    if (res.status === 403) await env.DB.prepare("UPDATE users SET muted = 1 WHERE uid = ?").bind(r.uid).run(); // бот заблокирован
    else await env.DB.prepare("UPDATE users SET sent = ? WHERE uid = ?").bind(key, r.uid).run();
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (url.pathname === "/bot" && req.method === "POST") return bot(req, env);
    if (req.method !== "POST") return new Response("Nomi", { status: 200 });
    const user = await verify(req.headers.get("X-Init-Data"), env.BOT_TOKEN);
    if (!user) return json(env, { error: "unauthorized" }, 401);
    if (url.pathname === "/recognize") return recognize(req, env, user);
    if (url.pathname === "/sync") return sync(req, env, user);
    return json(env, { error: "not_found" }, 404);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(remind(env)); },
};
