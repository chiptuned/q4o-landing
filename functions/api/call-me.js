// POST /api/call-me - triggers an OVH Click2Call bridge between Vincent and the visitor.
// Body: { name, phone, note?, 'cf-turnstile-response': token }
// Env: OVH_*, VINCENT_MOBILE, TURNSTILE_SECRET
// Rate limits: per-IP (1 call / 2 min), global (5 calls / 2 min), hours gate (Mon-Sat 09:30-18:00 Paris).

const COOLDOWN_SECONDS = 120;       // per-IP and per-phone cooldown
const GLOBAL_WINDOW_SECONDS = 120;  // global window
const GLOBAL_MAX_IN_WINDOW = 5;     // max calls globally within window

// Mon-Sat 09:30-18:00 Paris
function isInParisHours() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find(p => p.type === 'weekday').value;
  const hh = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const mm = parseInt(parts.find(p => p.type === 'minute').value, 10);
  if (wd === 'Sun') return false;
  const minutes = hh * 60 + mm;
  return minutes >= 9 * 60 + 30 && minutes < 18 * 60;
}

// Cache-API-backed rate limiter. Cloudflare's default cache is per-PoP but good
// enough to break a single attacker's loop. Belt-and-suspenders: enable
// Cloudflare Rate Limiting Rules on /api/call-me at the dashboard level too.
async function cacheCheck(request, keyPath) {
  const url = new URL(request.url);
  url.pathname = keyPath;
  url.search = '';
  const req = new Request(url.toString(), { method: 'GET' });
  return caches.default.match(req);
}
async function cacheSet(request, keyPath, seconds, value = '1') {
  const url = new URL(request.url);
  url.pathname = keyPath;
  url.search = '';
  const req = new Request(url.toString(), { method: 'GET' });
  await caches.default.put(req, new Response(value, {
    headers: { 'Cache-Control': `max-age=${seconds}, s-maxage=${seconds}` },
  }));
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const name  = (body.name  || '').trim();
  const phone = (body.phone || '').trim();
  const note  = (body.note  || '').trim().slice(0, 500);
  const tsToken = (body['cf-turnstile-response'] || '').trim();

  if (name.length < 2) return json({ error: 'name_too_short' }, 400);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return json({ error: 'phone_invalid' }, 400);

  // Hours gate - no bridge outside Mon-Sat 09:30-18:00 Paris.
  if (!isInParisHours()) {
    return json({ error: 'outside_hours' }, 403);
  }

  // ==== Rate limits ====
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const phoneDigits = digits;

  const ipHit = await cacheCheck(request, '/__rl_ip__/' + encodeURIComponent(ip));
  if (ipHit) return json({ error: 'rate_limited', retryAfter: COOLDOWN_SECONDS }, 429);

  const phoneHit = await cacheCheck(request, '/__rl_phone__/' + phoneDigits);
  if (phoneHit) return json({ error: 'rate_limited', retryAfter: COOLDOWN_SECONDS }, 429);

  // Global counter: bump and reject if over GLOBAL_MAX_IN_WINDOW.
  const globalKey = '/__rl_global__/window';
  const globalHit = await cacheCheck(request, globalKey);
  let globalCount = 0;
  if (globalHit) {
    const txt = await globalHit.text();
    globalCount = parseInt(txt, 10) || 0;
  }
  if (globalCount >= GLOBAL_MAX_IN_WINDOW) {
    return json({ error: 'global_rate_limited' }, 429);
  }

  // Mark rate-limit cooldowns BEFORE the OVH call so a retry while the call
  // is still in flight is also blocked.
  await cacheSet(request, '/__rl_ip__/' + encodeURIComponent(ip), COOLDOWN_SECONDS);
  await cacheSet(request, '/__rl_phone__/' + phoneDigits, COOLDOWN_SECONDS);
  await cacheSet(request, globalKey, GLOBAL_WINDOW_SECONDS, String(globalCount + 1));

  // Cloudflare Turnstile: verify unless secret not set (local dev).
  if (env.TURNSTILE_SECRET) {
    if (!tsToken) return json({ error: 'turnstile_missing' }, 400);
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: tsToken,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    const verify = await verifyRes.json().catch(() => ({}));
    if (!verify.success) {
      return json({ error: 'turnstile_failed', detail: verify['error-codes'] || [] }, 403);
    }
  }

  // Normalise to E.164-ish. If user typed 0XXXXXXXXX (French national), map to +33XXXXXXXXX.
  // If they typed +... or 00..., pass through.
  let called = phone.replace(/\s/g, '');
  if (called.startsWith('00')) called = '+' + called.slice(2);
  else if (called.startsWith('0')) called = '+33' + called.slice(1);
  else if (!called.startsWith('+')) called = '+' + called;

  const {
    OVH_ENDPOINT, OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY,
    OVH_BILLING_ACCOUNT, OVH_SERVICE_NAME, VINCENT_MOBILE,
  } = env;

  if (!OVH_APP_KEY || !OVH_APP_SECRET || !OVH_CONSUMER_KEY ||
      !OVH_BILLING_ACCOUNT || !OVH_SERVICE_NAME || !VINCENT_MOBILE) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  const urlPath = `/telephony/${OVH_BILLING_ACCOUNT}/line/${OVH_SERVICE_NAME}/click2Call`;
  const url = (OVH_ENDPOINT || 'https://eu.api.ovh.com/1.0') + urlPath;

  // OVH requires server time for signatures (avoids clock drift on client workers)
  const timestamp = await (await fetch((OVH_ENDPOINT || 'https://eu.api.ovh.com/1.0') + '/auth/time')).text();

  const payload = JSON.stringify({
    calledNumber:  called,
    callingNumber: VINCENT_MOBILE,
    // Leave intercom default (false) - visitor's phone rings normally
  });

  const toSign = [OVH_APP_SECRET, OVH_CONSUMER_KEY, 'POST', url, payload, timestamp].join('+');
  const signature = '$1$' + await sha1Hex(toSign);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Ovh-Application': OVH_APP_KEY,
      'X-Ovh-Timestamp':   timestamp,
      'X-Ovh-Signature':   signature,
      'X-Ovh-Consumer':    OVH_CONSUMER_KEY,
      'Content-Type':      'application/json',
    },
    body: payload,
  });

  if (res.ok) {
    // Fire-and-forget: we don't know if Vincent picks up. Visitor sees "calling you now".
    return json({ ok: true, message: 'ringing' });
  }

  const text = await res.text();
  return json({ error: 'ovh_failed', status: res.status, detail: text }, 502);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sha1Hex(input) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
