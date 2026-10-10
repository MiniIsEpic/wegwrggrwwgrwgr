import {
  getUrl,
  recordVisit,
  notifyTelegram,
  formatVisit,
} from "../lib/store.js";

export default async function handler(req, res) {
  const dest = await getUrl();

  const fwd = req.headers["x-forwarded-for"] || "";
  const visit = {
    time: new Date().toISOString(),
    ip: (Array.isArray(fwd) ? fwd[0] : fwd).split(",")[0].trim() || "?",
    country: req.headers["x-vercel-ip-country"] || "?",
    city: decode(req.headers["x-vercel-ip-city"]) || "?",
    ua: req.headers["user-agent"] || "?",
    referrer: req.headers["referer"] || "direct",
    dest,
  };

  // Serverless functions may freeze after responding, so finish the
  // logging + notification before sending the redirect.
  try {
    await recordVisit(visit);
    await notifyTelegram(formatVisit(visit));
  } catch (_) {
    /* tracking must never block the redirect */
  }

  res.statusCode = 302;
  res.setHeader("Location", dest);
  res.end();
}

function decode(v) {
  if (!v) return v;
  try {
    return decodeURIComponent(v);
  } catch (_) {
    return v;
  }
}
