# aaryanbindage.github.io

Project index at **https://aaryanbindage.github.io/**.

`build.mjs` builds the site from the GitHub API every day: an index of each public, non-fork repo that has a description, a page per project at `/p/<repo>/` (rendered README, Open Graph tags and SoftwareApplication JSON-LD), plus `sitemap.xml` and `robots.txt`. The sitemap also covers every project's own GitHub Pages site under this domain, so one Google Search Console property indexes them all.

To verify with Google Search Console, add the `googleXXXX.html` file it gives you to the repo root and push.
