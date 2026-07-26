// Carino Test — shared report state. Every module writes its results here so the
// PNG/JSON export can serialize one coherent snapshot without scraping the DOM.

export const report = {
  startedAt: null,        // ISO string, set when a full run begins
  finishedAt: null,
  connection: {},         // { wan4, wan6, isp, asn, geo, lan, nat, ifaces, rtcPublic, leak }
  dns: { rows: [], summary: {} },
  ping: {},               // { page, min, max, jitter, samples }
  speed: {},              // { downMbps, connType, downlink, rtt, latencyUnderLoad }
  system: {},             // { os, browser, arch, cpu, ram, gpu, screen, battery, lang, tz, ua }
  reachability: { sites: [], summary: {} },  // sites: [{rank,name,host,region,ip,ms,ok}]
};

export function resetReport() {
  report.startedAt = new Date().toISOString();
  report.finishedAt = null;
  report.connection = {};
  report.dns = { rows: [], summary: {} };
  report.ping = {};
  report.speed = {};
  report.system = {};
  report.reachability = { sites: [], summary: {} };
}
