// Carino Test — report exporters. Serialize the shared `report` snapshot to a
// downloadable JSON file, or paint it onto a canvas as a dark diagnostics card
// (no libraries — just 2D drawing) and download that PNG. Both read straight
// from state so the export always matches whatever the last run produced.

import { report } from './state.js';

// Trigger a browser download for a Blob via a throwaway <a>. Object URLs are
// revoked on the next tick so we don't leak them for the tab's lifetime.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const epoch = () => Math.floor(Date.now() / 1000);

// ---- JSON ----------------------------------------------------------------
export function exportJSON() {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `carino-test-${epoch()}.json`);
}

// ---- PNG -----------------------------------------------------------------
// Small helpers so an absent field never throws mid-paint — empty report must
// still render a well-formed (if dashed) card.
const val = (v) => (v == null || v === '' ? '—' : String(v));
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const fmtMs = (v) => { const n = num(v); return n == null ? '—' : Math.round(n) + ' ms'; };

// Reachability dot color: gold = up & responsive, white = up but slow, grey = down.
function dotColor(ok, ms) {
  if (!ok) return '#666666';
  return num(ms) != null && ms > 600 ? '#ffffff' : '#eab308';
}

export function exportPNG() {
  const W = 520;
  const pad = 24;
  const conn = report.connection || {};
  const speed = report.speed || {};
  const ping = report.ping || {};
  const dns = report.dns || {};
  const reach = report.reachability || {};
  const sites = Array.isArray(reach.sites) ? reach.sites : [];

  // ---- Layout pass: rows are described first so we can size the canvas,
  // then a single paint pass walks the same list. Each row has a fixed height.
  const H_TITLE = 40;
  const H_HEADER = 26;      // section header + hairline
  const H_LINE = 22;        // a normal text line
  const H_DOTROW = 20;      // a reachability entry
  const H_SECTION_GAP = 14;
  const H_FOOTER = 40;

  const rows = [];
  const push = (type, data, h) => rows.push({ type, data, h });

  push('title', null, H_TITLE);

  // CONNECTION
  push('header', 'CONNECTION', H_HEADER);
  push('kv', ['WAN IPv4', val(conn.wan4)], H_LINE);
  push('kv', ['WAN IPv6', val(conn.wan6)], H_LINE);
  push('kv', ['ISP', val(conn.isp)], H_LINE);
  push('kv', ['ASN', val(conn.asn)], H_LINE);
  push('kv', ['Geo', val(conn.geo)], H_LINE);
  push('kv', ['LAN IP', val(conn.lan)], H_LINE);
  push('kv', ['NAT type', val(conn.nat)], H_LINE);
  push('kv', ['Interfaces', val(conn.ifaces)], H_LINE);
  push('kv', ['WebRTC leak', val(conn.leak)], H_LINE);
  push('gap', null, H_SECTION_GAP);

  // LATENCY & THROUGHPUT
  push('header', 'LATENCY & THROUGHPUT', H_HEADER);
  push('kv', ['Download', num(speed.downMbps) != null ? speed.downMbps + ' Mbps' : '—'], H_LINE);
  push('kv', ['Ping (page)', fmtMs(ping.page)], H_LINE);
  push('kv', ['Jitter', fmtMs(ping.jitter)], H_LINE);
  push('kv', ['Min / Max', `${fmtMs(ping.min)} / ${fmtMs(ping.max)}`], H_LINE);
  push('kv', ['Latency under load', fmtMs(speed.latencyUnderLoad)], H_LINE);
  push('gap', null, H_SECTION_GAP);

  // DNS
  push('header', 'DNS', H_HEADER);
  push('kv', ['Summary', val(dnsSummaryText(dns.summary))], H_LINE);
  push('gap', null, H_SECTION_GAP);

  // REACHABILITY — every Top-50 site, full size.
  push('header', 'REACHABILITY — TOP 50', H_HEADER);
  push('kv', ['Summary', val(reachSummaryText(reach.summary))], H_LINE);
  for (const s of sites) push('dot', s, H_DOTROW);

  // ---- Compute height.
  let bodyH = 0;
  for (const r of rows) bodyH += r.h;
  const H = pad * 2 + bodyH + H_FOOTER;

  // ---- Canvas + HiDPI scaling.
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale);
  cv.height = Math.round(H * scale);
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);

  // Background + gold frame.
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(234,179,8,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  const GOLD = '#eab308';
  const GREY = '#8a8a8a';
  const WHITE = '#e5e5e5';
  const MONO = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

  let y = pad;

  for (const r of rows) {
    if (r.type === 'title') {
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = GOLD;
      ctx.font = "900 18px 'Red Hat Display', system-ui, sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText('CARINO TEST — DIAGNOSTICS', pad, y + 20);
      // ISO timestamp, grey mono, right-aligned.
      ctx.fillStyle = GREY;
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(new Date().toISOString(), W - pad, y + 18);
      ctx.textAlign = 'left';
    } else if (r.type === 'header') {
      ctx.fillStyle = GREY;
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(r.data.toUpperCase(), pad, y + 12);
      // hairline separator under header
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, y + 20.5);
      ctx.lineTo(W - pad, y + 20.5);
      ctx.stroke();
    } else if (r.type === 'kv') {
      const [k, v] = r.data;
      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.fillStyle = GREY;
      ctx.fillText(k, pad, y + 14);
      ctx.fillStyle = WHITE;
      ctx.textAlign = 'right';
      ctx.fillText(clip(ctx, v, W - pad * 2 - 140), W - pad, y + 14);
      ctx.textAlign = 'left';
    } else if (r.type === 'dot') {
      const s = r.data || {};
      const cy = y + 10;
      // status dot
      ctx.beginPath();
      ctx.fillStyle = dotColor(s.ok, s.ms);
      ctx.arc(pad + 4, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // name (left), ip + ms (right)
      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.fillStyle = WHITE;
      ctx.fillText(clip(ctx, val(s.name), 200), pad + 16, y + 14);
      ctx.fillStyle = GREY;
      ctx.textAlign = 'right';
      const right = `${val(s.ip)}   ${s.ok ? fmtMs(s.ms) : 'down'}`;
      ctx.fillText(right, W - pad, y + 14);
      ctx.textAlign = 'left';
    }
    // 'gap' rows just advance y.
    y += r.h;
  }

  // Footer — carino.systems, gold, centered.
  ctx.fillStyle = GOLD;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('carino.systems', W / 2, H - 18);
  ctx.textAlign = 'left';

  // toBlob is async; download once the raster is ready.
  cv.toBlob((blob) => {
    if (blob) downloadBlob(blob, `carino-test-${epoch()}.png`);
  }, 'image/png');
}

// Truncate text with an ellipsis so it fits within maxW px at the current font.
function clip(ctx, text, maxW) {
  let s = String(text == null ? '' : text);
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

// The DNS/reachability summaries are free-form objects across the fleet; prefer
// a prebuilt .text/.label, else stringify compactly, else dash.
function dnsSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return summary == null ? '—' : String(summary);
  if (summary.text) return summary.text;
  if (summary.label) return summary.label;
  const parts = [];
  // Fields actually written by runDNS(): { resolved, mismatch }.
  if (summary.resolved != null) parts.push(`${summary.resolved} resolved`);
  if (summary.mismatch != null) parts.push(`${summary.mismatch} mismatch`);
  return parts.length ? parts.join(' · ') : '—';
}

function reachSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return summary == null ? '—' : String(summary);
  if (summary.text) return summary.text;
  const parts = [];
  if (summary.up != null) parts.push(`${summary.up} up`);
  if (num(summary.median) != null) parts.push(`median ${Math.round(summary.median)} ms`);
  // runReachability() writes regionsUp, not regions.
  const regions = summary.regionsUp != null ? summary.regionsUp : summary.regions;
  if (regions != null) parts.push(`${regions} regions`);
  return parts.length ? parts.join(' · ') : '—';
}
