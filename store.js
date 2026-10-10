// Shared storage + helpers. Storage is Upstash Redis over its REST API,
// so it works on any serverless runtime with no SDK.

export const DEFAULT_URL = "https://example.com";

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash env vars are not set");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

/* ---- redirect url ---- */

export async function getUrl() {
  return sanitizeUrl(await redis(["GET", "url"])) || DEFAULT_URL;
}

// Returns the cleaned URL that was saved, or null if the input was invalid.
export async function setUrl(value) {
  const clean = sanitizeUrl(value);
  if (!clean) return null;
  await redis(["SET", "url", clean]);
  return clean;
}

/* ---- tracking ---- */

export async function recordVisit(visit) {
  await redis(["LPUSH", "visits", JSON.stringify(visit)]);
  await redis(["LTRIM", "visits", "0", "99"]); // keep the last 100
  await redis(["INCR", "count"]);
}

export async function getCount() {
  return parseInt((await redis(["GET", "count"])) || "0", 10);
}

export async function getVisits() {
  const arr = (await redis(["LRANGE", "visits", "0", "99"])) || [];
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
    "🔀 Redirect hit\n" +
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
