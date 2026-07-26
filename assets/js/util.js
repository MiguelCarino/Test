// Carino Test — shared utilities used by every diagnostics module.
// Vanilla ES module, no build step. Browser-only APIs.

export const SLOW_MS = 600;   // above this a reachable target is "slow" (white dot) instead of responsive (gold)

// ---- DOM helpers ---------------------------------------------------------
export const $ = (id) => document.getElementById(id);

export function setText(id, text) {
  const e = $(id);
  if (e) e.textContent = text == null ? '' : String(text);
}

// Status dot: cls in success | slow | fail | unknown | scanning.
export function setDot(id, cls) {
  const e = $(id);
  if (e) e.className = 'dot ' + cls;
}

// Map a measured latency (ms) or a failure to a dot class.
export function dotForLatency(ms, ok) {
  if (!ok) return 'unknown';
  return ms > SLOW_MS ? 'slow' : 'success';
}

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}

// ---- number / format helpers --------------------------------------------
export function median(nums) {
  const a = nums.filter((n) => typeof n === 'number' && isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}
export function minOf(nums) { const a = nums.filter((n) => isFinite(n)); return a.length ? Math.min(...a) : null; }
export function maxOf(nums) { const a = nums.filter((n) => isFinite(n)); return a.length ? Math.max(...a) : null; }
export function fmtMs(ms) { return ms == null ? '—' : Math.round(ms) + ' ms'; }

// ---- network helpers -----------------------------------------------------
// JSON fetch with timeout (CORS). Throws on non-2xx or timeout.
export async function fetchJSON(url, { timeoutMs = 5000, headers } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store', signal: ctrl.signal, headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

// Try each async getter in order; return the first that resolves, else throw.
export async function tryAll(getters) {
  const errs = [];
  for (const g of getters) {
    try { return await g(); } catch (e) { errs.push(e && e.message || String(e)); }
  }
  throw new Error(errs.join(' | '));
}

// HTTPS reachability probe: a no-cors fetch resolves opaquely when the host
// answers over TLS and rejects otherwise, so we learn up/down + latency only
// (never the HTTP status). Returns rounded ms on success; throws on failure.
export async function probeHTTPS(host, { timeoutMs = 6000, path = '/favicon.ico' } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    await fetch(`https://${host}${path}`, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return Math.round(performance.now() - start);
  } finally { clearTimeout(t); }
}

// DNS-over-HTTPS resolution. resolver: 'cloudflare' | 'google'. type: 'A' | 'AAAA'.
// Returns { ip, all, ms } or { ip: null, all: [], ms } on failure/no-answer.
const DOH = {
  cloudflare: (host, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
  google: (host, type) => `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${type}`,
};
export async function resolveDoH(host, { type = 'A', resolver = 'cloudflare', timeoutMs = 5000 } = {}) {
  const wanted = type === 'AAAA' ? 28 : 1;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    const r = await fetch(DOH[resolver](host, type), {
      headers: { accept: 'application/dns-json' }, cache: 'no-store', signal: ctrl.signal,
    });
    const j = await r.json();
    const all = ((j && j.Answer) || []).filter((x) => x.type === wanted).map((x) => x.data);
    return { ip: all[0] || null, all, ms: Math.round(performance.now() - start) };
  } catch (e) {
    return { ip: null, all: [], ms: Math.round(performance.now() - start), error: e && e.message || String(e) };
  } finally { clearTimeout(t); }
}

export const isFirefox = () => /Firefox\//.test(navigator.userAgent);
