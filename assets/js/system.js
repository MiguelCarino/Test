// Carino Test — system / device detection. Everything here reads local browser
// APIs (no network), so failures are cheap: any probe that throws or is missing
// degrades to 'masked' / 'N/A' / '—' rather than blowing up the run.

import { setText } from './util.js';
import { report } from './state.js';

// ---- OS from the UA string ------------------------------------------------
function detectOS(ua) {
  // iOS reports "iPhone/iPad", but iPadOS 13+ masquerades as Mac with touch.
  if (/iPhone|iPod/.test(ua)) return 'iOS';
  if (/iPad/.test(ua)) return 'iPadOS';
  if (/Android[ /]?([\d.]+)?/.test(ua)) {
    const m = ua.match(/Android[ /]?([\d.]+)/);
    return 'Android' + (m ? ' ' + m[1] : '');
  }
  if (/Windows NT ([\d.]+)/.test(ua)) {
    const v = ua.match(/Windows NT ([\d.]+)/)[1];
    // Windows 11 shares NT 10.0 with 10; we can't tell them apart from the UA alone.
    const map = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    return 'Windows ' + (map[v] || v);
  }
  if (/Mac OS X ([\d_]+)/.test(ua)) {
    return 'macOS ' + ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, '.');
  }
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  // Linux distro sniff — best effort; most browsers just say "Linux".
  if (/Ubuntu/.test(ua)) return 'Ubuntu Linux';
  if (/Fedora/.test(ua)) return 'Fedora Linux';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

// ---- Browser + version ----------------------------------------------------
// Order matters: many browsers spoof "Chrome"/"Safari" tokens, so we test the
// most specific vendors first and fall back to the generic engines last.
async function detectBrowser(ua) {
  // Brave hides itself in the UA; only navigator.brave.isBrave() reveals it.
  try {
    if (navigator.brave && typeof navigator.brave.isBrave === 'function' && await navigator.brave.isBrave()) {
      const m = ua.match(/Chrome\/([\d.]+)/);
      return 'Brave' + (m ? ' ' + m[1] : '');
    }
  } catch { /* brave probe failed — carry on with UA sniffing */ }

  let m;
  if ((m = ua.match(/CriOS\/([\d.]+)/))) return 'Chrome ' + m[1] + ' (iOS)';
  if ((m = ua.match(/FxiOS\/([\d.]+)/))) return 'Firefox ' + m[1] + ' (iOS)';
  if ((m = ua.match(/Edg(?:iOS|A)?\/([\d.]+)/))) return 'Edge ' + m[1];
  if ((m = ua.match(/OPR\/([\d.]+)/))) return 'Opera ' + m[1];
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    m = ua.match(/Chrome\/([\d.]+)/);
    return 'Chrome ' + (m ? m[1] : '');
  }
  if ((m = ua.match(/Chromium\/([\d.]+)/))) return 'Chromium ' + m[1];
  if ((m = ua.match(/Firefox\/([\d.]+)/))) return 'Firefox ' + m[1];
  // Safari has no "Safari version" token — the real version lives in "Version/x".
  if (/Safari\//.test(ua)) {
    m = ua.match(/Version\/([\d.]+)/);
    return 'Safari' + (m ? ' ' + m[1] : '');
  }
  return 'Unknown';
}

// ---- CPU architecture -----------------------------------------------------
async function detectArch(ua) {
  // High-entropy UA-CH is the only reliable source; it's gated behind a promise
  // and only available on Chromium. Fall back to crude UA token matching.
  try {
    const uad = navigator.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
      const hev = await uad.getHighEntropyValues(['architecture', 'bitness']);
      if (hev && hev.architecture) {
        const bits = hev.bitness ? '-' + hev.bitness : '';
        return hev.architecture + bits;
      }
    }
  } catch { /* UA-CH unavailable or rejected */ }
  if (/arm64|aarch64/i.test(ua)) return 'arm64';
  if (/arm/i.test(ua)) return 'arm';
  if (/x86_64|Win64|WOW64|x64/i.test(ua)) return 'x64';
  if (/i686|i386|x86/i.test(ua)) return 'x86';
  return 'unknown';
}

// ---- GPU via WebGL debug renderer info ------------------------------------
// Firefox and privacy modes mask the renderer; treat that as "masked", not error.
function detectGPU() {
  let canvas, gl;
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch { gl = null; }
  if (!gl) return 'masked';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return cleanGPU(raw);
  } catch {
    return 'masked';
  } finally {
    // Free the GL context promptly; browsers cap the number of live contexts.
    try { const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch { /* ignore */ }
  }
}

// Chrome wraps the device string as "ANGLE (vendor, device, api)". Pull out the
// device (middle field) and drop driver noise so the label stays readable.
function cleanGPU(raw) {
  if (!raw) return 'masked';
  let s = String(raw).trim();
  const angle = s.match(/^ANGLE\s*\((.*)\)$/i);
  if (angle) {
    const parts = angle[1].split(',').map((p) => p.trim());
    // Prefer the device field (index 1); fall back to the whole inner string.
    s = parts[1] || parts[0] || angle[1];
  }
  // Trim trailing Direct3D/vs_5_0/driver-version cruft after the device name.
  s = s.replace(/\s*\((Direct3D|OpenGL|Vulkan|Metal)[^)]*\)\s*$/i, '');
  s = s.replace(/\s+Direct3D.*$/i, '').replace(/\s*\(0x[0-9A-Fa-f]+\)/g, '');
  return s.trim() || 'masked';
}

// ---- Battery --------------------------------------------------------------
async function detectBattery() {
  // getBattery is removed in Firefox and gated in some contexts — guard hard.
  try {
    if (typeof navigator.getBattery !== 'function') return 'N/A';
    const b = await navigator.getBattery();
    if (!b) return 'N/A';
    const pct = Math.round((b.level || 0) * 100) + '%';
    return pct + (b.charging ? ' (charging)' : ' (on battery)');
  } catch {
    return 'N/A';
  }
}

// ---- main -----------------------------------------------------------------
export async function detectSystem() {
  const ua = (navigator.userAgent || '');

  // Cheap synchronous fields first so the panel fills in immediately.
  const os = detectOS(ua);
  setText('sysOS', os);

  const cpu = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' threads' : 'masked';
  setText('sysCpu', cpu);

  const ram = navigator.deviceMemory ? '~' + navigator.deviceMemory + ' GB' : 'masked';
  setText('sysRam', ram);

  const gpu = detectGPU();
  setText('sysGpu', gpu);

  let screenStr = '—';
  try {
    const dpr = window.devicePixelRatio || 1;
    screenStr = (screen.width || '?') + ' x ' + (screen.height || '?') + ' @' + dpr + 'x';
  } catch { /* screen unavailable */ }
  setText('sysScreen', screenStr);

  let lang = 'masked';
  try {
    lang = navigator.language || 'masked';
    const n = (navigator.languages && navigator.languages.length) || 0;
    if (n > 1) lang += ' (+' + (n - 1) + ')';
  } catch { /* ignore */ }
  setText('sysLang', lang);

  let tz = 'masked';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'masked'; } catch { /* ignore */ }
  setText('sysTz', tz);

  // Async fields — resolve in parallel, tolerate individual failures.
  const [browser, arch, battery] = await Promise.all([
    detectBrowser(ua).catch(() => 'Unknown'),
    detectArch(ua).catch(() => 'unknown'),
    detectBattery().catch(() => 'N/A'),
  ]);

  setText('sysBrowser', browser);
  setText('sysArch', arch);
  setText('sysBattery', battery);

  report.system = { os, browser, arch, cpu, ram, gpu, screen: screenStr, battery, lang, tz, ua };
  return report.system;
}
