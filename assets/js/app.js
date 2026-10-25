// Carino Test — orchestrator. Imports every diagnostics module, wires the
// controls, and runs a full sweep with a weighted progress bar. ES module.
import { $, setKey, t } from './util.js';
import { report, resetReport } from './state.js';
import { runConnection } from './net.js';
import { runDNS } from './dns.js';
import { runPing, runSpeed, skipSpeed } from './speed.js';
import { detectSystem } from './system.js';
import { initReach, runReachability } from './reach.js';
import { exportPNG, exportJSON } from './export.js';

let running = false;

// Results are a snapshot, not a feed: after this long the stamp turns amber and
// says how old they are, so a tab left open is not read as the line right now.
const STALE_MS = 10 * 60 * 1000;

function setProgress(frac, key, vars) {
  const bar = $('overallProgress');
  if (bar) bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  if (key != null) setKey('runStamp', key, vars);
}

// The navbar's source chip: grey before and during a run, green once the
// browser has measured, red when nothing at all answered (an error, never
// an empty result).
function setChip(cls, key) {
  const chip = $('srcChip');
  if (!chip) return;
  chip.className = 'live-chip' + (cls ? ' ' + cls : '');
  setKey(chip, key);
}

// "Ran 17:52:10", and once it is old, how old.
function renderStamp() {
  const stamp = $('runStamp');
  if (!stamp || running || !report.finishedAt) return;
  const at = new Date(report.finishedAt);
  const age = Date.now() - at.getTime();
  const time = at.toLocaleTimeString();
  const stale = age > STALE_MS;
  const cls = 'fresh' + (stale ? ' stale' : '');
  if (stamp.className !== cls) stamp.className = cls;
  if (stale) setKey(stamp, 'Ran {time} · {n} min ago', { time, n: Math.round(age / 60000) });
  else setKey(stamp, 'Ran {time}', { time });
  stamp.title = stale ? t('These results are old. Run the tests again for current numbers.') : '';
}

async function runAll({ auto = false } = {}) {
  if (running) return;
  running = true;
  const btn = $('runAll');
  if (btn) btn.disabled = true;
  resetReport();
  setChip('', 'Testing…');
  $('runStamp').className = 'fresh';
  $('progressWrap').hidden = false;
  setProgress(0, 'starting…');

  // A) Independent quick probes — run concurrently, bump progress as each settles.
  // (Speed is deliberately NOT here: it saturates the link and would skew the
  // reachability latencies, so it runs alone afterwards.)
  const quick = [
    ['system', detectSystem],
    ['connection', runConnection],
    ['DNS', runDNS],
    ['ping', runPing],
  ];
  let done = 0;
  await Promise.all(quick.map(([name, fn]) =>
    Promise.resolve().then(fn).catch((e) => console.warn(name, e)).finally(() => {
      done++;
      setProgress(0.05 + 0.30 * (done / quick.length), '{name} ✓', { name: t(name) });
    })
  ));

  // B) Throughput — on its own so it doesn't distort the sweep below. The
  // automatic first run respects the browser's data saver: no 25 MB download
  // nobody asked for.
  const saver = !!(navigator.connection && navigator.connection.saveData);
  if (auto && saver) {
    skipSpeed();
  } else {
    setProgress(0.36, 'speed test…');
    await runSpeed().catch((e) => console.warn('speed', e));
  }

  // C) The main event: reachability sweep of the top 50 (0.50 → 1.00).
  setProgress(0.50, 'reachability…');
  await runReachability((d, total, up) => {
    setProgress(0.50 + 0.50 * (d / total), 'reachability {d}/{total} · {up} up', { d, total, up });
  }).catch((e) => console.warn('reachability', e));

  report.finishedAt = new Date().toISOString();
  setProgress(1, null);
  $('progressWrap').hidden = true;
  const up = report.reachability && report.reachability.summary && report.reachability.summary.up;
  if (up) setChip('live', 'This browser');
  else setChip('err', 'No connection');
  running = false;
  renderStamp();
  if (btn) btn.disabled = false;
}

// ---- wire up ------------------------------------------------------------
const runBtn = $('runAll');
if (runBtn) runBtn.addEventListener('click', () => runAll());
const pngBtn = $('exportPng');
if (pngBtn) pngBtn.addEventListener('click', () => { try { exportPNG(); } catch (e) { console.warn('exportPNG', e); } });
const jsonBtn = $('exportJson');
if (jsonBtn) jsonBtn.addEventListener('click', () => { try { exportJSON(); } catch (e) { console.warn('exportJSON', e); } });
setInterval(renderStamp, 30000);

initReach();          // builds the 50 table rows + wires search / filter / sort
runAll({ auto: true }); // autorun on load
