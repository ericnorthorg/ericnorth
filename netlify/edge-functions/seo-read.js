// Глава книги по адресу /read/<книга>/<номер> (и /en/read/…, /ru/…, /uk/…).
// Сервер подставляет заголовок, описание, обложку для соцсетей и сам текст главы.
import { db, esc, field, plain, parsePath, setHead, htmlResponse } from './lib/shared.js';

export default async (request, context) => {
    try {
        const url = new URL(request.url);
        const { lang, prefixed, rest } = parsePath(url.pathname);
        const m = rest.match(/^\/read\/([A-Za-z0-9_-]+)\/(\d+)\/?$/);
        if (!m) return;
        const [book, num] = [m[1], parseInt(m[2], 10)];
        const [chapters, books, res] = await Promise.all([
            db(`chapters?select=title_ru,title_en,title_uk,text_ru,text_en,text_uk&hidden=eq.false&book_id=eq.${encodeURIComponent(book)}&chapter_num=eq.${num}`),
            db(`books?select=title_ru,title_en,title_uk,cover&hidden=eq.false&id=eq.${encodeURIComponent(book)}`),
            context.next(),
        ]);
        let html = await res.text();
        const ch = chapters[0], bk = books[0] || {};
        if (!ch) {
            html = html.replace(/<\/head>/i, '    <meta name="robots" content="noindex">\n</head>');
            return htmlResponse(html, 404);
        }
        const title = field(ch, 'title', lang), bookTitle = field(bk, 'title', lang);
        const text = field(ch, 'text', lang);
        html = setHead(html, {
            origin: url.origin, rest: `/read/${book}/${num}`, prefixed, lang, type: 'article',
            title: `${title}${bookTitle ? ' — ' + bookTitle : ''} | Eric North`, description: plain(text), image: bk.cover,
        });
        // Текст главы прямо в HTML. Скрипт читалки потом заменит его полной версией с настройками.
        html = html.replace(/<div class="chapter-header">\s*<h1 class="chapter-title" data-translate="loading">[\s\S]*?<\/h1>\s*<\/div>/,
            `<div class="chapter-header"><h1 class="chapter-title">${esc(title)}</h1></div>\n<div class="chapter-content">${text}</div>`);
        return htmlResponse(html);
    } catch (e) {
        console.error('seo-read', e);
        return;
    }
};

export const config = {
    path: ['/read/*', '/en/read/*', '/ru/read/*', '/uk/read/*'],
    cache: 'manual',
};
