// Carino Test — latency & throughput module.
// Vanilla ES module, browser-only. Measures page ping (HEAD to self) and a
// coarse download-speed estimate from static test files, then reads the
// Network Information API for the browser's own view of the link.
import { setText, setDot, dotForLatency, median, fmtMs, probeHTTPS } from './util.js';
import { report } from './state.js';

const TEST_FILE_SMALL = 'https://raw.githubusercontent.com/MiguelCarino/Carino-Systems/refs/heads/main/assets/files/sample_1mb';
const TEST_FILE_LARGE = 'https://raw.githubusercontent.com/MiguelCarino/Carino-Systems/refs/heads/main/assets/files/sample_25mb';

// Population standard deviation — jitter is the spread of the ping samples.
function stddev(nums) {
  if (!nums.length) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nums.length;
  return Math.sqrt(variance);
}

// runPing — five HEAD requests to the current page, timed with performance.now().
// A HEAD with cache:'no-store' forces a fresh round-trip so we measure the
// network, not the disk cache. Any failure degrades to 'Timeout'.
export async function runPing() {
  setText('pingPage', '…');
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    try {
      await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
      samples.push(performance.now() - start);
    } catch {
      // one bad round-trip: skip this sample, keep collecting the rest
    }
  }

  if (!samples.length) {
    setText('pingPage', 'Timeout');
    setText('pingMinMax', '—');
    setText('pingJitter', '—');
    report.ping = { page: null, min: null, max: null, jitter: null, samples: [] };
    return report.ping;
  }

  const page = median(samples);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const jitter = Math.round(stddev(samples));

  setText('pingPage', fmtMs(page));
  setText('pingMinMax', `${fmtMs(min)} / ${fmtMs(max)}`);
  setText('pingJitter', fmtMs(jitter));

  report.ping = { page, min: Math.round(min), max: Math.round(max), jitter, samples: samples.map((s) => Math.round(s)) };
  return report.ping;
}

// Download one test file over GET, returning { bytes, seconds }.
async function timedDownload(url) {
  const start = performance.now();
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  return { bytes: blob.size, seconds: (performance.now() - start) / 1000 };
}

// runSpeed — coarse download throughput + latency-under-load + Net Info API.
// Browsers give us no raw-socket timing, so this is a single-stream estimate:
// wall-clock over a static file. Small file first; if it finished too fast to
// be meaningful (<0.5s) we re-run with the 25 MB file for a steadier number.
export async function runSpeed() {
  setText('dlSpeed', '…');
  let downMbps = null;

  try {
    let { bytes, seconds } = await timedDownload(TEST_FILE_SMALL);
    // A sub-half-second sample is dominated by connection setup jitter; the
    // larger file amortizes that overhead into a truer throughput figure.
    if (seconds < 0.5) {
      ({ bytes, seconds } = await timedDownload(TEST_FILE_LARGE));
    }
    const bps = seconds > 0 ? (bytes * 8) / seconds : 0;
    downMbps = bps / 1e6;
    setText('dlSpeed', downMbps >= 1 ? downMbps.toFixed(1) + ' Mbps' : (bps / 1000).toFixed(0) + ' Kbps');
  } catch {
    // Cross-origin/CORS/timeout: fall back to the browser's own estimate.
    const dl = navigator.connection && navigator.connection.downlink;
    if (typeof dl === 'number') {
      downMbps = dl;
      setText('dlSpeed', `~${dl} Mbps est`);
    } else {
      setText('dlSpeed', 'Error');
    }
  }

  // Latency under load: probe the origin right after the transfer, while any
  // buffers may still be draining, to surface bufferbloat.
  let latencyUnderLoad = null;
  setDot('dot-speed', 'scanning');
  try {
    latencyUnderLoad = await probeHTTPS(location.host);
    setText('speedLatencyLoad', fmtMs(latencyUnderLoad));
    setDot('dot-speed', dotForLatency(latencyUnderLoad, true));
  } catch {
    setText('speedLatencyLoad', '—');
    setDot('dot-speed', 'unknown');
  }

  // Network Information API — the browser's self-reported link class. Absent in
  // Firefox/Safari, so guard every field.
  const c = navigator.connection;
  const connType = (c && (c.effectiveType || c.type) || 'N/A');
  setText('connType', String(connType).toUpperCase());
  setText('connDownlinkRtt', c ? `${c.downlink ?? '?'} Mbps · ${c.rtt ?? '?'} ms` : 'N/A');

  report.speed = {
    downMbps,
    connType: String(connType).toUpperCase(),
    downlink: c ? (c.downlink ?? null) : null,
    rtt: c ? (c.rtt ?? null) : null,
    latencyUnderLoad,
  };
  return report.speed;
}
