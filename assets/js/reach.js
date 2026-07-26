// Carino Test — global reachability sweep. Probes the top-50 sites over HTTPS
// (no-cors opaque fetch, so we learn up/down + latency only, never content) and
// rolls the results up by region. Sites behind the GFW or geo-walls read slow or
// down from the West — that spread is the diagnostic signal.
import {
  $, setText, el, dotForLatency, fmtMs, median, minOf, maxOf,
  probeHTTPS, resolveDoH, SLOW_MS,
} from './util.js';
import { report } from './state.js';
import { TOP50, REGIONS } from './data/top50.js';

// Module-level per-site state. cells holds the live <td>/<span> refs so the sweep
// and the sort/filter wiring mutate the same nodes without rebuilding the table.
const rows = [];
const IPV4 = /^\d+\.\d+\.\d+\.\d+$/;

// Current sort so re-sorting a fresh field defaults to ascending.
let sortField = 'rank';
let sortDir = 1; // 1 asc, -1 desc

// ---- initReach: build the static table + wire filters/sort ---------------
export function initReach() {
  // Region dropdown: keep the existing 'all regions' option, append one per region.
  const sel = $('reachRegionFilter');
  if (sel) {
    for (const r of REGIONS) {
      const o = el('option', null, r);
      o.value = r;
      sel.appendChild(o);
    }
  }

  // Build the 50 rows now, status unknown. Column order matches the thead:
  // rank, status, name, host, ip, latency, region.
  const body = $('reachTableBody');
  rows.length = 0;
  for (const site of TOP50) {
    const tr = document.createElement('tr');

    const rankTd = el('td', 'num', String(site.rank));

    const statusTd = el('td');
    const dot = el('span', 'dot unknown');
    statusTd.appendChild(dot);

    const nameTd = el('td', null, site.name);
    const hostTd = el('td', null, site.host);          // textContent only — never innerHTML with host
    const ipTd = el('td', 'ip', '—');
    const latTd = el('td', 'lat', '—');
    const regionTd = el('td', 'region', site.region);

    tr.appendChild(rankTd);
    tr.appendChild(statusTd);
    tr.appendChild(nameTd);
    tr.appendChild(hostTd);
    tr.appendChild(ipTd);
    tr.appendChild(latTd);
    tr.appendChild(regionTd);
    if (body) body.appendChild(tr);

    rows.push({
      site, ip: null, ms: null, ok: false, tr,
      cells: { rank: rankTd, dot, name: nameTd, host: hostTd, ip: ipTd, lat: latTd, region: regionTd },
    });
  }

  // Filtering: search (name+host+region substring) combined with region select.
  const search = $('reachSearch');
  if (search) search.addEventListener('input', applyFilter);
  if (sel) sel.addEventListener('change', applyFilter);

  // Sorting: click a th[data-sort] to sort by that field, toggling asc/desc.
  const table = $('reachTable');
  if (table) {
    const heads = table.querySelectorAll('thead th[data-sort]');
    heads.forEach((th) => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (field === sortField) sortDir = -sortDir;
        else { sortField = field; sortDir = 1; }
        // Reflect state on the header cells.
        heads.forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
        applySort();
      });
    });
  }
}

// Combined search + region filter: toggle .hidden on each row.
function applyFilter() {
  const q = ($('reachSearch')?.value || '').toLowerCase().trim();
  const region = $('reachRegionFilter')?.value || 'all';
  for (const r of rows) {
    const hay = (r.site.name + ' ' + r.site.host + ' ' + r.site.region).toLowerCase();
    const matchQ = !q || hay.includes(q);
    const matchR = region === 'all' || r.site.region === region;
    r.tr.classList.toggle('hidden', !(matchQ && matchR));
  }
}

// Sort key per field. Unreachable ms sorts last regardless of direction feel by
// mapping null to +Infinity; status orders up(0) before down(1).
function sortKey(r, field) {
  switch (field) {
    case 'rank': return r.site.rank;
    case 'ms': return r.ms == null ? Infinity : r.ms;
    case 'status': return r.ok ? 0 : 1;
    case 'name': return r.site.name.toLowerCase();
    case 'host': return r.site.host.toLowerCase();
    case 'ip': return (r.ip || '').toLowerCase();
    case 'region': return r.site.region.toLowerCase();
    default: return r.site.rank;
  }
}

function applySort() {
  const sorted = rows.slice().sort((a, b) => {
    // Unreachable sites pin to the bottom in BOTH directions (never sort a "down"
    // row above a reachable one just because the direction flipped).
    if (sortField === 'ms') {
      const an = a.ms == null, bn = b.ms == null;
      if (an && bn) return a.site.rank - b.site.rank;
      if (an) return 1;
      if (bn) return -1;
    }
    const ka = sortKey(a, sortField), kb = sortKey(b, sortField);
    if (ka < kb) return -1 * sortDir;
    if (ka > kb) return 1 * sortDir;
    return a.site.rank - b.site.rank; // stable tiebreak by rank
  });
  const body = $('reachTableBody');
  if (body) for (const r of sorted) body.appendChild(r.tr); // re-append in new order
}

// ---- runReachability: sweep all 50 with a concurrency pool ---------------
export async function runReachability(onProgress) {
  let done = 0;
  let upCount = 0;

  async function probeSite(r) {
    const { site } = r;
    r.cells.dot.className = 'dot scanning';

    // Resolve the IP: literal IPv4 hosts pass through, everything else via DoH.
    if (IPV4.test(site.host)) {
      r.ip = site.host;
    } else {
      try {
        const res = await resolveDoH(site.host);
        r.ip = res.ip || null;
      } catch { r.ip = null; }
    }
    r.cells.ip.textContent = r.ip || 'no DNS';

    // Latency: an opaque HTTPS probe tells us up/down + round-trip only.
    try {
      const ms = await probeHTTPS(site.host, { timeoutMs: 5000 });
      r.ms = ms;
      r.ok = true;
      upCount++;
      r.cells.lat.textContent = fmtMs(ms);
      r.cells.lat.className = ms > SLOW_MS ? 'lat slow' : 'lat';
      r.cells.dot.className = 'dot ' + dotForLatency(ms, true);
    } catch {
      r.ms = null;
      r.ok = false;
      r.cells.lat.textContent = 'down';
      r.cells.lat.className = 'lat down';
      r.cells.dot.className = 'dot unknown';
    }

    done++;
    setText('reachCount', `${done} / 50`);
    onProgress?.(done, 50, upCount);
  }

  // Small fixed-size pool (12 workers) — no external libs. Each worker pulls the
  // next index until the queue drains.
  const POOL = 12;
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const i = next++;
      await probeSite(rows[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(POOL, rows.length) }, worker));

  // ---- summary rollup ----------------------------------------------------
  const okMs = rows.filter((r) => r.ok).map((r) => r.ms);
  const up = rows.filter((r) => r.ok).length;
  const med = median(okMs);
  const lo = minOf(okMs);
  const hi = maxOf(okMs);

  const upRegions = new Set(rows.filter((r) => r.ok).map((r) => r.site.region));
  const regionsUp = upRegions.size;

  setText('reachUp', `${up} / 50`);
  setText('reachMedian', fmtMs(med));
  setText('reachMin', fmtMs(lo));
  setText('reachMax', fmtMs(hi));
  setText('reachRegions', `${regionsUp} / ${REGIONS.length}`);

  report.reachability = {
    sites: rows.map((r) => ({
      rank: r.site.rank, name: r.site.name, host: r.site.host,
      region: r.site.region, ip: r.ip, ms: r.ms, ok: r.ok,
    })),
    summary: { up, median: med, min: lo, max: hi, regionsUp },
  };
}
