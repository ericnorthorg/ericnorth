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
    // Главная: hero + промо-блоки (id 'hero', 'promo1', 'promo2'... как раньше в таблице)
    let promoN = 0;
    homeDB = t.home.map(b => {
        const item = {};
        ['image', 'title_ru', 'title_en', 'text_ru', 'text_en', 'subline_ru', 'subline_en', 'btn_text_ru', 'btn_text_en', 'link']
            .forEach(k => item[k] = str(b[k]));
        item.id = b.kind === 'hero' ? 'hero' : 'promo' + (++promoN);
        item.reverse = b.reverse ? 'TRUE' : 'FALSE';
        return item;
    });

    postsDB = {};
    t.posts.forEach(p => {
        postsDB[p.id] = {
            id: p.id, hidden: !!p.hidden, category: str(p.category), image: str(p.image),
            meta_ru: str(p.meta_ru), meta_en: str(p.meta_en),
            title_ru: str(p.title_ru), title_en: str(p.title_en) || str(p.title_ru),
            body_ru: str(p.body_ru), body_en: str(p.body_en) || str(p.body_ru)
        };
    });

    booksDB = t.books.map(b => ({
        id: b.id, cover: str(b.cover),
        title_ru: str(b.title_ru), title_en: str(b.title_en) || str(b.title_ru),
        desc_ru: str(b.desc_ru), desc_en: str(b.desc_en) || str(b.desc_ru),
        tags_ru: str(b.tags_ru), tags_en: str(b.tags_en),
        link_buy: str(b.link_buy), link_read: str(b.link_read)
    }));

    chaptersDB = t.chapters.map(c => ({
        book_id: c.book_id, chapter_num: String(c.chapter_num),
        title_ru: str(c.title_ru), title_en: str(c.title_en) || str(c.title_ru),
        text_ru: str(c.text_ru), text_en: str(c.text_en) || str(c.text_ru)
    }));

    projectsDB = t.projects.map(p => ({
        statusClass: str(p.status_class), status_ru: str(p.status_ru), status_en: str(p.status_en),
        title_ru: str(p.title_ru), title_en: str(p.title_en) || str(p.title_ru),
        desc_ru: str(p.desc_ru), desc_en: str(p.desc_en) || str(p.desc_ru),
        progressLabel_ru: str(p.progress_label_ru), progressLabel_en: str(p.progress_label_en),
        progress: String(p.progress)
    }));

    // notes.html переворачивает список, поэтому отдаём в обратном порядке: первая в админке = первая на сайте
    notesDB = t.notes.map(n => ({
        date_ru: str(n.date_ru), date_en: str(n.date_en),
        title_ru: str(n.title_ru), title_en: str(n.title_en) || str(n.title_ru),
        text_ru: str(n.text_ru), text_en: str(n.text_en) || str(n.text_ru)
    })).reverse();

    siteSettings = {};
    t.settings.forEach(s => siteSettings[s.key] = s.value);
}

// 3. НАСТРОЙКИ САЙТА: соцсети, карточки на главной, блок «Написать автору»
function esc(s) {
    return str(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Описание картинки (alt) из заголовка на текущем языке
function altText(ru, en) {
    const lang = (typeof currentLang !== 'undefined' ? currentLang : (typeof detectLang === 'function' ? detectLang() : 'en'));
    const t = (lang === 'en' ? (en || ru) : (ru || en)) || '';
    return esc(String(t).replace(/<[^>]*>/g, ''));
}

function applySettings() {
    const site = siteSettings.site || {};

    if (Array.isArray(site.socials)) {
        const links = site.socials.filter(s => s && s.url).map(s =>
            `<a href="${esc(s.url)}" title="${esc(s.name)}" target="_blank" rel="noopener"><i class="${esc(s.icon || 'fa-solid fa-link')}"></i></a>`
        ).join('');
        document.querySelectorAll('.footer-socials').forEach(el => {
            el.innerHTML = links;
            el.style.display = links ? '' : 'none';
        });
    }

    const cardsBox = document.querySelector('.featured-cards-container');
    if (cardsBox && Array.isArray(site.home_cards)) {
        cardsBox.innerHTML = site.home_cards.filter(c => c && !c.hidden).map(c => `
            <a href="${esc(c.link || '#')}" class="link-card">
                <i class="${esc(c.icon || 'fa-solid fa-star')}"></i>
                <h3><span class="lang-ru">${esc(c.title_ru)}</span><span class="lang-en" hidden>${esc(c.title_en || c.title_ru)}</span></h3>
                <p><span class="lang-ru">${esc(c.desc_ru)}</span><span class="lang-en" hidden>${esc(c.desc_en || c.desc_ru)}</span></p>
            </a>`).join('');
        cardsBox.style.display = cardsBox.innerHTML.trim() ? '' : 'none';
    }

    const contact = site.contact;
    const contactSection = document.querySelector('.contact-section');
    if (contactSection && contact) {
        contactSection.style.display = contact.enabled === false ? 'none' : '';
        if (typeof translations !== 'undefined') {
            ['ru', 'en'].forEach(l => {
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
const CHAPTER_META = 'book_id,chapter_num,title_ru,title_en';
let chapterTextsLoaded = false;

async function fetchChapters() {
    const base = `select=${CHAPTER_META}&hidden=eq.false&order=book_id.asc,chapter_num.asc`;
    const params = new URLSearchParams(window.location.search);
    const book = params.get('book'), chapter = parseInt(params.get('chapter'), 10);
    const isReader = /\/reader(\.html)?$/.test(window.location.pathname) && book && chapter;
    const [meta, current] = await Promise.all([
        fetchTable('chapters', base),
        isReader
            ? fetchTable('chapters', `select=book_id,chapter_num,text_ru,text_en&hidden=eq.false&book_id=eq.${encodeURIComponent(book)}&chapter_num=eq.${chapter}`)
            : Promise.resolve([])
    ]);
    return meta.map(c => {
        const full = current.find(x => x.book_id === c.book_id && x.chapter_num === c.chapter_num);
        return full ? { ...c, text_ru: full.text_ru, text_en: full.text_en } : c;
    });
}

// Догружает тексты всех глав (для поиска). Возвращает Promise.
let chapterTextsPromise = null;
function loadChapterTexts() {
    if (chapterTextsLoaded) return Promise.resolve();
    if (!chapterTextsPromise) {
        chapterTextsPromise = fetchTable('chapters', 'select=book_id,chapter_num,text_ru,text_en&hidden=eq.false')
            .then(rows => {
                rows.forEach(r => {
                    const ch = chaptersDB.find(c => c.book_id === r.book_id && String(c.chapter_num) === String(r.chapter_num));
                    if (ch) { ch.text_ru = str(r.text_ru); ch.text_en = str(r.text_en) || str(r.text_ru); }
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
    } finally {
        clearTimeout(spinnerTimer);
        hideSpinner();
    }
}

document.addEventListener('DOMContentLoaded', initCMS);
