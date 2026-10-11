// After the Vite build: fill in the public site address for canonical, sharing and sitemap tags.
// Vercel exposes the production domain at build time; SITE_URL overrides it. Without either, tags that
// need an absolute address are dropped rather than published with a wrong one.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const host=process.env.SITE_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'');
const site=host.replace(/\/+$/,'');
const valid=/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site);
for(const file of ['dist/index.html','dist/process/index.html']){
 if(!existsSync(file))continue;let html=readFileSync(file,'utf8');
 html=valid?html.replaceAll('%SITE_URL%',site):html.replace(/<link rel="canonical"[^>]*%SITE_URL%[^>]*>|<meta (property|name)="(og|twitter):(url)"[^>]*>/g,'').replaceAll('%SITE_URL%','');
 writeFileSync(file,html);
}
writeFileSync('dist/robots.txt',`User-agent: *\nAllow: /\n${valid?`Sitemap: ${site}/sitemap.xml\n`:''}`);
if(valid)writeFileSync('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${site}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n<url><loc>${site}/process/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>\n`);
console.log(valid?`Site address: ${site}`:'No site address at build time: canonical and share URLs left relative.');
