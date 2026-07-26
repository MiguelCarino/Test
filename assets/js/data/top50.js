// Carino Test — the top-50 most-visited websites in the world (consensus of
// Similarweb / Cloudflare Radar / Wikipedia-Tranco rankings, 2025-2026).
// Shape: { rank, name, host, region, note }.
//   host   = apex domain probed over HTTPS (https://host/favicon.ico).
//   region = drives the reachability rollup (Global/China/Russia/Japan/…).
//   note   = why its reachability is diagnostic (GFW/censorship/geo/CDN).
// Sites behind the Great Firewall or geo-walled read slow/unreachable from the
// West — that spread is the signal, not a bug. (Rank 43 substitutes Spotify for
// the adult site that charts there, to keep this SFW; swap it back if you want a
// literal traffic ranking.)
export const TOP50 = [
  { rank: 1,  name: 'Google',         host: 'google.com',     region: 'Global', note: 'censorship canary; GFW-blocked in China' },
  { rank: 2,  name: 'YouTube',        host: 'youtube.com',    region: 'Global', note: 'censorship canary; GFW-blocked in China' },
  { rank: 3,  name: 'Facebook',       host: 'facebook.com',   region: 'Global', note: 'censorship canary; GFW-blocked in China' },
  { rank: 4,  name: 'Instagram',      host: 'instagram.com',  region: 'Global', note: 'censorship canary; GFW-blocked in China' },
  { rank: 5,  name: 'X (Twitter)',    host: 'x.com',          region: 'Global', note: 'censorship canary; GFW-blocked in China' },
  { rank: 6,  name: 'WhatsApp',       host: 'whatsapp.com',   region: 'Global', note: 'GFW-blocked in China' },
  { rank: 7,  name: 'ChatGPT',        host: 'chatgpt.com',    region: 'Global', note: 'AI; geo-blocked in China' },
  { rank: 8,  name: 'Reddit',         host: 'reddit.com',     region: 'Global', note: 'GFW-blocked in China' },
  { rank: 9,  name: 'TikTok',         host: 'tiktok.com',     region: 'Global', note: 'unavailable in mainland China (Douyin serves CN)' },
  { rank: 10, name: 'Bing',           host: 'bing.com',       region: 'Global', note: 'reachable but censored in China' },
  { rank: 11, name: 'Wikipedia',      host: 'wikipedia.org',  region: 'Global', note: 'censorship canary; GFW-blocked in China' },
  { rank: 12, name: 'Amazon',         host: 'amazon.com',     region: 'US',     note: 'e-commerce/CDN; reachable in China' },
  { rank: 13, name: 'Yahoo',          host: 'yahoo.com',      region: 'US',     note: 'portal/CDN; reachable' },
  { rank: 14, name: 'LinkedIn',       host: 'linkedin.com',   region: 'Global', note: 'exited China 2023; GFW-blocked' },
  { rank: 15, name: 'Netflix',        host: 'netflix.com',    region: 'Global', note: 'not available in mainland China' },
  { rank: 16, name: 'Microsoft',      host: 'microsoft.com',  region: 'Global', note: 'CDN/services; reachable in China' },
  { rank: 17, name: 'Outlook / Live', host: 'live.com',       region: 'Global', note: 'Microsoft accounts; reachable' },
  { rank: 18, name: 'Pinterest',      host: 'pinterest.com',  region: 'Global', note: 'GFW-blocked in China' },
  { rank: 19, name: 'Baidu',          host: 'baidu.com',      region: 'China',  note: 'dominant China search; reachable from West' },
  { rank: 20, name: 'Yahoo Japan',    host: 'yahoo.co.jp',    region: 'Japan',  note: "Japan's top portal; geo-restricted outside JP" },
  { rank: 21, name: 'Yandex',         host: 'yandex.ru',      region: 'Russia', note: "Russia's top search/portal" },
  { rank: 22, name: 'Twitch',         host: 'twitch.tv',      region: 'Global', note: 'GFW-blocked in China' },
  { rank: 23, name: 'Naver',          host: 'naver.com',      region: 'Korea',  note: "Korea's top portal/search" },
  { rank: 24, name: 'Bilibili',       host: 'bilibili.com',   region: 'China',  note: 'China video; geo-restricts content outside CN' },
  { rank: 25, name: 'VK',             host: 'vk.com',         region: 'Russia', note: 'dominant Russia social network' },
  { rank: 26, name: 'Telegram',       host: 'telegram.org',   region: 'Global', note: 'censorship canary; blocked in China & at times Russia' },
  { rank: 27, name: 'Temu',           host: 'temu.com',       region: 'Global', note: 'PDD cross-border e-commerce' },
  { rank: 28, name: 'Samsung',        host: 'samsung.com',    region: 'Korea',  note: 'electronics; reachable globally' },
  { rank: 29, name: 'QQ / Tencent',   host: 'qq.com',         region: 'China',  note: 'major China portal; reachable from West' },
  { rank: 30, name: 'Apple',          host: 'apple.com',      region: 'Global', note: 'reachable in China' },
  { rank: 31, name: 'Discord',        host: 'discord.com',    region: 'Global', note: 'GFW-blocked in China & Russia' },
  { rank: 32, name: 'GitHub',         host: 'github.com',     region: 'Global', note: 'reachable but intermittently throttled in China' },
  { rank: 33, name: 'Taobao',         host: 'taobao.com',     region: 'China',  note: 'Alibaba C2C; geo/login-gated outside CN' },
  { rank: 34, name: 'Tmall',          host: 'tmall.com',      region: 'China',  note: 'Alibaba B2C; China-oriented' },
  { rank: 35, name: 'Claude',         host: 'claude.ai',      region: 'Global', note: 'AI; not available in China' },
  { rank: 36, name: 'JD.com',         host: 'jd.com',         region: 'China',  note: 'China e-commerce; reachable globally' },
  { rank: 37, name: 'Mail.ru',        host: 'mail.ru',        region: 'Russia', note: 'dominant Russia mail/portal' },
  { rank: 38, name: 'Canva',          host: 'canva.com',      region: 'Global', note: 'design SaaS' },
  { rank: 39, name: 'Weibo',          host: 'weibo.com',      region: 'China',  note: 'China microblog; geo-walls non-CN visitors' },
  { rank: 40, name: 'Dzen',           host: 'dzen.ru',        region: 'Russia', note: 'Russia news/content feed' },
  { rank: 41, name: 'Sohu',           host: 'sohu.com',       region: 'China',  note: 'China portal/news; reachable' },
  { rank: 42, name: '360',            host: '360.cn',         region: 'China',  note: 'Qihoo 360 security/search' },
  { rank: 43, name: 'Spotify',        host: 'spotify.com',    region: 'Global', note: 'music streaming; not in mainland China (SFW substitute)' },
  { rank: 44, name: 'Fandom',         host: 'fandom.com',     region: 'Global', note: 'wiki network/CDN' },
  { rank: 45, name: 'Cloudflare',     host: 'cloudflare.com', region: 'Global', note: 'CDN/infra edge; reachable' },
  { rank: 46, name: 'Globo',          host: 'globo.com',      region: 'LatAm',  note: 'dominant Brazil media portal' },
  { rank: 47, name: 'Bet.br',         host: 'bet.br',         region: 'LatAm',  note: 'Brazil regulated betting portal' },
  { rank: 48, name: 'Weather.com',    host: 'weather.com',    region: 'US',     note: 'weather; CDN' },
  { rank: 49, name: 'OpenAI',         host: 'openai.com',     region: 'Global', note: 'AI; geo-blocked in China' },
  { rank: 50, name: 'DuckDuckGo',     host: 'duckduckgo.com', region: 'Global', note: 'privacy search; GFW-blocked in China' },
];

// Distinct regions, in a stable order — used to populate the region filter.
export const REGIONS = ['Global', 'US', 'China', 'Russia', 'Japan', 'Korea', 'LatAm'];
