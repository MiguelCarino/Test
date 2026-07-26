// Carino Test — orchestrator. Imports every diagnostics module, wires the
// controls, and runs a full sweep with a weighted progress bar. ES module.
import { $, setText } from './util.js';
import { report, resetReport } from './state.js';
import { runConnection } from './net.js';
import { runDNS } from './dns.js';
import { runPing, runSpeed } from './speed.js';
import { detectSystem } from './system.js';
import { initReach, runReachability } from './reach.js';
import { exportPNG, exportJSON } from './export.js';

let running = false;

function setProgress(frac, label) {
  const bar = $('overallProgress');
  if (bar) bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  if (label != null) setText('overallStatus', label);
}

async function runAll() {
  if (running) return;
  running = true;
  const btn = $('runAll');
  if (btn) btn.disabled = true;
  resetReport();
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
      setProgress(0.05 + 0.30 * (done / quick.length), `${name} ✓`);
    })
  ));

  // B) Throughput — on its own so it doesn't distort the sweep below.
  setProgress(0.36, 'speed test…');
  await runSpeed().catch((e) => console.warn('speed', e));

  // C) The main event: reachability sweep of the top 50 (0.50 → 1.00).
  setProgress(0.50, 'reachability…');
  await runReachability((d, total, up) => {
    setProgress(0.50 + 0.50 * (d / total), `reachability ${d}/${total} · ${up} up`);
  }).catch((e) => console.warn('reachability', e));

  report.finishedAt = new Date().toISOString();
  setProgress(1, 'complete');
  if (btn) btn.disabled = false;
  running = false;
}

// ---- wire up ------------------------------------------------------------
const runBtn = $('runAll');
if (runBtn) runBtn.addEventListener('click', runAll);
const pngBtn = $('exportPng');
if (pngBtn) pngBtn.addEventListener('click', () => { try { exportPNG(); } catch (e) { console.warn('exportPNG', e); } });
const jsonBtn = $('exportJson');
if (jsonBtn) jsonBtn.addEventListener('click', () => { try { exportJSON(); } catch (e) { console.warn('exportJSON', e); } });

initReach();   // builds the 50 table rows + wires search / filter / sort
runAll();      // autorun on load
