# Nomi server

Cloudflare Worker на бесплатном тарифе.

- Распознаёт фото еды через Gemini с ключом владельца. Пользователи ключ не вводят, лимит 20 фото в день на человека.
- Принимает сводку дня из приложения (`/sync`).
- Раз в час рассылает персональные напоминания по местному времени пользователя:
  - вечером (через час после обычной последней записи человека, 19…22 ч) серия сгорит, если день пустой;
  - в то же время: сколько белка осталось, с подсказкой из того, что человек обычно ест;
  - за час до этого, для набора массы: калории сильно не добраны;
  - понедельник 9:00 пора взвеситься (если есть цель и не взвешивался 6 дней);
  - воскресенье 20:00 итоги недели и текущий этап цели;
  - 19:00 мягкое напоминание после 3 дней без записей, один раз.
  Не больше одного сообщения в час, отключение командой /stop.

## Что уже сделано в Cloudflare

- База D1 `nomi` (id `1b8ff482-d15a-42f9-b189-da7ba559fe44`), таблицы созданы.
- Воркер `nomi`, адрес `https://nomi.eden-nee-mail.workers.dev` (пока там заглушка Hello World).
- Привязка базы `DB` и переменные `APP_URL`, `ALLOW_ORIGIN`, `DAILY_LIMIT`, `MODEL`.

## Что осталось (5 минут, делает владелец)

1. Залить код. Проще всего через Git:
   - на GitHub: Settings → Applications → Cloudflare Workers and Pages → Configure → дать доступ к репозиторию `projects`;
   - в Cloudflare: Workers → nomi → Settings → Builds → Connect → репозиторий `projects`, ветка `main`, в Advanced settings → Root directory: `/nomi-server`. Deploy command оставить `npx wrangler deploy`.
   После этого каждый push в `nomi-server/` сам обновляет сервер, а cron включится из `wrangler.toml`.
2. Секреты: Workers → nomi → Settings → Variables and secrets → Add → тип Secret:
   - `BOT_TOKEN` — токен от BotFather;
   - `GEMINI_KEY` — ключ из Google AI Studio;
   - `WEBHOOK_SECRET` — любая длинная строка из букв и цифр.
3. Webhook бота, открыть в браузере (подставить токен и ту же строку):
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://nomi.eden-nee-mail.workers.dev/bot&secret_token=<WEBHOOK_SECRET>`
4. Сказать Claude, что готово: он впишет адрес сервера в приложение (`window.NOMI_API`) и проверит распознавание.

## BotFather

- `/setmenubutton` → кнопка «Открыть Nomi», ссылка `https://edennee-site.github.io/projects/porsiya/`
- `/setdescription`: «Nomi считает калории и БЖУ по фото тарелки, ведёт к цели по весу и напоминает о главном.»
- `/setabouttext`: «Калории и БЖУ по фото. Цели по весу, серии и достижения.»
- Политика конфиденциальности: `https://edennee-site.github.io/projects/porsiya/privacy.html`
