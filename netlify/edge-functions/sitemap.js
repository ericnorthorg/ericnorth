// Карта сайта для поисковиков: /sitemap.xml собирается из базы при запросе.
import { db, LANGS, esc } from './lib/shared.js';

export default async (request) => {
    const origin = new URL(request.url).origin;
    const urls = [];
    const add = (rest, lastmod) => urls.push({ rest, lastmod });
    ['/', '/blog', '/books', '/notes', '/projects'].forEach(p => add(p));
    try {
        const [posts, pages, chapters] = await Promise.all([
            db('posts?select=id,hidden,updated_at&order=sort_order.asc'),
            db('pages?select=slug,published_at&published=not.is.null'),
            db('chapters?select=book_id,chapter_num,hidden,updated_at&order=book_id.asc,chapter_num.asc'),
        ]);
        posts.filter(p => !p.hidden).forEach(p => add(`/post/${p.id}`, p.updated_at));
        pages.filter(p => p.slug !== 'home').forEach(p => add(`/p/${p.slug}`, p.published_at));
        chapters.filter(c => !c.hidden).forEach(c => add(`/read/${encodeURIComponent(c.book_id)}/${encodeURIComponent(c.chapter_num)}`, c.updated_at));
    } catch (e) {
        console.error('sitemap', e);
    }
    const loc = (l, rest) => origin + (l ? '/' + l : '') + (l && rest === '/' ? '/' : rest);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap(u => LANGS.map(l => `  <url>
    <loc>${esc(loc(l, u.rest))}</loc>${u.lastmod ? `\n    <lastmod>${esc(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}
${LANGS.map(x => `    <xhtml:link rel="alternate" hreflang="${x}" href="${esc(loc(x, u.rest))}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc('', u.rest))}"/>
  </url>`)).join('\n')}
</urlset>`;
    return new Response(xml, {
        headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=0, must-revalidate',
            'netlify-cdn-cache-control': 'public, s-maxage=600, stale-while-revalidate=86400',
        },
    });
};

export const config = { path: '/sitemap.xml', cache: 'manual' };
