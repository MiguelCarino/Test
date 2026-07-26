// Carino Test — DNS-over-HTTPS cross-resolver comparison.
// Resolves a diverse host sample through both Cloudflare and Google DoH and
// checks whether the two resolvers agree, which surfaces DNS tampering,
// split-horizon answers, or CDN geo-steering differences.

import { $, el, resolveDoH } from './util.js';
import { report } from './state.js';

const SAMPLE = [
  'google.com', 'cloudflare.com', 'github.com', 'wikipedia.org',
  'baidu.com', 'yandex.ru', 'amazon.com', 'carino.systems',
];

// Resolve one host across both resolvers (A) plus Cloudflare AAAA, concurrently.
async function resolveOne(host) {
  const [cf, gg, v6] = await Promise.all([
    resolveDoH(host, { resolver: 'cloudflare', type: 'A' }),
    resolveDoH(host, { resolver: 'google', type: 'A' }),
    resolveDoH(host, { resolver: 'cloudflare', type: 'AAAA' }),
  ]);
  // A shared address between resolvers means they agree; disjoint sets differ.
  const match = (cf.ip && gg.ip)
    ? (cf.all.some((a) => gg.all.includes(a)) ? '✓' : '⚠ differ')
    : (cf.ip || gg.ip ? 'partial' : '—');
  return { host, cf, gg, v6, match };
}

export async function runDNS() {
  const tbody = $('dnsList');
  if (tbody) tbody.textContent = '';

  // Run every host concurrently, but keep SAMPLE order when we append rows so
  // Promise.all's completion order never reshuffles the table.
  const results = await Promise.all(SAMPLE.map(resolveOne));

  let resolved = 0;
  let mismatch = 0;

  results.forEach((res) => {
    if (res.cf.ip || res.gg.ip) resolved++;
    if (res.match === '⚠ differ') mismatch++;

    if (tbody) {
      const tr = el('tr');
      tr.appendChild(el('td', null, res.host));
      tr.appendChild(el('td', null, res.cf.ip || '—'));
      tr.appendChild(el('td', null, res.gg.ip || '—'));
      tr.appendChild(el('td', null, res.v6.ip || '—'));
      // Highlight disagreement; '✓' and matches stay neutral.
      const bad = res.match === '⚠ differ' || res.match === 'partial';
      tr.appendChild(el('td', bad ? 'bad' : null, res.match));
      tbody.appendChild(tr);
    }
  });

  const sum = $('dnsSummary');
  if (sum) sum.textContent = `${resolved}/${SAMPLE.length} resolved · ${mismatch} mismatch`;

  report.dns = {
    rows: results.map((r) => ({ host: r.host, cf: r.cf, gg: r.gg, v6: r.v6, match: r.match })),
    summary: { resolved, mismatch },
  };

  return report.dns;
}
