// POST /api/call-me — triggers an OVH Click2Call bridge between Vincent and the visitor.
// Body: { name, phone, note?, 'cf-turnstile-response': token }
// Env: OVH_*, VINCENT_MOBILE, TURNSTILE_SECRET

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
    // Leave intercom default (false) — visitor's phone rings normally
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
