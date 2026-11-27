// --- cms.js ---
// Контент сайта хранится в Supabase и редактируется в админке (admin.html).
// Публичный ключ ниже безопасен: без входа в админку база доступна только для чтения.

const SUPABASE_URL = 'https://eaumjrfaosozzoebnlcf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GqIgz56xMe8Qq68x5tqGZw_GybLuFuT';

let projectsDB = [];
let booksDB = [];
let notesDB = [];
let postsDB = {};
let chaptersDB = [];
let homeDB = [];
let siteSettings = {};

// 1. СПИННЕР (показывается, только если загрузка заметно затянулась)
function showSpinner() {
    if (document.getElementById('cms-global-spinner')) return;
    if (!document.getElementById('cms-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'cms-spinner-style';
        style.innerHTML = `
            #cms-global-spinner {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background-color: var(--bg-color); z-index: 99999;
                display: flex; flex-direction: column; justify-content: center; align-items: center;
                transition: opacity 0.4s ease;
            }
            .spinner-circle {
                width: 50px; height: 50px;
                border: 4px solid var(--border-color); border-top: 4px solid var(--accent-color);
                border-radius: 50%; animation: spin 1s linear infinite;
            }
            .spinner-text {
                margin-top: 20px; font-family: 'Merriweather', serif; color: var(--secondary-text);
                font-size: 1.1rem; letter-spacing: 1px; animation: pulse 1.5s ease-in-out infinite;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
    const spinner = document.createElement('div');
    spinner.id = 'cms-global-spinner';
    const lang = (typeof detectLang === 'function') ? detectLang() : 'en';
    spinner.innerHTML = `<div class="spinner-circle"></div><div class="spinner-text">${lang === 'ru' ? 'Открываем портал...' : lang === 'uk' ? 'Відкриваємо портал...' : 'Opening the portal...'}</div>`;
    document.body.appendChild(spinner);
}

// Если база не ответила — понятное сообщение на языке читателя и кнопка «Попробовать ещё раз»
function showLoadError() {
    if (document.getElementById('cms-load-error')) return;
    const lang = (typeof detectLang === 'function') ? detectLang() : 'en';
    const t = {
        ru: ['Не удалось загрузить содержимое сайта. Проверьте интернет и попробуйте ещё раз.', 'Попробовать ещё раз'],
        en: ['Could not load the site content. Check your connection and try again.', 'Try again'],
        uk: ['Не вдалося завантажити вміст сайту. Перевірте інтернет і спробуйте ще раз.', 'Спробувати ще раз'],
    }[lang] || ['Could not load the site content. Check your connection and try again.', 'Try again'];
    const box = document.createElement('div');
    box.id = 'cms-load-error';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99998;max-width:calc(100% - 32px);'
        + 'background:var(--bg-color,#fff);color:var(--text-color,#222);border:1px solid var(--accent-color,#ff500a);border-radius:12px;'
        + 'box-shadow:0 8px 30px rgba(0,0,0,.18);padding:14px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;font-size:1rem;';
    const msg = document.createElement('span'); msg.textContent = t[0];
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = t[1];
    btn.style.cssText = 'background:var(--accent-color,#ff500a);color:#fff;border:none;border-radius:20px;padding:8px 18px;font:inherit;font-weight:600;cursor:pointer;';
    btn.onclick = () => window.location.reload();
    box.append(msg, btn);
    document.body.appendChild(box);
}

function hideSpinner() {
    const spinner = document.getElementById('cms-global-spinner');
    if (spinner) {
        spinner.style.opacity = '0';
        setTimeout(() => spinner.remove(), 400);
    }
}

// 2. ЗАГРУЗКА ТАБЛИЦ
function fetchTable(table, query) {
    return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SUPABASE_KEY } })
        .then(res => {
            if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
            return res.json();
        });
}

const str = v => (v === null || v === undefined) ? '' : String(v);

function applyData(t) {
    // Перевод с запасным вариантом: украинский → английский → русский
    const tr = (o, f) => ({
        [f + '_ru']: str(o[f + '_ru']),
        [f + '_en']: str(o[f + '_en']) || str(o[f + '_ru']),
        [f + '_uk']: str(o[f + '_uk']) || str(o[f + '_en']) || str(o[f + '_ru'])
    });

    // Главная: hero + промо-блоки (id 'hero', 'promo1', 'promo2'... как раньше в таблице)
    let promoN = 0;
    homeDB = t.home.map(b => ({
        image: str(b.image), link: str(b.link),
        ...tr(b, 'title'), ...tr(b, 'text'), ...tr(b, 'subline'), ...tr(b, 'btn_text'),
        id: b.kind === 'hero' ? 'hero' : 'promo' + (++promoN),
        reverse: b.reverse ? 'TRUE' : 'FALSE'
    }));

    postsDB = {};
    t.posts.forEach(p => {
        postsDB[p.id] = {
            id: p.id, hidden: !!p.hidden, category: str(p.category), image: str(p.image),
            meta_ru: str(p.meta_ru), meta_en: str(p.meta_en), meta_uk: str(p.meta_uk) || str(p.meta_en),
            ...tr(p, 'title'), ...tr(p, 'body')
        };
    });

    booksDB = t.books.map(b => ({
        id: b.id, cover: str(b.cover),
        ...tr(b, 'title'), ...tr(b, 'desc'),
        tags_ru: str(b.tags_ru), tags_en: str(b.tags_en), tags_uk: str(b.tags_uk) || str(b.tags_en),
        link_buy: str(b.link_buy), link_read: str(b.link_read)
    }));

    chaptersDB = t.chapters.map(c => ({
        book_id: c.book_id, chapter_num: String(c.chapter_num),
        ...tr(c, 'title'), ...tr(c, 'text')
    }));

    projectsDB = t.projects.map(p => ({
        statusClass: str(p.status_class),
        ...tr(p, 'status'), ...tr(p, 'title'), ...tr(p, 'desc'),
        progressLabel_ru: str(p.progress_label_ru), progressLabel_en: str(p.progress_label_en),
        progressLabel_uk: str(p.progress_label_uk) || str(p.progress_label_en),
        progress: String(p.progress)
    }));

    // notes.html переворачивает список, поэтому отдаём в обратном порядке: первая в админке = первая на сайте
    notesDB = t.notes.map(n => ({
        date_ru: str(n.date_ru), date_en: str(n.date_en), date_uk: str(n.date_uk) || str(n.date_en),
        ...tr(n, 'title'), ...tr(n, 'text')
    })).reverse();

    siteSettings = {};
    t.settings.forEach(s => siteSettings[s.key] = s.value);
}

// 3. НАСТРОЙКИ САЙТА: меню, цвета, соцсети, карточки на главной, блок «Написать автору»

// Ключ страницы для подсветки пункта меню: "/ru/blog" и "blog.html" -> "blog", "/" -> "index"
function pageKey(href) {
    try {
        const u = new URL(href, window.location.origin + '/');
        if (u.origin !== window.location.origin) return null;
        const p = u.pathname.split('/').pop().replace(/\.html$/, '');
        return (p === '' || p === 'en' || p === 'ru' || p === 'uk') ? 'index' : p;
    } catch (e) { return null; }
}

function renderMenu(menu) {
    const cur = pageKey(window.location.pathname);
    const html = menu.filter(m => m && !m.hidden && m.link).map(m => {
        const k = pageKey(m.link);
        const active = k && (k === cur || (cur === 'posts' && k === 'blog'));
        return `<a href="${esc(m.link)}"${active ? ' class="active"' : ''}>` +
            `<span class="lang-ru">${esc(m.label_ru)}</span>` +
            `<span class="lang-en" hidden>${esc(m.label_en || m.label_ru)}</span>` +
            `<span class="lang-uk" hidden>${esc(m.label_uk || m.label_en || m.label_ru)}</span></a>`;
    }).join('');
    document.querySelectorAll('nav.main-menu').forEach(nav => { nav.innerHTML = html; });
}

// Цвета темы: в настройках хранятся только изменённые значения
const THEME_VARS = { accent: '--accent-color', bg: '--bg-color', text: '--text-color', card: '--card-bg' };
function shadeHex(hex, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    const n = parseInt(m[1], 16), t = amount < 0 ? 0 : 255, a = Math.abs(amount);
    const ch = s => Math.round(((n >> s) & 255) + (t - ((n >> s) & 255)) * a);
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}
function themeCss(theme) {
    let css = '';
    [['light', 'html:not([data-theme="dark"])'], ['dark', 'html[data-theme="dark"]']].forEach(([mode, sel]) => {
        const t = (theme || {})[mode] || {};
        const decl = Object.entries(THEME_VARS).filter(([k]) => /^#[0-9a-f]{6}$/i.test(t[k] || '')).map(([k, v]) =>
            `${v}: ${t[k]};` + (k === 'accent' ? ` --accent-hover: ${shadeHex(t[k], mode === 'dark' ? 0.2 : -0.12)};` : '')
        ).join(' ');
        if (decl) css += `${sel} { ${decl} }\n`;
    });
    return css;
}
function applyThemeCss(css) {
    let el = document.getElementById('site-theme');
    if (!el) { el = document.createElement('style'); el.id = 'site-theme'; document.head.appendChild(el); }
    el.textContent = css || '';
}
// Шрифты сайта (Настройки → Шрифты). Хранится { heading, body, reading }: { family, spec, kind }.
// Логотип не меняется — это часть фирменного стиля. Шрифт читалки выбирает сам читатель.
const FONT_SELECTORS = {
    heading: 'h1, h2, h3, h4, .contact-title, .link-card h3, .promo-title, .search-input, .book-title, .block-title, .loading-state, .rm-title, .chapter-title, .featured-title, .card-title, .post-title, .blk-title, .blk-prose h2, .blk-prose h3, .blk-quote blockquote, .blk-post h3, .blk-book h3, .blk-note h3, .blk-project h3, .blk-continue h3',
    body: 'body, .contact-input, .contact-select, .contact-textarea, .hero-subtitle, .link-card p, .filter-btn, .comment-input, .comment-textarea',
    reading: '.post-content',
};
function fontsSetup(fonts) {
    const ok = f => f && /^[A-Za-z0-9 ]{2,40}$/.test(f.family || '') && /^[a-z,@;.0-9]{0,80}$/.test(f.spec || '');
    const used = Object.entries(fonts || {}).filter(([k, f]) => FONT_SELECTORS[k] && ok(f));
    if (!used.length) return { href: '', css: '' };
    const fam = [...new Map(used.map(([, f]) => [f.family, f])).values()]
        .map(f => 'family=' + f.family.replace(/ /g, '+') + (f.spec ? ':' + f.spec : '')).join('&');
    const css = used.map(([k, f]) => FONT_SELECTORS[k].split(',').map(s => 'html ' + s.trim()).join(', ') +
        ` { font-family: '${f.family}', ${f.kind === 'sans' ? 'sans-serif' : 'serif'}; }`).join('\n');
    return { href: `https://fonts.googleapis.com/css2?${fam}&display=swap`, css };
}
function applyFonts(fonts) {
    const { href, css } = fontsSetup(fonts);
    let link = document.getElementById('site-fonts-link');
    if (href) {
        if (!link) { link = document.createElement('link'); link.id = 'site-fonts-link'; link.rel = 'stylesheet'; document.head.appendChild(link); }
        if (link.href !== href) link.href = href;
    } else if (link) link.remove();
    let st = document.getElementById('site-fonts');
    if (!st) { st = document.createElement('style'); st.id = 'site-fonts'; document.head.appendChild(st); }
    st.textContent = css;
    try { if (href) localStorage.setItem('siteFonts', JSON.stringify({ href, css })); else localStorage.removeItem('siteFonts'); } catch (e) {}
}

function esc(s) {
    return str(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Описание картинки (alt) из заголовка на текущем языке
function altText(ru, en, uk) {
    const lang = (typeof currentLang !== 'undefined' ? currentLang : (typeof detectLang === 'function' ? detectLang() : 'en'));
    const t = (lang === 'en' ? (en || ru) : lang === 'uk' ? (uk || en || ru) : (ru || en)) || '';
    return esc(String(t).replace(/<[^>]*>/g, ''));
}

function applySettings() {
    const site = siteSettings.site || {};

    if (Array.isArray(site.menu) && site.menu.length) renderMenu(site.menu);

    const css = themeCss(site.theme);
    applyThemeCss(css);
    try { if (css) localStorage.setItem('siteThemeCss', css); else localStorage.removeItem('siteThemeCss'); } catch (e) {}
    applyFonts(site.fonts);

    if (Array.isArray(site.socials)) {
        const links = site.socials.filter(s => s && s.url).map(s =>
            `<a href="${esc(s.url)}" title="${esc(s.name)}" target="_blank" rel="noopener"><i class="${esc(s.icon || 'fa-solid fa-link')}"></i></a>`
        ).join('');
        document.querySelectorAll('.footer-socials').forEach(el => {
            el.innerHTML = links;
            el.style.display = links ? '' : 'none';
        });
    }

    const cardsBox = document.querySelector('.featured-cards-container:not(.blk-cards-grid)');
    if (cardsBox && Array.isArray(site.home_cards)) {
        cardsBox.innerHTML = site.home_cards.filter(c => c && !c.hidden).map(c => `
            <a href="${esc(c.link || '#')}" class="link-card">
                <i class="${esc(c.icon || 'fa-solid fa-star')}"></i>
                <h3><span class="lang-ru">${esc(c.title_ru)}</span><span class="lang-en" hidden>${esc(c.title_en || c.title_ru)}</span><span class="lang-uk" hidden>${esc(c.title_uk || c.title_en || c.title_ru)}</span></h3>
                <p><span class="lang-ru">${esc(c.desc_ru)}</span><span class="lang-en" hidden>${esc(c.desc_en || c.desc_ru)}</span><span class="lang-uk" hidden>${esc(c.desc_uk || c.desc_en || c.desc_ru)}</span></p>
            </a>`).join('');
        cardsBox.style.display = cardsBox.innerHTML.trim() ? '' : 'none';
    }

    const contact = site.contact;
    const contactSection = document.querySelector('.contact-section:not(.blk-contact)');
    if (contactSection && contact) {
        contactSection.style.display = contact.enabled === false ? 'none' : '';
        if (typeof translations !== 'undefined') {
            ['ru', 'en', 'uk'].forEach(l => {
                if (!translations[l]) return;
                if (contact['title_' + l]) translations[l].contact_title = contact['title_' + l];
                if (contact['desc_' + l]) translations[l].contact_desc = contact['desc_' + l];
            });
        }
    }

    if (typeof setLanguage === 'function' && typeof currentLang !== 'undefined') setLanguage(currentLang);
}

// 4. ГЛАВЫ: полный текст грузим только там, где он нужен
// На обычных страницах — только номера и названия глав (для «Продолжить чтение»),
// в читалке — плюс текст открытой главы, в поиске — все тексты по первому запросу.
const CHAPTER_META = 'book_id,chapter_num,title_ru,title_en,title_uk';
let chapterTextsLoaded = false;

// Какая глава открыта в читалке: /read/<книга>/<номер> или старый вид reader.html?book=…&chapter=…
function readerParams() {
    const m = window.location.pathname.match(/\/read\/([A-Za-z0-9_-]+)\/(\d+)\/?$/);
    if (m) return { book: m[1], chapter: parseInt(m[2], 10) };
    const p = new URLSearchParams(window.location.search);
    return { book: p.get('book'), chapter: parseInt(p.get('chapter'), 10) };
}

async function fetchChapters() {
    const base = `select=${CHAPTER_META}&hidden=eq.false&order=book_id.asc,chapter_num.asc`;
    const { book, chapter } = readerParams();
    const isReader = /\/(reader(\.html)?$|read\/)/.test(window.location.pathname) && book && chapter;
    const [meta, current] = await Promise.all([
        fetchTable('chapters', base),
        isReader
            ? fetchTable('chapters', `select=book_id,chapter_num,text_ru,text_en,text_uk&hidden=eq.false&book_id=eq.${encodeURIComponent(book)}&chapter_num=eq.${chapter}`)
            : Promise.resolve([])
    ]);
    return meta.map(c => {
        const full = current.find(x => x.book_id === c.book_id && x.chapter_num === c.chapter_num);
        return full ? { ...c, text_ru: full.text_ru, text_en: full.text_en, text_uk: full.text_uk } : c;
    });
}

// Догружает тексты всех глав (для поиска). Возвращает Promise.
let chapterTextsPromise = null;
function loadChapterTexts() {
    if (chapterTextsLoaded) return Promise.resolve();
    if (!chapterTextsPromise) {
        chapterTextsPromise = fetchTable('chapters', 'select=book_id,chapter_num,text_ru,text_en,text_uk&hidden=eq.false')
            .then(rows => {
                rows.forEach(r => {
                    const ch = chaptersDB.find(c => c.book_id === r.book_id && String(c.chapter_num) === String(r.chapter_num));
                    if (ch) { ch.text_ru = str(r.text_ru); ch.text_en = str(r.text_en) || str(r.text_ru); ch.text_uk = str(r.text_uk) || ch.text_en; }
                });
                chapterTextsLoaded = true;
            })
            .catch(err => { chapterTextsPromise = null; console.error('Не удалось загрузить тексты глав:', err); });
    }
    return chapterTextsPromise;
}

// 5. ГЛАВНАЯ ЛОГИКА
async function initCMS() {
    const spinnerTimer = setTimeout(showSpinner, 400);
    try {
        const [home, posts, books, chapters, projects, notes, settings] = await Promise.all([
            fetchTable('home_blocks', 'select=*&hidden=eq.false&order=sort_order.asc,id.asc'),
            fetchTable('posts', 'select=*&order=sort_order.asc,id.asc'),
            fetchTable('books', 'select=*&hidden=eq.false&order=sort_order.asc,id.asc'),
            fetchChapters(),
            fetchTable('projects', 'select=*&hidden=eq.false&order=sort_order.asc,id.asc'),
            fetchTable('notes', 'select=*&hidden=eq.false&order=sort_order.asc,id.asc'),
            fetchTable('settings', 'select=key,value')
        ]);
        applyData({ home, posts, books, chapters, projects, notes, settings });
        applySettings();
        // Даем команду сайту рисовать контент
        document.dispatchEvent(new Event('db-ready'));
    } catch (error) {
        console.error('Ошибка загрузки данных из CMS:', error);
        showLoadError();
    } finally {
        clearTimeout(spinnerTimer);
        hideSpinner();
    }
}

document.addEventListener('DOMContentLoaded', initCMS);

// 6. ШАПКА НА ТЕЛЕФОНЕ: занимает почти четверть экрана, поэтому при прокрутке вниз
// уезжает вверх, а при малейшей прокрутке вверх сразу возвращается. В читалке своя
// компактная шапка — её не трогаем.
(function autoHideHeader() {
    if (/^\/((en|ru|uk)\/)?(read\/|reader)/.test(location.pathname)) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const st = document.createElement('style');
    st.textContent = '@media (max-width: 768px) { body > header { transition: transform .25s ease; } body > header.hdr-hidden { transform: translateY(-100%); } }';
    document.head.appendChild(st);
    let lastY = window.scrollY, ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const h = document.querySelector('body > header');
            const y = window.scrollY;
            if (h) {
                if (!mq.matches || y < h.offsetHeight || y < lastY - 4) h.classList.remove('hdr-hidden');
                else if (y > lastY + 4) h.classList.add('hdr-hidden');
            }
            lastY = y;
            ticking = false;
        });
    }, { passive: true });
})();

// Ссылка на политику конфиденциальности (страница конструктора /p/privacy) в подвале всех страниц
(function addPrivacyLink() {
    const t = { ru: 'Политика конфиденциальности', en: 'Privacy policy', uk: 'Політика конфіденційності' };
    const cur = typeof detectLang === 'function' ? detectLang() : 'en';
    document.querySelectorAll('footer .copyright p').forEach(p => {
        if (p.querySelector('.privacy-link')) return;
        const a = document.createElement('a');
        a.className = 'privacy-link';
        a.href = 'p/privacy';
        a.style.cssText = 'color:inherit;text-decoration:underline;text-underline-offset:3px;white-space:nowrap;';
        a.innerHTML = ['ru', 'en', 'uk'].map(l => `<span class="lang-${l}"${l === cur ? '' : ' hidden'}>${t[l]}</span>`).join('');
        p.append(' · ', a);
    });
})();

// 7. ФОРМЫ NETLIFY («Написать автору», подписка): отправка без перехода на другую
// страницу. Раньше браузер уходил на главную без всякого подтверждения; теперь читатель
// остаётся на месте и видит «Спасибо» на своём языке. Если скрипт не сработает,
// форма по-старому отправится обычным способом — письмо всё равно дойдёт.
const FORM_MSG = {
    sending: { en: 'Sending…', ru: 'Отправляем…', uk: 'Надсилаємо…' },
    'author-contact': { en: 'Thank you! Your message has been sent — I will reply by email.', ru: 'Спасибо! Сообщение отправлено — отвечу на email.', uk: 'Дякую! Повідомлення надіслано — відповім на email.' },
    'subscribe-modal': { en: "Done! You're subscribed.", ru: 'Готово! Вы подписались.', uk: 'Готово! Ви підписалися.' },
    error: { en: "Couldn't send. Please check your connection and try again.", ru: 'Не получилось отправить. Проверьте интернет и попробуйте ещё раз.', uk: 'Не вдалося надіслати. Перевірте інтернет і спробуйте ще раз.' },
};
document.addEventListener('submit', async e => {
    const form = e.target;
    const nameInput = form && form.querySelector && form.querySelector('input[name="form-name"]');
    if (!nameInput || form.getAttribute('action') !== '/' || !window.fetch) return;
    e.preventDefault();
    const lang = ['en', 'ru', 'uk'].includes(document.documentElement.lang) ? document.documentElement.lang : 'en';
    const msg = key => (FORM_MSG[key] || FORM_MSG['author-contact'])[lang];
    let status = form.querySelector('.form-status');
    if (!status) {
        status = document.createElement('p');
        status.className = 'form-status';
        status.setAttribute('role', 'status');
        status.style.cssText = 'margin:12px 0 0;text-align:center;font-weight:600;';
        form.appendChild(status);
    }
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    status.style.color = '';
    status.textContent = msg('sending');
    try {
        const res = await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        status.style.color = 'var(--accent-color, #ff6b2b)';
        status.textContent = msg(nameInput.value);
    } catch (err) {
        status.style.color = '#e5484d';
        status.textContent = msg('error');
    } finally {
        if (btn) btn.disabled = false;
    }
});

// 8. СТАТИСТИКА ПОСЕЩЕНИЙ (без cookies, без IP и без идентификаторов читателя)
// Записывается только: страница, язык, сайт, с которого пришли, тип устройства.
// Просмотры самого автора (вошедшего в админку в этом браузере) не считаются.
function trackView() {
    try {
        const host = location.hostname;
        if (!host || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') return;
        if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent || '')) return;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return;
            }
        } catch (e) {}
        const m = location.pathname.match(/^\/(en|ru|uk)(?=\/|$)/);
        let path = (m ? location.pathname.slice(3) : location.pathname) || '/';
        path = path.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '').replace(/(.)\/+$/, '$1');
        try { path = decodeURI(path); } catch (e) {}
        path = encodeURI(path).slice(0, 200);
        const lang = m ? m[1] : (typeof detectLang === 'function' ? detectLang() : null);
        let refHost = null, entry = true;
        if (document.referrer) {
            try {
                const r = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '');
                if (r === host.toLowerCase().replace(/^www\./, '')) entry = false; else refHost = r;
            } catch (e) {}
        }
        const w = Math.min(screen.width || 0, screen.height || 0) || window.innerWidth;
        const device = w < 600 ? 'mobile' : (w < 1100 && navigator.maxTouchPoints > 0) ? 'tablet' : 'desktop';
        fetch(`${SUPABASE_URL}/rest/v1/rpc/track_view`, {
            method: 'POST', keepalive: true,
            headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_path: path, p_lang: lang, p_ref: refHost, p_device: device, p_entry: entry }),
        }).catch(() => {});
    } catch (e) {}
}
if (document.prerendering) document.addEventListener('prerenderingchange', trackView, { once: true });
else window.addEventListener('load', () => setTimeout(trackView, 300), { once: true });
