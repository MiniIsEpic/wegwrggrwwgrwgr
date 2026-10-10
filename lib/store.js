// Shared storage + helpers. Uses a standard Redis connection (redis:// or
// rediss://) via node-redis, so it works with Redis Cloud, Upstash, or any
// Redis host. Set REDIS_URL to your connection string.

import { createClient } from "redis";

export const DEFAULT_URL = "https://example.com";

let clientPromise = null;

function getClient() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  if (!clientPromise) {
    const client = createClient({ url });
    client.on("error", () => {}); // don't let transient socket errors crash the function
    clientPromise = client
      .connect()
      .then(() => client)
      .catch((e) => {
        clientPromise = null; // allow a fresh attempt next request
        throw e;
      });
  }
  return clientPromise;
}

/* ---- redirect url ---- */

export async function getUrl() {
  const c = await getClient();
  return sanitizeUrl(await c.get("url")) || DEFAULT_URL;
}

// Returns the cleaned URL that was saved, or null if the input was invalid.
export async function setUrl(value) {
  const clean = sanitizeUrl(value);
  if (!clean) return null;
  const c = await getClient();
  await c.set("url", clean);
  return clean;
}

/* ---- tracking ---- */

export async function recordVisit(visit) {
  const c = await getClient();
  await c.lPush("visits", JSON.stringify(visit));
  await c.lTrim("visits", 0, 99); // keep the last 100
  await c.incr("count");
}

export async function getCount() {
  const c = await getClient();
  return parseInt((await c.get("count")) || "0", 10);
}

export async function getVisits() {
  const c = await getClient();
  const arr = (await c.lRange("visits", 0, 99)) || [];
  return arr
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

/* ---- telegram ---- */

// A notification you send to yourself (uses the configured chat id).
export async function notifyTelegram(text) {
  if (!process.env.TELEGRAM_CHAT_ID) return;
  await tgSend(process.env.TELEGRAM_CHAT_ID, text);
}

// A reply to a specific chat (used by the bot webhook).
export async function tgSend(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (_) {
    /* ignore */
  }
}

export function formatVisit(v) {
  return (
    "\u{1F500} Redirect hit\n" +
    `To: ${v.dest}\n` +
    `When: ${v.time}\n` +
    `Where: ${v.city}, ${v.country}\n` +
    `IP: ${v.ip}\n` +
    `From: ${v.referrer}\n` +
    `Device: ${v.ua}`
  );
}

/* ---- small utilities ---- */

export function sanitizeUrl(v) {
  if (!v) return null;
  try {
    const u = new URL(String(v).trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch (_) {
    return null;
  }
}

export function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
