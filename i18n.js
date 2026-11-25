// --- i18n.js ---
// Общая логика языков для всех страниц сайта.
// Языки: en (по умолчанию), ru, uk. Язык берётся из адреса (/en/, /ru/, /uk/),
// иначе из прошлого выбора читателя, иначе английский.

const SITE_LANGS = ['en', 'ru', 'uk'];
const DEFAULT_LANG = 'en';
// Языки, которые показываются в переключателе
const VISIBLE_LANGS = ['en', 'ru', 'uk'];

function langFromPath() {
    const m = window.location.pathname.match(/^\/(en|ru|uk)(\/|$)/);
    return m ? m[1] : null;
}

function detectLang() {
    const fromPath = langFromPath();
    if (fromPath) return fromPath;
    let saved = null;
    try { saved = localStorage.getItem('lang'); } catch (e) {}
    if (VISIBLE_LANGS.includes(saved)) return saved;
    // Первый визит без языка в адресе: язык браузера, если он есть на сайте
    const browser = (navigator.languages || [navigator.language || ''])
        .map(l => String(l).slice(0, 2).toLowerCase())
        .find(l => VISIBLE_LANGS.includes(l));
    return browser || DEFAULT_LANG;
}

// Адрес текущей страницы без языкового префикса: /ru/blog.html -> /blog.html
function pathWithoutLang() {
    return window.location.pathname.replace(/^\/(en|ru|uk)(?=\/|$)/, '') || '/';
}

// Ссылки на эту же страницу на других языках — для поисковиков
(function addAlternateLinks() {
    const rest = pathWithoutLang() + window.location.search;
    const href = l => window.location.origin + '/' + l + (rest.startsWith('/') ? rest : '/' + rest);
    const add = (hreflang, url) => {
        const link = document.createElement('link');
        link.rel = 'alternate'; link.hreflang = hreflang; link.href = url;
        document.head.appendChild(link);
    };
    VISIBLE_LANGS.forEach(l => add(l, href(l)));
    add('x-default', href(DEFAULT_LANG));
})();

// Украинские надписи интерфейса. Чего здесь нет — показывается по-английски.
const UK_DICT = {
    home: 'Головна', blog: 'Блог', books: 'Книги', notes: 'Нотатки', projects: 'Проєкти',
    subscribe: 'Підписатися', subscribe_btn: 'Підписатися',
    search_placeholder: 'Введіть назву книги або тему...', search_hint: 'Натисніть Enter для пошуку',
    rights: 'Усі права захищено.', join_news: 'Новини та оновлення', spam_note: 'Жодного спаму, лише магія.',
    blog_card: 'Історії', stories_desc: 'Коротка проза й чернетки', books_desc: 'Мої опубліковані романи',
    notes_desc: 'Думки та оголошення', projects_desc: 'Експерименти та ідеї',
    contact_title: 'Написати авторові',
    contact_desc: 'Відкритий до пропозицій щодо видання, готовий обговорити лор світів або просто поговорити про книжки.',
    contact_name: "Ваше ім'я", contact_email: 'Ваш email', contact_message: 'Ваше повідомлення...',
    contact_send: 'Надіслати повідомлення', subj_default: 'Оберіть тему...', subj_1: 'Співпраця',
    subj_2: 'Відгук про книжки', subj_3: 'Питання про всесвіт', subj_4: 'Інше',
    hero_part1: 'Архітектура', hero_part2: 'інших світів',
    books_title: 'Бібліотека', books_subtitle: 'Опубліковані романи й повісті. Оберіть історію та пориньте в читання.',
    read_btn: 'Почати читання', continue_btn: 'Продовжити читання',
    notes_title: 'Нотатки на полях', notes_subtitle: 'Короткі новини, прогрес написання й думки під час роботи над текстами.',
    back_to_blog: 'Назад до блогу', not_found: 'Запис не знайдено', loading: 'Завантаження архівів...',
    read_more: 'Читати ще', leave_comment: 'Залишити коментар', send_comment: 'Надіслати коментар',
    comment_name: "Ваше ім'я", comment_email: 'Ваш email (не публікується)', comment_placeholder: 'Що думаєте про цю історію?',
    back_to_books: 'До списку', prev_chapter: 'Попередня', next_chapter: 'Наступна',
    font_size: 'Розмір тексту', font_family: 'Шрифт', settings_title: 'Налаштування тексту'
};

// Добавляет к словарю страницы украинский язык: английский как основа, поверх — украинские переводы.
function withUk(dict, pageUk) {
    dict.uk = Object.assign({}, dict.en || {}, UK_DICT, pageUk || {}, dict.uk || {});
    return dict;
}

// Показывает блоки нужного языка (.lang-ru / .lang-en / .lang-uk).
// Если у блока нет украинской версии, по-украински показывается английская.
function toggleLangBlocks(lang) {
    document.documentElement.lang = lang;
    SITE_LANGS.forEach(l => {
        document.querySelectorAll('.lang-' + l).forEach(el => { el.hidden = (l !== lang); });
    });
    if (lang === 'uk') {
        document.querySelectorAll('.lang-en').forEach(el => {
            const parent = el.parentElement;
            if (!parent || !parent.querySelector(':scope > .lang-uk')) el.hidden = false;
        });
    }
}

// Переключатель языков в шапке: EN · RU (· UK)
function renderLangSwitch(lang) {
    document.querySelectorAll('.lang-switch').forEach(sw => {
        sw.removeAttribute('onclick');
        sw.setAttribute('role', 'group');
        sw.setAttribute('aria-label', 'Language');
        sw.innerHTML = VISIBLE_LANGS.map(l =>
            `<button type="button" class="lang-opt${l === lang ? ' active' : ''}" data-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`
        ).join('');
    });
}

function switchLanguage(lang) {
    if (!SITE_LANGS.includes(lang)) return;
    try { localStorage.setItem('lang', lang); } catch (e) {}
    if (langFromPath()) {
        const path = window.location.pathname.replace(/^\/(en|ru|uk)(?=\/|$)/, '/' + lang);
        window.location.href = path + window.location.search + window.location.hash;
        return;
    }
    if (typeof window.setLanguage === 'function') window.setLanguage(lang);
}

// На страницах с языком в адресе (/ru/...) внутренние ссылки получают тот же префикс.
// Netlify переписывает ссылки вида "blog.html" в "/blog", из-за чего префикс терялся.
const NO_PREFIX = /^\/(admin|editor|guide|gemini[^/]*)(\.html)?$/;
function localizeHref(a, lang) {
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
    let url;
    try { url = new URL(raw, window.location.href); } catch (e) { return; }
    if (url.origin !== window.location.origin) return;
    if (/^\/(en|ru|uk)(\/|$)/.test(url.pathname)) return;
    if (NO_PREFIX.test(url.pathname)) return;
    if (/\.[a-z0-9]+$/i.test(url.pathname) && !/\.html$/i.test(url.pathname)) return;
    a.setAttribute('href', '/' + lang + (url.pathname === '/' ? '/' : url.pathname) + url.search + url.hash);
}
function localizeLinks(root) {
    const lang = langFromPath();
    if (!lang) return;
    (root || document).querySelectorAll('a[href]').forEach(a => localizeHref(a, lang));
}
document.addEventListener('DOMContentLoaded', () => localizeLinks());
document.addEventListener('db-ready', () => setTimeout(() => localizeLinks(), 0));
// Ссылки, появившиеся позже (поиск и т.п.), исправляются в момент клика
document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    const lang = langFromPath();
    if (a && lang) localizeHref(a, lang);
}, true);

document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.lang-opt');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    switchLanguage(btn.dataset.lang);
}, true);

// Цвета сайта из прошлого визита — сразу, чтобы не мигали стандартные (свежие придут из базы)
(function applyCachedTheme() {
    try {
        const css = localStorage.getItem('siteThemeCss');
        if (css) { const el = document.createElement('style'); el.id = 'site-theme'; el.textContent = css; document.head.appendChild(el); }
    } catch (e) {}
})();

(function injectLangSwitchStyle() {
    const style = document.createElement('style');
    style.textContent = `
        .lang-switch { display: inline-flex; align-items: center; gap: 2px; }
        .lang-opt { background: none; border: none; padding: 4px 5px; margin: 0; cursor: pointer;
            font: inherit; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px;
            color: var(--secondary-text, #666); border-radius: 4px; }
        .lang-opt:hover { color: var(--text-color, #222); }
        .lang-opt.active { color: var(--accent-color, #ff500a); }
        .lang-opt:focus-visible { outline: 2px solid var(--accent-color, #ff500a); outline-offset: 1px; }
    `;
    document.head.appendChild(style);
})();
