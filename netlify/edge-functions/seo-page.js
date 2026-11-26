// Страницы конструктора /p/<slug>: заголовок, описание и картинка для поисковиков и соцсетей.
import { db, pick, plain, parsePath, setHead, htmlResponse } from './lib/shared.js';

export default async (request, context) => {
    try {
        const url = new URL(request.url);
        if (url.searchParams.has('preview')) return;
        const { lang, prefixed, rest } = parsePath(url.pathname);
        const m = rest.match(/^\/p\/([a-z0-9][a-z0-9-]*)\/?$/);
        if (!m) return;
        const [rows, res] = await Promise.all([
            db(`pages?select=slug,published&slug=eq.${m[1]}&published=not.is.null`),
            context.next(),
        ]);
        let html = await res.text();
        const page = rows[0] && rows[0].published;
        if (!page) {
            html = html.replace(/<\/head>/i, '    <meta name="robots" content="noindex">\n</head>');
            return htmlResponse(html, 404);
        }
        const seo = page.seo || {};
        const t = pick(page.title, lang);
        let description = pick(seo.description, lang);
        if (!description) {
            // Нет описания — берём начало первого текстового блока
            const b = (page.blocks || []).find(x => x && !x.hidden && ['text', 'image_text', 'hero', 'quote'].includes(x.type));
            if (b) description = plain(pick(b.body || b.text || b.subtitle, lang));
        }
        const image = seo.image || ((page.blocks || []).find(x => x && x.image) || {}).image || '';
        html = setHead(html, { origin: url.origin, rest: `/p/${m[1]}`, prefixed, lang, title: t ? `${t} | Eric North` : 'Eric North', description, image });
        return htmlResponse(html);
    } catch (e) {
        console.error('seo-page', e);
        return;
    }
};

export const config = {
    path: ['/p/*', '/en/p/*', '/ru/p/*', '/uk/p/*'],
    cache: 'manual',
};
