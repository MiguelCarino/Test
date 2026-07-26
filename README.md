# Carino Test

A complete in-browser **network & system diagnostics** suite → **[test.carino.systems](https://test.carino.systems)**

Everything runs client-side. Nothing is uploaded; every probe fires from your own
browser and the results never leave the page (except the exports you download).

It's the full-size companion to the **Sys.Status** dropdown on
[carino.systems](https://carino.systems) — same probes, expanded, plus a live
reachability sweep of the **top 50 websites in the world**.

## What it measures

- **Connection** — WAN IPv4/IPv6, ISP / ASN / geo, and the WebRTC topology read:
  LAN IP (or the mDNS mask), NAT type (cone vs symmetric, via STUN port mapping),
  interface/path count, and a WebRTC-public-IP vs WAN cross-check that flags a
  VPN/proxy split-tunnel or WebRTC leak.
- **DNS over HTTPS** — the same names resolved through Cloudflare *and* Google
  DoH; a mismatch flags a hijack, split-horizon or geo-steered DNS.
- **Latency & throughput** — origin ping (min/median/max/jitter), a download
  speed test, latency under load, and the Network Information API estimate.
- **Top 50 reachability** — every site probed over HTTPS for name, resolved IP
  and latency, with a sortable/filterable table and per-region rollups. Sites
  behind the Great Firewall or hosted far away read slow (white) or unreachable
  (grey) from your location — that spread is the diagnostic signal, not a bug.
- **System & hardware** — OS, browser, architecture, CPU threads, memory, GPU,
  display, battery, language and time zone.

Export the whole run as a **PNG** report card or a **JSON** dump.

## How the probing works (and its limits)

A browser can't send ICMP, so "latency" is an HTTPS handshake+response time, and
reachability is a `no-cors` fetch that resolves opaquely when a host answers over
TLS and rejects otherwise — up/down + latency only, never the HTTP status. Local
topology comes from WebRTC ICE candidates (host = interfaces, often mDNS-masked;
srflx = the WAN mapping via STUN). These are the honest ceilings of the sandbox.

## Structure

No build step — vanilla ES modules loaded straight from `assets/js/`:

| module | role |
|---|---|
| `data/top50.js` | the ranked site list |
| `util.js` / `state.js` | shared helpers + the report snapshot |
| `net.js` | WAN + WebRTC/NAT/leak |
| `dns.js` | dual-resolver DoH compare |
| `speed.js` | ping + throughput |
| `system.js` | hardware/browser detection |
| `reach.js` | the top-50 sweep + table |
| `export.js` | PNG / JSON export |
| `app.js` | orchestration + progress |

## License

Copyright © 2026 Miguel Carino.
