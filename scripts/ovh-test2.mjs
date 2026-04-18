import crypto from 'node:crypto';
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
async function ovh(method, urlPath, body='') {
  const url = env.OVH_ENDPOINT + urlPath;
  const timestamp = await (await fetch(env.OVH_ENDPOINT + '/auth/time')).text();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = '$1$' + crypto.createHash('sha1').update([env.OVH_APP_SECRET,env.OVH_CONSUMER_KEY,method,url,bodyStr,timestamp].join('+')).digest('hex');
  const res = await fetch(url, { method, headers: {'X-Ovh-Application':env.OVH_APP_KEY,'X-Ovh-Timestamp':timestamp,'X-Ovh-Signature':signature,'X-Ovh-Consumer':env.OVH_CONSUMER_KEY,'Content-Type':'application/json'}, body: bodyStr||undefined });
  const text = await res.text();
  let data; try{data=JSON.parse(text)}catch{data=text}
  return { status: res.status, data };
}
const base = `/telephony/${env.OVH_BILLING_ACCOUNT}/line/${env.OVH_SERVICE_NAME}`;
// Try 4 variants
const tests = [
  { label: 'A. national 0698860654',         body: { calleeNumber: '0698860654' } },
  { label: 'B. intl 0033698860654',          body: { calleeNumber: '0033698860654' } },
  { label: 'C. e164 +33698860654',           body: { calleeNumber: '+33698860654' } },
  { label: 'D. raw 698860654',               body: { calleeNumber: '698860654' } },
];
for (const t of tests) {
  const r = await ovh('POST', base + '/click2call', t.body);
  console.log(t.label, '→', r.status, JSON.stringify(r.data));
}
