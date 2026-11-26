// Общие помощники для edge-функций (выполняются на серверах Netlify перед отдачей страницы)
export const SUPABASE_URL = 'https://eaumjrfaosozzoebnlcf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_GqIgz56xMe8Qq68x5tqGZw_GybLuFuT';
export const LANGS = ['en', 'ru', 'uk'];
export const DEFAULT_LANG = 'en';

export async function db(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return r.json();
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const plain = (h, n = 160) => {
    const t = String(h || '').replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};
const has = v => v !== undefined && v !== null && String(v).trim() !== '';
const ORDER = { uk: ['uk', 'en', 'ru'], en: ['en', 'ru', 'uk'], ru: ['ru', 'en', 'uk'] };
// Поле на языке с запасными вариантами: obj.title_uk -> title_en -> title_ru
export function field(obj, name, lang) {
    for (const l of ORDER[lang] || ORDER.en) if (obj && has(obj[`${name}_${l}`])) return String(obj[`${name}_${l}`]);
    return '';
}
// То же для объектов вида { ru: '', en: '', uk: '' }
export function pick(obj, lang) {
    if (!obj || typeof obj !== 'object') return has(obj) ? String(obj) : '';
    for (const l of ORDER[lang] || ORDER.en) if (has(obj[l])) return String(obj[l]);
    return '';
}

// Разбор адреса: /uk/post/abc -> { lang: 'uk', prefixed: true, rest: '/post/abc' }
export function parsePath(pathname) {
    const m = pathname.match(/^\/(en|ru|uk)(\/.*)$/);
    return m ? { lang: m[1], prefixed: true, rest: m[2] } : { lang: DEFAULT_LANG, prefixed: false, rest: pathname };
}

// Заменяет мета-теги в <head>: заголовок, описание, Open Graph, canonical, языковые версии
export function setHead(html, { origin, rest, prefixed, lang, title, description, image, type = 'website' }) {
    const url = origin + (prefixed ? `/${lang}` : '') + rest;
    html = html
        .replace(/<html([^>]*?)\slang="[^"]*"/i, `<html$1 lang="${lang}"`)
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
        .replace(/\s*<meta\s+name="description"[^>]*>/gi, '')
        .replace(/\s*<meta\s+property="og:[^"]*"[^>]*>/gi, '')
        .replace(/\s*<meta\s+name="twitter:[^"]*"[^>]*>/gi, '')
        .replace(/\s*<link\s+rel="(canonical|alternate)"[^>]*>/gi, '');
    const tags = [
        `<meta name="description" content="${esc(description)}">`,
        `<link rel="canonical" href="${esc(url)}">`,
        ...LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${esc(origin + '/' + l + rest)}">`),
        `<link rel="alternate" hreflang="x-default" href="${esc(origin + rest)}">`,
        `<meta property="og:type" content="${type}">`,
        `<meta property="og:site_name" content="Eric North">`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(description)}">`,
        `<meta property="og:url" content="${esc(url)}">`,
        `<meta property="og:locale" content="${{ en: 'en_US', ru: 'ru_RU', uk: 'uk_UA' }[lang]}">`,
        image ? `<meta property="og:image" content="${esc(image)}">` : '',
        `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    ].filter(Boolean).join('\n    ');
    return html.replace(/<\/head>/i, `    ${tags}\n</head>`);
}

export function htmlResponse(html, status = 200) {
    return new Response(html, {
        status,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=0, must-revalidate',
            // Короткий кэш на стороне Netlify: правки из админки появятся максимум через минуту
            'netlify-cdn-cache-control': 'public, s-maxage=60, stale-while-revalidate=86400',
        },
    });
}
