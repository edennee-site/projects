# Nomi server

Cloudflare Worker на бесплатном тарифе. Делает три вещи:

1. Распознаёт фото еды через Gemini с ключом владельца. Пользователи ключ не вводят. Лимит 20 фото в день на человека (`DAILY_LIMIT`).
2. Принимает сводку дня из приложения (`/sync`): записан ли день, белок, серия, вес, итоги недели.
3. Раз в час рассылает напоминания в Telegram по местному времени пользователя:
   - 21:00: серия сгорит, если день пустой;
   - 21:00: сколько белка осталось, если день записан, а белок не добран;
   - понедельник 9:00: пора взвеситься, если есть цель и взвешивания не было 6 дней;
   - воскресенье 20:00: итоги недели.
   Не больше одного сообщения в час. Отключение командой /stop.

Каждый запрос проверяется подписью Telegram (`initData`), поэтому чужие запросы не пройдут.

## Запуск

```
npm i -g wrangler
wrangler login
wrangler d1 create nomi            # id вставить в wrangler.toml
wrangler d1 execute nomi --remote --file schema.sql
wrangler secret put BOT_TOKEN      # токен от BotFather, вводит владелец
wrangler secret put GEMINI_KEY     # ключ Google AI Studio, вводит владелец
wrangler secret put WEBHOOK_SECRET # любая длинная случайная строка
wrangler deploy
```

Webhook бота (подставить адрес воркера и тот же WEBHOOK_SECRET):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://nomi.<account>.workers.dev/bot&secret_token=<WEBHOOK_SECRET>
```

В приложении в `index.html` перед `app.js`:

```html
<script>window.NOMI_API = "https://nomi.<account>.workers.dev";</script>
```
