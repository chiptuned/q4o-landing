// Quick OVH auth + Click2Call availability test.
// Reads .env.local, hits three endpoints:
//   1. GET /me                                      → proves auth works
//   2. GET /telephony/{account}/line/{service}      → proves the line is reachable
//   3. GET /telephony/{account}/line/{service}/click2call → proves Click2Call is enabled on this tier
// Run: node scripts/ovh-auth-test.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const {
  OVH_ENDPOINT, OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY,
  OVH_BILLING_ACCOUNT, OVH_SERVICE_NAME,
} = env;

async function ovh(method, path, body = '') {
  const url = OVH_ENDPOINT + path;
  // OVH wants server time for signature to avoid clock drift issues.
  const timeRes = await fetch(OVH_ENDPOINT + '/auth/time');
  const timestamp = await timeRes.text();
  const bodyStr = body ? JSON.stringify(body) : '';
  const toSign = [
    OVH_APP_SECRET,
    OVH_CONSUMER_KEY,
    method,
    url,
    bodyStr,
    timestamp,
  ].join('+');
  const signature = '$1$' + crypto.createHash('sha1').update(toSign).digest('hex');
  const res = await fetch(url, {
    method,
    headers: {
      'X-Ovh-Application': OVH_APP_KEY,
      'X-Ovh-Timestamp': timestamp,
      'X-Ovh-Signature': signature,
      'X-Ovh-Consumer': OVH_CONSUMER_KEY,
      'Content-Type': 'application/json',
    },
    body: bodyStr || undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

// Our Consumer Key only grants POST /click2call — GETs would 403.
// So we validate by actually POSTing. Self-ring: caller=callee=Vincent's mobile.
// His phone rings once; the "second leg" either also rings or OVH returns
// a graceful same-number error. Either way, we learn if Click2Call is enabled.

console.log(`\n=== POST /telephony/${OVH_BILLING_ACCOUNT}/line/${OVH_SERVICE_NAME}/click2call ===`);
console.log('Payload: calleeNumber =', env.VINCENT_MOBILE, '(self-ring)');
console.log('→ your phone should ring in a few seconds\n');

const c2c = await ovh(
  'POST',
  `/telephony/${OVH_BILLING_ACCOUNT}/line/${OVH_SERVICE_NAME}/click2call`,
  { calleeNumber: env.VINCENT_MOBILE }
);
console.log('status:', c2c.status);
console.log('response:', c2c.data);

if (c2c.ok) {
  console.log('\n✓ Click2Call is enabled. Auth works. We can build the Worker.');
} else if (c2c.status === 404) {
  console.log('\n→ 404: Click2Call is not enabled on this line tier.');
  console.log('  Fix: upgrade Individual→Pro in OVH Manager for this line.');
} else if (c2c.status === 403) {
  console.log('\n→ 403: Consumer Key lacks permission for this exact path.');
  console.log('  Fix: regenerate Consumer Key with rights: POST /telephony/*/line/*/click2call');
} else if (c2c.status === 400) {
  console.log('\n→ 400: Bad request. Likely the line needs a forwarding config');
  console.log('  (OVH Manager → Telephony → line → Phone/Redirect → set to', env.VINCENT_MOBILE, ')');
  console.log('  OR the line needs activation beyond KYC.');
}
console.log();
