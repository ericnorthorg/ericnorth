// Пост блога по красивому адресу /post/<id> (и /en/post/<id>, /ru/…, /uk/…).
// Сервер подставляет заголовок, описание, картинку для соцсетей и сам текст поста,
// чтобы поисковики и превью в мессенджерах видели содержимое сразу.
import { db, esc, field, plain, parsePath, setHead, htmlResponse } from './lib/shared.js';

export default async (request, context) => {
    try {
        const url = new URL(request.url);
        const { lang, prefixed, rest } = parsePath(url.pathname);
        const m = rest.match(/^\/post\/([A-Za-z0-9_-]+)\/?$/);
        if (!m) return;
        const id = m[1];
        const [rows, res] = await Promise.all([
            db(`posts?select=id,hidden,image,meta_ru,meta_en,meta_uk,title_ru,title_en,title_uk,body_ru,body_en,body_uk&id=eq.${encodeURIComponent(id)}`),
            context.next(),
        ]);
        let html = await res.text();
        const post = rows[0];
        if (!post) {
            html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>Not found | Eric North</title>')
                .replace(/<\/head>/i, '    <meta name="robots" content="noindex">\n</head>');
            return htmlResponse(html, 404);
        }
        const title = field(post, 'title', lang);
        const body = field(post, 'body', lang);
        const category = (field(post, 'meta', lang).split('|')[0] || '').trim();
        html = setHead(html, {
            origin: url.origin, rest: `/post/${id}`, prefixed, lang, type: 'article',
            title: `${title} | Eric North`, description: plain(body), image: post.image,
        });
        // Скрытый пост открывается по прямой ссылке, но поисковикам его не показываем
        if (post.hidden) html = html.replace(/<\/head>/i, '    <meta name="robots" content="noindex">\n</head>');
        // Текст поста прямо в HTML. Скрипт страницы потом заменит его полной версией.
        const article = `<div class="post-hero-container">
            ${post.image ? `<div class="post-hero-img-wrapper"><img src="${esc(post.image)}" alt="${esc(title)}" class="post-hero-img"></div>` : ''}
        </div>
        <article class="post-article">
            ${category ? `<div class="post-meta"><span class="post-category">${esc(category)}</span></div>` : ''}
            <h1 class="post-title">${esc(title)}</h1>
            <div class="post-content">${body}</div>
        </article>`;
        html = html.replace(/<div class="loading-state"[^>]*>[\s\S]*?<\/div>/, article);
        return htmlResponse(html);
    } catch (e) {
        console.error('seo-post', e);
        return; // при любой ошибке отдаём страницу как обычно
    }
};

export const config = {
    path: ['/post/*', '/en/post/*', '/ru/post/*', '/uk/post/*'],
    cache: 'manual',
};
