import {
  getUrl,
  setUrl,
  getCount,
  getVisits,
  tgSend,
  sanitizeUrl,
} from "../lib/store.js";

// Telegram POSTs updates here. We verify the secret header and the sender,
// then act on commands. Only TELEGRAM_CHAT_ID can change anything.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end();
  }

  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (
    !process.env.TELEGRAM_WEBHOOK_SECRET ||
    secret !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    res.statusCode = 401;
    return res.end();
  }

  const ok = () => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  };

  const update = req.body || {};
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return ok();

  const chatId = msg.chat && msg.chat.id;
  // Silently ignore anyone who isn't you.
  if (String(chatId) !== String(process.env.TELEGRAM_CHAT_ID)) return ok();

  await tgSend(chatId, await handleCommand(msg.text.trim()));
  return ok();
}

async function handleCommand(text) {
  const lower = text.toLowerCase();

  if (lower === "/start" || lower === "/help") {
    return (
      "Redirect bot commands:\n" +
      "/set <url> — change where the page redirects\n" +
      "/get — show the current link\n" +
      "/stats — show total hits and the latest visit\n\n" +
      "Tip: you can also just send a link on its own to set it."
    );
  }

  if (lower === "/get" || lower === "/current") {
    return `Currently redirecting to:\n${await getUrl()}`;
  }

  if (lower === "/stats") {
    const [count, visits] = await Promise.all([getCount(), getVisits()]);
    const last = visits[0];
    const lastLine = last
      ? `\nLatest: ${last.time} — ${last.city}, ${last.country} (${last.ip})`
      : "\nNo visits yet.";
    return `Total hits: ${count}${lastLine}`;
  }

  // "/set <url>"  or  a bare URL
  let candidate = null;
  if (lower.startsWith("/set ")) candidate = text.slice(5).trim();
  else if (lower.startsWith("http")) candidate = text;

  if (candidate) {
    if (!sanitizeUrl(candidate)) {
      return "That doesn't look like a valid link. Use a full URL starting with https://";
    }
    const saved = await setUrl(candidate);
    return `✅ Updated. Now redirecting to:\n${saved}`;
  }

  return "Unknown command. Send /help to see what I can do.";
}
