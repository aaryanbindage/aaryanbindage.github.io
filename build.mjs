// Builds the portfolio site into _site/ from the GitHub API, so new public repos show up automatically.
// Run: node build.mjs   (GITHUB_TOKEN optional, avoids rate limits)

import fs from 'node:fs';

const USER = 'aaryanbindage';
const SITE = `https://${USER}.github.io`;
const OUT = '_site';

const headers = { 'User-Agent': USER, Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SKIP = new Set([`${USER}.github.io`, USER, "scoop-twinbraid", "homebrew-twinbraid", "homebrew-tap"]);
const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner&sort=pushed`))
  .filter((r) => !r.fork && !r.private && !r.archived && !SKIP.has(r.name) && r.description);

// Projects with a live site first, then by stars, then most recently pushed.
repos.sort((a, b) => (!!b.homepage - !!a.homepage) || (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)));

const title = (r) => {
  const m = r.description.match(/^([^:]{2,40}):\s/);
  return m ? m[1] : r.name.replace(/[-_]+/g, ' ').trim();
};
const blurb = (r) => r.description.replace(/^([^:]{2,40}):\s/, '');
// Every project also gets its own page (README + structured data) so search engines index it on this domain.
const page = (r) => `${SITE}/p/${r.name.toLowerCase()}/`;

async function ghRaw(path, accept) {
  const res = await fetch(`https://api.github.com${path}`, { headers: { ...headers, Accept: accept } });
  return res.ok ? res.text() : null;
}

// Point the README's relative links and images back at the repo.
function absolutize(html, r) {
  const branch = r.default_branch;
  return html.replace(/\s(src|href)="(?!https?:|mailto:|#|data:|\/\/)\/?([^"]*)"/g, (_, attr, p) => {
    const base = attr === 'src' ? `https://raw.githubusercontent.com/${r.full_name}/${branch}/` : `${r.html_url}/blob/${branch}/`;
    return ` ${attr}="${new URL(p, base)}"`;
  });
}

const cards = repos.map((r) => {
  const topics = (r.topics || []).slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join('');
  const live = r.homepage ? `<a class="live" href="${esc(r.homepage)}">Open ↗</a>` : '';
  return `<article>
  <h2><a href="${page(r)}">${esc(title(r))}</a></h2>
  <p>${esc(blurb(r))}</p>
  <ul class="tags">${topics}</ul>
  <footer>${r.language ? `<span>${esc(r.language)}</span>` : ''}${r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : ''}<span class="grow"></span><a href="${esc(r.html_url)}">Source</a>${live}</footer>
</article>`;
}).join('\n');

const ld = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  mainEntity: { '@type': 'Person', name: USER, url: SITE, sameAs: [`https://github.com/${USER}`] },
  hasPart: repos.map((r) => ({
    '@type': 'SoftwareSourceCode',
    name: title(r),
    description: r.description,
    codeRepository: r.html_url,
    programmingLanguage: r.language || undefined,
    keywords: (r.topics || []).join(', ') || undefined,
    url: r.homepage || r.html_url,
  })),
};

const desc = `Open-source projects by ${USER}: ${repos.slice(0, 6).map(title).join(', ')} and more.`;

const STYLE = `:root{--bg:#f7f7f5;--card:#fff;--fg:#1b1b1f;--muted:#62626b;--line:#e3e3df;--accent:#5b4bdb;--tag:#efedff}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--card:#1b1b1f;--fg:#ececf1;--muted:#a0a0ab;--line:#2c2c33;--accent:#9d93ff;--tag:#2a2747}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
header.top{max-width:1080px;margin:0 auto;padding:56px 16px 24px}
header.top h1{margin:0 0 6px;font-size:clamp(28px,5vw,40px);letter-spacing:-.02em}
header.top p{margin:0;color:var(--muted);max-width:60ch}
header.top a{color:var(--accent)}
main{max-width:1080px;margin:0 auto;padding:8px 16px 64px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 18px 14px;display:flex;flex-direction:column}
article h2{margin:0 0 6px;font-size:18px}
article h2 a{color:inherit;text-decoration:none}
article h2 a:hover{color:var(--accent)}
article p{margin:0 0 12px;color:var(--muted);font-size:14.5px;flex:1}
.tags{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.tags li{background:var(--tag);color:var(--accent);font-size:12px;padding:2px 8px;border-radius:999px}
article footer{display:flex;gap:12px;align-items:center;font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
article footer a{color:var(--accent);text-decoration:none;font-weight:600}
.grow{flex:1}
.live{background:var(--accent);color:#fff!important;padding:3px 10px;border-radius:8px}
@media (prefers-color-scheme:dark){.live{color:#121214!important}}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${USER} · Projects</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:title" content="${USER} · Projects">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>${STYLE}</style>
</head>
<body>
<header class="top">
  <h1>${USER}</h1>
  <p>${repos.length} open-source projects: developer tools, Claude add-ons, games, learning sites and more. Everything is on <a href="https://github.com/${USER}">GitHub</a>.</p>
</header>
<main>
${cards}
</main>
</body>
</html>
`;

const PAGE_STYLE = `
.project{max-width:860px;margin:0 auto;padding:40px 16px 64px}
.project nav{font-size:14px;margin-bottom:20px}
.project nav a,.readme a{color:var(--accent)}
.project h1{margin:0 0 8px;font-size:clamp(28px,5vw,38px);letter-spacing:-.02em}
.project .lede{margin:0 0 14px;color:var(--muted);font-size:17px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 28px}
.actions a{border:1px solid var(--line);background:var(--card);color:var(--fg);padding:7px 14px;border-radius:9px;text-decoration:none;font-weight:600;font-size:14px}
.actions a.live{border-color:var(--accent)}
.readme{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 24px 24px;overflow-wrap:anywhere}
.readme img{max-width:100%;height:auto}
.readme pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto;font-size:13.5px}
.readme code{font-family:ui-monospace,Consolas,monospace;font-size:.92em}
.readme table{border-collapse:collapse;display:block;overflow-x:auto}
.readme th,.readme td{border:1px solid var(--line);padding:6px 10px;text-align:left}
.readme .anchor{display:none}`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

for (const r of repos) {
  const readme = await ghRaw(`/repos/${r.full_name}/readme`, 'application/vnd.github.html');
  const release = JSON.parse((await ghRaw(`/repos/${r.full_name}/releases/latest`, 'application/vnd.github+json')) || 'null');
  const name = title(r);
  const d = blurb(r).replace(/^./, (c) => c.toUpperCase());
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description: d,
    url: page(r),
    sameAs: [r.html_url, ...(r.homepage ? [r.homepage] : [])],
    applicationCategory: 'DeveloperApplication',
    keywords: (r.topics || []).join(', ') || undefined,
    programmingLanguage: r.language || undefined,
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? `https://spdx.org/licenses/${r.license.spdx_id}` : undefined,
    softwareVersion: release?.tag_name,
    downloadUrl: release?.html_url,
    dateModified: r.pushed_at,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: USER, url: SITE },
  };
  const links = [
    r.homepage && !r.homepage.startsWith(page(r)) ? `<a class="live" href="${esc(r.homepage)}">Open the app ↗</a>` : '',
    release ? `<a href="${esc(release.html_url)}">Download ${esc(release.tag_name)}</a>` : '',
    `<a href="${esc(r.html_url)}">Source on GitHub</a>`,
  ].join('');
  const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} · ${USER}</title>
<meta name="description" content="${esc(d)}">
<meta name="keywords" content="${esc((r.topics || []).join(', '))}">
<link rel="canonical" href="${page(r)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${page(r)}">
<meta property="og:image" content="https://opengraph.githubassets.com/1/${r.full_name}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>${STYLE}${PAGE_STYLE}</style>
</head>
<body>
<div class="project">
  <nav><a href="${SITE}/">← All projects by ${USER}</a></nav>
  <h1>${esc(name)}</h1>
  <p class="lede">${esc(d)}</p>
  <ul class="tags">${(r.topics || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  <div class="actions">${links}</div>
  ${readme ? `<div class="readme">${absolutize(readme, r)}</div>` : ''}
</div>
</body>
</html>
`;
  fs.mkdirSync(`${OUT}/p/${r.name.toLowerCase()}`, { recursive: true });
  fs.writeFileSync(`${OUT}/p/${r.name.toLowerCase()}/index.html`, out);
}

const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`, ...repos.map(page), ...repos.map((r) => r.homepage).filter((h) => h && h.startsWith(SITE + '/'))];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(urls)].map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(`${OUT}/index.html`, html);
fs.writeFileSync(`${OUT}/sitemap.xml`, sitemap);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(`${OUT}/.nojekyll`, '');
// Google Search Console verification files (googleXXXX.html) dropped in the repo root get published too.
for (const f of fs.readdirSync('.')) if (/^google[0-9a-f]+\.html$/.test(f)) fs.copyFileSync(f, `${OUT}/${f}`);
console.log(`built ${repos.length} projects, ${urls.length} sitemap urls`);
// IndexNow key file (<key>.txt): lets the IndexNow step in pages.yml submit the sitemap to Bing, Yandex and others.
for (const f of fs.readdirSync('.')) if (/^[0-9a-f]{32}\.txt$/.test(f)) fs.copyFileSync(f, `${OUT}/${f}`);
