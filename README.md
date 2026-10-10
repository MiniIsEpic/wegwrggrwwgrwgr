# Redirect site

A link that redirects every visitor to a destination you control, logs each
visit, and pings you on Telegram. You can change the destination from a
password-protected admin page or by messaging your Telegram bot.

- `/` (and any other path) → 302-redirects the visitor to the current link
- `/admin/redirect` → password-protected page to change the link and view recent visits
- `/api/telegram` → Telegram bot webhook (how the bot changes the link)

## 1. Put it on GitHub

Create a new repository and upload this folder's contents (or push with git).

## 2. Deploy on Vercel

1. Go to vercel.com, **Add New → Project**, and import your GitHub repo.
2. Deploy once. Vercel gives you a URL like `https://your-app.vercel.app`.

## 3. Add storage

In the Vercel project: **Storage → Create Database → Upstash (Redis)**, then
connect it to the project. This adds `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` automatically. (Free tier is plenty.)

## 4. Add environment variables

Project **Settings → Environment Variables**, then redeploy:

| Name | What it is |
|------|------------|
| `ADMIN_PASSWORD` | password for the `/admin/redirect` page |
| `TELEGRAM_BOT_TOKEN` | from @BotFather in Telegram |
| `TELEGRAM_CHAT_ID` | your numeric id, from @userinfobot |
| `TELEGRAM_WEBHOOK_SECRET` | any random string — e.g. `openssl rand -hex 16` |

Telegram is optional: without the two `TELEGRAM_*` values, the redirect and
tracking still work, just without notifications.

## 5. Turn on the bot

Message your bot once so it can reply to you, then run this (filling in your
values) to register the webhook:

```
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-app>/api/telegram&secret_token=<WEBHOOK_SECRET>"
```

## 6. Set your link

Open `https://<your-app>/admin/redirect` (username blank, password =
`ADMIN_PASSWORD`), or message your bot:

- `/set https://somewhere.com` — change the link
- `/get` — show the current link
- `/stats` — total hits and the latest visit
- `/help` — list commands

Only the chat matching `TELEGRAM_CHAT_ID` is obeyed.

## Custom domain

In Vercel **Settings → Domains**, add your domain (e.g. `yourmymiserygirl.com`)
and follow the DNS steps. Then visitors to the domain get redirected, and
`yourdomain.com/admin/redirect` is your admin page.

## Notes

- "Tracks each person" means per visit, not per unique human — the same person
  visiting twice counts as two hits.
- The admin login and bot webhook are both checked on the server, so neither
  password nor control is exposed in any page.
