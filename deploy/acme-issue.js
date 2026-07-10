'use strict';
// 纯 Node (零依赖) ACME 客户端：在服务器本地向 Let's Encrypt 申请证书。
// 用法: node acme-issue.js [staging|prod]   (默认 staging 便于先验证流程)
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STAGING = 'https://acme-staging-v02.api.letsencrypt.org/directory';
const PROD = 'https://acme-v02.api.letsencrypt.org/directory';
const MODE = process.argv[2] === 'prod' ? PROD : STAGING;
const DOMAIN = 'micro.fable5.icu';
const EMAIL = 'admin@fable5.icu';
const WEBROOT = 'C:/www/letsencrypt';
const CERTDIR = 'C:/www/certs';

let DIR = null;
let accountKey = null, accountJwk = null, accountUrl = null, thumbprint = null;
let certKey = null, certPubDer = null, certKeyPem = null;

function log(...a) { console.log('[' + new Date().toISOString() + ']', ...a); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- DER 编码辅助 ----------
function derLen(n) {
  if (n < 0x80) return Buffer.from([n]);
  const b = []; let x = n;
  while (x > 0) { b.unshift(x & 0xff); x = Math.floor(x / 256); }
  return Buffer.concat([Buffer.from([0x80 | b.length]), Buffer.from(b)]);
}
function seq(buf) { return Buffer.concat([Buffer.from([0x30]), derLen(buf.length), buf]); }
function setOf(buf) { return Buffer.concat([Buffer.from([0x31]), derLen(buf.length), buf]); }
function oid(str) {
  const p = str.split('.').map(Number);
  const first = p[0] * 40 + p[1]; const out = [first];
  for (let i = 2; i < p.length; i++) {
    let v = p[i]; const b = [];
    b.unshift(v & 0x7f); v = Math.floor(v / 128);
    while (v > 0) { b.unshift((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
    out.push(...b);
  }
  return Buffer.concat([Buffer.from([0x06]), derLen(out.length), Buffer.from(out)]);
}
function integer(buf) {
  let b = Buffer.from(buf);
  if ((b[0] & 0x80) !== 0) b = Buffer.concat([Buffer.from([0x00]), b]);
  return Buffer.concat([Buffer.from([0x02]), derLen(b.length), b]);
}
function bitString(buf) { return Buffer.concat([Buffer.from([0x03]), derLen(buf.length + 1), Buffer.from([0x00]), buf]); }
function octet(buf) { return Buffer.concat([Buffer.from([0x04]), derLen(buf.length), buf]); }
function ctx0(buf) { return Buffer.concat([Buffer.from([0xA0]), derLen(buf.length), buf]); }
function utf8str(s) { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([0x0C]), derLen(b.length), b]); }

// ---------- HTTP ----------
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(c) }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
async function getNonce() {
  const u = new URL(DIR.newNonce);
  const res = await request({ method: 'HEAD', hostname: u.hostname, path: u.pathname + (u.search || ''), headers: { 'User-Agent': 'acme-simple/1.0' } }, null);
  return res.headers['replay-nonce'];
}
async function postJws(url, payload, kid) {
  const nonce = await getNonce();
  const prot = { alg: 'RS256', nonce, url };
  if (kid) prot.kid = kid; else prot.jwk = accountJwk;
  const protB64 = b64url(JSON.stringify(prot));
  const payloadB64 = payload === null ? '' : b64url(Buffer.from(JSON.stringify(payload)));
  const signInput = protB64 + '.' + payloadB64;
  const sig = crypto.sign('sha256', Buffer.from(signInput), { key: accountKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  const body = JSON.stringify({ protected: protB64, payload: payloadB64, signature: b64url(sig) });
  const u = new URL(url);
  const res = await request({
    method: 'POST', hostname: u.hostname, path: u.pathname + (u.search || ''),
    headers: { 'Content-Type': 'application/jose+json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'acme-simple/1.0' }
  }, Buffer.from(body));
  return res;
}

// ---------- 构造 CSR (含 SAN) ----------
function buildCsr() {
  const spki = certPubDer;
  const rdn = setOf(seq(Buffer.concat([oid('2.5.4.3'), utf8str(DOMAIN)])));
  const sanName = Buffer.concat([Buffer.from([0x82, DOMAIN.length]), Buffer.from(DOMAIN, 'ascii')]);
  const sanSeq = seq(sanName);
  const sanExt = seq(Buffer.concat([oid('2.5.29.17'), octet(sanSeq)]));
  const extReq = seq(Buffer.concat([oid('1.2.840.113549.1.9.14'), setOf(seq(sanExt))]));
  const attrs = ctx0(setOf(extReq));
  const cri = seq(Buffer.concat([
    integer(Buffer.from([0])),
    seq(rdn),
    spki,
    attrs
  ]));
  const sigAlg = seq(Buffer.concat([oid('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00])]));
  const sig = crypto.sign('sha256', cri, { key: certKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  return seq(Buffer.concat([cri, sigAlg, bitString(sig)]));
}

(async () => {
  fs.mkdirSync(CERTDIR, { recursive: true });

  accountKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const pubJwk = crypto.createPublicKey(accountKey).export({ format: 'jwk' });
  accountJwk = { kty: 'RSA', n: pubJwk.n, e: pubJwk.e };
  thumbprint = b64url(crypto.createHash('sha256').update(JSON.stringify({ e: pubJwk.e, kty: 'RSA', n: pubJwk.n })).digest());

  certKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  certPubDer = crypto.createPublicKey(certKey).export({ type: 'spki', format: 'der' });
  certKeyPem = certKey.export({ type: 'pkcs1', format: 'pem' });

  log('Fetching directory', MODE);
  const du = new URL(MODE);
  const dres = await request({ method: 'GET', hostname: du.hostname, path: du.pathname + (du.search || ''), headers: { 'User-Agent': 'acme-simple/1.0' } }, null);
  DIR = JSON.parse(dres.body.toString());

  log('Creating account');
  let res = await postJws(DIR.newAccount, { termsOfServiceAgreed: true, contact: ['mailto:' + EMAIL] }, null);
  if (!res.headers.location) throw new Error('no account location: ' + res.body.toString());
  accountUrl = res.headers.location;
  log('Account', accountUrl);

  log('New order');
  res = await postJws(DIR.newOrder, { identifiers: [{ type: 'dns', value: DOMAIN }] }, accountUrl);
  const orderUrl = res.headers.location;
  const order = JSON.parse(res.body.toString());

  const authzUrl = order.authorizations[0];
  log('Authz', authzUrl);
  res = await postJws(authzUrl, null, accountUrl);
  const authz = JSON.parse(res.body.toString());
  const challenge = authz.challenges.find(c => c.type === 'http-01');
  const token = challenge.token;
  const keyAuth = token + '.' + thumbprint;
  const chalDir = path.join(WEBROOT, '.well-known', 'acme-challenge');
  fs.mkdirSync(chalDir, { recursive: true });
  fs.writeFileSync(path.join(chalDir, token), keyAuth);
  log('Wrote challenge file', token);

  log('Notify challenge');
  await postJws(challenge.url, {}, accountUrl);

  let st = 'pending';
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    res = await postJws(authzUrl, null, accountUrl);
    st = JSON.parse(res.body.toString()).status;
    log('authz status', st);
    if (st === 'valid' || st === 'invalid') break;
  }
  if (st !== 'valid') throw new Error('challenge failed: ' + st);

  log('Finalize');
  const csrDer = buildCsr();
  res = await postJws(order.finalize, { csr: b64url(csrDer) }, accountUrl);
  let o;
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    res = await postJws(orderUrl, null, accountUrl);
    o = JSON.parse(res.body.toString());
    log('order status', o.status);
    if (o.status === 'valid' || o.status === 'invalid') break;
  }
  if (o.status !== 'valid') throw new Error('order failed: ' + o.status);

  log('Download cert');
  res = await postJws(o.certificate, null, accountUrl);
  const pem = res.body.toString();
  fs.writeFileSync(path.join(CERTDIR, 'fullchain.pem'), pem);
  fs.writeFileSync(path.join(CERTDIR, 'privkey.pem'), certKeyPem);
  log('CERT WRITTEN ->', path.join(CERTDIR, 'fullchain.pem'));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
