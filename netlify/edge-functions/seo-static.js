// Обычные страницы сайта (главная, блог, книги, заметки, проекты): заголовок вкладки,
// описание для поисковиков и превью в соцсетях — на языке адреса (/en/, /ru/, /uk/; без префикса — EN).
// Тексты заголовков дублируются в i18n.js (STATIC_TITLES) — при правке менять в обоих местах.
import { parsePath, setHead, htmlResponse } from './lib/shared.js';

const IMG = 'https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&q=80';
const SITE_DESC = {
    en: 'The official website of Eric North. Mystic fantasy, the architecture of other worlds, novels and short stories.',
    ru: 'Официальный сайт Эрика Норта. Мистическое фэнтези, архитектура иных миров, романы и рассказы.',
    uk: 'Офіційний сайт Еріка Норта. Містичне фентезі, архітектура інших світів, романи та оповідання.',
};
const STATIC_PAGES = {
    '/': { image: IMG, description: SITE_DESC,
        title: { en: 'Eric North | Mystic Fantasy Author', ru: 'Eric North | Автор мистического фэнтези', uk: 'Eric North | Автор містичного фентезі' } },
    '/blog': { image: IMG, description: SITE_DESC,
        title: { en: 'Blog | Eric North', ru: 'Блог | Eric North', uk: 'Блог | Eric North' } },
    '/books': {
        title: { en: 'Books | Eric North', ru: 'Книги | Eric North', uk: 'Книги | Eric North' },
        description: {
            en: 'Published books and novels by Eric North. Read online.',
            ru: 'Опубликованные книги и романы Эрика Норта. Читать онлайн.',
            uk: 'Опубліковані книги та романи Еріка Норта. Читати онлайн.',
        } },
    '/notes': {
        title: { en: 'Notes | Eric North', ru: 'Заметки | Eric North', uk: 'Нотатки | Eric North' },
        description: {
            en: "Author's notes, news and updates on Eric North's writing process.",
            ru: 'Заметки автора, новости и обновления процесса написания книг Эрика Норта.',
            uk: 'Нотатки автора, новини та оновлення процесу написання книг Еріка Норта.',
        } },
    '/projects': { image: IMG, description: SITE_DESC,
        title: { en: 'Projects | Eric North', ru: 'Проекты | Eric North', uk: 'Проєкти | Eric North' } },
};

export default async (request, context) => {
    try {
        const url = new URL(request.url);
        const { lang, prefixed, rest } = parsePath(url.pathname);
        // /blog и /blog.html — одна страница; канонический адрес без .html
        const key = rest.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1');
        const page = STATIC_PAGES[key];
        if (!page) return;
        const res = await context.next();
        if (res.status !== 200 || !/text\/html/.test(res.headers.get('content-type') || '')) return res;
        let html = await res.text();
        // Старые теги вида <meta property="twitter:..."> тоже убираем — setHead ставит свежие
        html = html.replace(/\s*<meta\s+property="twitter:[^"]*"[^>]*>/gi, '');
        html = setHead(html, { origin: url.origin, rest: key, prefixed, lang,
            title: page.title[lang], description: page.description[lang], image: page.image || '' });
        return htmlResponse(html);
    } catch (e) {
        console.error('seo-static', e);
        return;
    }
};

export const config = {
    path: [
        '/', '/index.html', '/blog', '/blog.html', '/books', '/books.html', '/notes', '/notes.html', '/projects', '/projects.html',
        '/en/', '/en/index.html', '/en/blog', '/en/blog.html', '/en/books', '/en/books.html', '/en/notes', '/en/notes.html', '/en/projects', '/en/projects.html',
        '/ru/', '/ru/index.html', '/ru/blog', '/ru/blog.html', '/ru/books', '/ru/books.html', '/ru/notes', '/ru/notes.html', '/ru/projects', '/ru/projects.html',
        '/uk/', '/uk/index.html', '/uk/blog', '/uk/blog.html', '/uk/books', '/uk/books.html', '/uk/notes', '/uk/notes.html', '/uk/projects', '/uk/projects.html',
    ],
    cache: 'manual',
};
