// Carino Test — Connection panel: WAN addresses, ISP/ASN/geo, and a WebRTC
// probe for LAN address / NAT type / interface count / IP-leak detection.
// Vanilla ES module, browser-only. Every network call is timed and guarded so
// a failure degrades to a grey/red dot, never an unhandled rejection.

import { setText, setDot, fetchJSON, tryAll, isFirefox } from './util.js';
import { report } from './state.js';

// ---- WebRTC / NAT probe (reference logic) --------------------------------
const STUN_SERVERS = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'];

// RFC1918 + link-local + CGNAT (100.64/10). Used to tell LAN IPs from public.
function _isPrivate(ip) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
}

// Gather ICE candidates. Modern browsers mask host IPs behind .local mDNS
// names, so we count those separately (as interfaces) but can't read them.
async function probeWebRTC(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const locals = new Set(), mdns = new Set(), publics = new Set(), ports = new Set();
    let pc, settled = false;
    const finish = () => {
      if (settled) return; settled = true;
      try { pc && pc.close(); } catch (e) { /* already closed */ }
      resolve({ locals: [...locals], mdns: mdns.size, ifaces: locals.size + mdns.size, publics: [...publics], ports: [...ports] });
    };
    try { pc = new RTCPeerConnection({ iceServers: STUN_SERVERS.map((urls) => ({ urls })) }); } catch (e) { return finish(); }
    try { pc.createDataChannel('probe'); } catch (e) { /* datachannel optional */ }
    pc.onicecandidate = (e) => {
      if (!e || !e.candidate) return finish();
      const parts = (e.candidate.candidate || '').split(' ');
      const addr = parts[4] || '', port = +parts[5] || 0, ti = parts.indexOf('typ'), typ = ti >= 0 ? parts[ti + 1] : '';
      if (/\.local$/i.test(addr)) { mdns.add(addr.toLowerCase()); return; }
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) return;
      if (typ === 'host') locals.add(addr);
      else if (typ === 'srflx' || typ === 'prflx') { publics.add(addr); if (port) ports.add(port); }
    };
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(finish);
    setTimeout(finish, timeoutMs);
  });
}

// Infer NAT behaviour from the candidate set (a coarse heuristic, not a full
// RFC5780 test — that needs a second STUN server pair we don't run here).
function classifyNAT(r) {
  if (!r.publics.length) return { txt: r.ifaces ? 'UDP blocked' : 'Hidden', ok: false };
  if (r.locals.some((ip) => !_isPrivate(ip) && r.publics.includes(ip))) return { txt: 'Open — no NAT', ok: true };
  if (r.publics.length > 1) return { txt: 'Symmetric (multi-WAN)', ok: true };
  if (r.ports.length > 1) return { txt: 'Symmetric NAT', ok: true };
  return { txt: 'Cone NAT', ok: true };
}

// ---- main ----------------------------------------------------------------
export async function runConnection() {
  // 1. Everything starts in the scanning (pulsing) state.
  ['dot-wan4', 'dot-wan6', 'dot-lan', 'dot-nat', 'dot-ifaces', 'dot-leak'].forEach((id) => setDot(id, 'scanning'));

  const c = report.connection = { wan4: null, wan6: null, isp: null, asn: null, geo: null, lan: null, nat: null, ifaces: null, rtcPublic: null, leak: null };

  // 2. WAN IPv4 — several providers so one CORS/outage doesn't blank the panel.
  try {
    const ip = await tryAll([
      () => fetchJSON('https://api4.ipify.org?format=json').then((j) => j.ip),
      () => fetchJSON('https://api.ipify.org?format=json').then((j) => j.ip),
      () => fetchJSON('https://ipapi.co/json/').then((j) => j.ip),
    ]);
    c.wan4 = ip;
    setText('wan4', ip); setDot('dot-wan4', 'success');
  } catch (e) {
    setText('wan4', 'Unavailable'); setDot('dot-wan4', 'fail');
  }

  // 3. WAN IPv6 — often absent. Firefox blocks the IPv6-only ipify hosts, so a
  //    failure there is "blocked by browser" rather than a real network fault.
  try {
    const ip6 = await tryAll([
      () => fetchJSON('https://api6.ipify.org?format=json').then((j) => j.ip),
      () => fetchJSON('https://api64.ipify.org?format=json').then((j) => j.ip),
    ]);
    c.wan6 = ip6;
    setText('wan6', ip6); setDot('dot-wan6', 'success');
  } catch (e) {
    setText('wan6', isFirefox() ? 'Blocked by browser' : 'Not detected'); setDot('dot-wan6', 'unknown');
  }

  // 4. ISP / ASN / Geo from a single ipapi lookup. All optional → 'Unavailable'.
  try {
    const d = await fetchJSON('https://ipapi.co/json/');
    const isp = (d.org || '').replace(/^AS\d+\s+/, '') || '—';
    const asn = d.asn || '—';
    const geo = [d.city, d.region, d.country_name].filter(Boolean).join(', ') || '—';
    c.isp = isp; c.asn = asn; c.geo = geo;
    setText('isp', isp); setText('asn', asn); setText('geo', geo);
  } catch (e) {
    setText('isp', 'Unavailable'); setText('asn', '—'); setText('geo', 'Unavailable');
  }

  // 5. WebRTC probe → LAN address, NAT type, interface count, leak check.
  const r = await probeWebRTC();

  // LAN: prefer a real private host IP; fall back to whatever host we saw. If
  // the browser masked everything behind mDNS, we genuinely can't read it.
  const lan = r.locals.find(_isPrivate) || r.locals[0] || null;
  if (lan) {
    c.lan = lan;
    setText('lanip', lan); setDot('dot-lan', 'success');
  } else {
    c.lan = null;
    setText('lanip', 'mDNS masked'); setDot('dot-lan', 'unknown');
  }

  // NAT classification.
  const nat = classifyNAT(r);
  c.nat = nat.txt;
  setText('natType', nat.txt); setDot('dot-nat', nat.ok ? 'success' : 'unknown');

  // Interfaces: host + mDNS candidate count is a proxy for active NICs/VPNs.
  c.ifaces = r.ifaces;
  setText('ifaces', r.ifaces + ' iface(s)'); setDot('dot-ifaces', r.ifaces >= 1 ? 'success' : 'unknown');

  // Leak check: the WebRTC-reported public IP should equal the WAN IPv4 we
  // fetched over HTTPS. A mismatch means a VPN/proxy split-tunnel or a WebRTC
  // leak revealing the real address; no srflx candidate means it's hidden.
  const rtc = r.publics[0] || null;
  c.rtcPublic = rtc;
  if (!rtc) {
    c.leak = 'hidden';
    setText('rtcLeak', 'hidden'); setDot('dot-leak', 'unknown');
  } else if (!c.wan4) {
    // We have a WebRTC public IP but no WAN baseline to compare it against
    // (the HTTPS IP APIs all failed) — can't call it a leak, so treat as hidden.
    c.leak = 'hidden';
    setText('rtcLeak', 'no WAN baseline'); setDot('dot-leak', 'unknown');
  } else if (rtc === c.wan4) {
    c.leak = 'matches WAN';
    setText('rtcLeak', 'matches WAN'); setDot('dot-leak', 'success');
  } else {
    c.leak = 'leak';
    setText('rtcLeak', 'LEAK ⚠ ' + rtc); setDot('dot-leak', 'fail');
  }

  // 6. One-line roll-up under the panel.
  setText('connExtra', 'NAT: ' + nat.txt + ' · ' + r.ifaces + ' iface' + (r.ifaces === 1 ? '' : 's'));

  return c;
}
