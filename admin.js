import { getUrl, setUrl, getCount, getVisits, esc } from "../lib/store.js";

export default async function handler(req, res) {
  if (!checkAuth(req)) return challenge(res);

  if (req.method === "POST") {
    const value = req.body && req.body.url ? req.body.url : "";
    const saved = await setUrl(value);
    if (!saved) {
      res.statusCode = 400;
      return res.end("Invalid URL");
    }
    res.statusCode = 303;
    res.setHeader("Location", "/admin/redirect");
    return res.end();
  }

  const [current, count, visits] = await Promise.all([
    getUrl(),
    getCount(),
    getVisits(),
  ]);

  const rows = visits.length
    ? visits
        .map(
          (v) =>
            `<tr><td>${esc(v.time)}</td><td>${esc(v.city)}, ${esc(
              v.country
            )}</td><td>${esc(v.ip)}</td><td>${esc(
              v.referrer
            )}</td><td class="ua">${esc(v.ua)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No visits recorded yet.</td></tr>`;

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redirect admin</title>
<style>
  :root{color-scheme:light dark}
  body{font:16px/1.5 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem}
  h1{font-size:1.3rem;margin:0 0 .25rem}
  .muted{opacity:.7}
  form{margin:1.5rem 0;display:flex;gap:.5rem;flex-wrap:wrap}
  input[type=url]{flex:1;min-width:16rem;padding:.6rem .7rem;font:inherit}
  button{padding:.6rem 1rem;font:inherit;font-weight:600;cursor:pointer}
  table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:1rem}
  th,td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid #8884;vertical-align:top}
  .ua{max-width:22rem;overflow-wrap:anywhere;opacity:.75}
  .empty{text-align:center;opacity:.6;padding:1.5rem}
  code{background:#8882;padding:.1rem .3rem;border-radius:4px}
</style></head><body>
  <h1>Redirect admin</h1>
  <p class="muted">Currently sending visitors to <code>${esc(
    current
  )}</code> — ${count} total hits. You can also change it by messaging your Telegram bot.</p>
  <form method="POST" action="/admin/redirect">
    <input type="url" name="url" value="${esc(
      current
    )}" placeholder="https://…" required>
    <button type="submit">Save link</button>
  </form>
  <h2 style="font-size:1.05rem">Recent visits</h2>
  <table>
    <thead><tr><th>Time (UTC)</th><th>Location</th><th>IP</th><th>Referrer</th><th>Device</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const h = req.headers["authorization"] || "";
  if (!h.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  } catch (_) {
    return false;
  }
  const i = decoded.indexOf(":");
  const pass = i >= 0 ? decoded.slice(i + 1) : "";
  return pass === expected;
}

function challenge(res) {
  res.statusCode = 401;
  res.setHeader(
    "WWW-Authenticate",
    'Basic realm="Redirect admin", charset="UTF-8"'
  );
  res.end("Authentication required.");
}
