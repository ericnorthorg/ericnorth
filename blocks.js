// --- blocks.js ---
// Отрисовка страниц конструктора из блоков. Один и тот же код рисует
// опубликованную страницу на сайте и предпросмотр в админке.
// Тексты блоков хранятся по языкам: { en: '...', ru: '...', uk: '...' }.

const Blocks = (() => {
    const LANGS = ['ru', 'en', 'uk'];

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const has = v => v !== undefined && v !== null && String(v).trim() !== '';

    // Значение на языке с запасным вариантом: uk -> en -> ru, en -> ru, ru -> en
    function pick(obj, lang) {
        if (!obj || typeof obj !== 'object') return has(obj) ? String(obj) : '';
        const order = lang === 'uk' ? ['uk', 'en', 'ru'] : lang === 'en' ? ['en', 'ru', 'uk'] : ['ru', 'en', 'uk'];
        for (const l of order) if (has(obj[l])) return String(obj[l]);
        return '';
    }
    const anyText = obj => LANGS.some(l => has(pick(obj, l)));

    // Текст на всех языках: <span class="lang-ru">…</span><span class="lang-en" hidden>…</span>…
    // html=true — содержимое уже HTML (из визуального редактора), иначе экранируется.
    function tr(obj, { tag = 'span', html = false, cls = '' } = {}) {
        return LANGS.map(l => {
            const v = pick(obj, l);
            return `<${tag} class="lang-${l}${cls ? ' ' + cls : ''}"${l === 'ru' ? '' : ' hidden'}>${html ? v : esc(v)}</${tag}>`;
        }).join('');
    }

    const safeUrl = u => {
        const s = String(u || '').trim();
        if (!s || /^javascript:/i.test(s)) return '#';
        return esc(s);
    };
    const target = u => /^https?:\/\//i.test(String(u || '')) ? ' target="_blank" rel="noopener"' : '';

    function button(b, primary = true) {
        if (!b || !b.link || !anyText(b.label)) return '';
        return `<a href="${safeUrl(b.link)}"${target(b.link)} class="${primary ? 'btn-primary' : 'btn-secondary'}">${tr(b.label)} <i class="fa-solid fa-arrow-right"></i></a>`;
    }

    // Поля из данных сайта (cms.js) хранятся как title_ru/title_en/title_uk
    const L3 = (o, f) => ({ ru: o && o[f + '_ru'], en: o && o[f + '_en'], uk: o && o[f + '_uk'] });
    const UI = {
        read: { ru: 'Читать', en: 'Read', uk: 'Читати' },
        buy: { ru: 'Купить', en: 'Buy', uk: 'Купити' },
        chapter: { ru: 'Глава', en: 'Chapter', uk: 'Розділ' },
        loading: { ru: 'Загрузка…', en: 'Loading…', uk: 'Завантаження…' },
        empty: { ru: 'Пока пусто', en: 'Nothing here yet', uk: 'Поки порожньо' },
        name: { ru: 'Ваше имя', en: 'Your name', uk: "Ваше ім'я" },
        email: { ru: 'Ваш Email', en: 'Your email', uk: 'Ваш email' },
        message: { ru: 'Ваше сообщение…', en: 'Your message…', uk: 'Ваше повідомлення…' },
        send: { ru: 'Отправить сообщение', en: 'Send message', uk: 'Надіслати повідомлення' },
    };
    // Блоки с данными сайта ждут загрузки cms.js (событие db-ready)
    const state = { dataReady: false, preview: false };
    const dataBlock = html => state.dataReady ? html : `<div class="blk-loading">${tr(UI.loading)}</div>`;
    const plain = (h, n) => { const t = String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
    const trPlain = (obj, n) => LANGS.map(l => `<span class="lang-${l}"${l === 'ru' ? '' : ' hidden'}>${esc(plain(pick(obj, l), n))}</span>`).join('');
    const titleH2 = b => anyText(b.title) ? `<h2 class="blk-title blk-center">${tr(b.title)}</h2>` : '';
    const num = (v, def, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; };

    // Ссылка на видео → адрес для встраивания
    function videoEmbed(url) {
        const u = String(url || '').trim();
        let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
        if (m) return { kind: 'frame', src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
        m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (m) return { kind: 'frame', src: `https://player.vimeo.com/video/${m[1]}` };
        if (/^https?:\/\/.+\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'file', src: u };
        return null;
    }

    // --- Типы блоков ---
    const TYPES = {
        hero(b) {
            const bg = b.image ? ` style="background-image: url('${safeUrl(b.image)}')"` : '';
            const title = LANGS.map(l => {
                const main = esc(pick(b.title, l)), acc = esc(pick(b.accent, l));
                return `<span class="lang-${l}"${l === 'ru' ? '' : ' hidden'}>${main}${acc ? ` <span style="color: var(--accent-color);">${acc}</span>` : ''}</span>`;
            }).join('');
            const buttons = (b.buttons || []).map((x, i) => button(x, i === 0)).join('');
            return `<section class="hero-section blk-hero"${bg}><div class="hero-overlay"></div><div class="hero-content">
                <h1 class="hero-title-large">${title}</h1>
                ${anyText(b.subtitle) ? `<p class="hero-subtitle">${tr(b.subtitle)}</p>` : ''}
                ${buttons ? `<div class="blk-buttons">${buttons}</div>` : ''}
            </div></section>`;
        },

        text(b) {
            return `<section class="blk-text blk-width-${b.width === 'wide' ? 'wide' : 'narrow'}${b.align === 'center' ? ' blk-center' : ''}">
                ${anyText(b.title) ? `<h2 class="blk-title">${tr(b.title)}</h2>` : ''}
                <div class="blk-prose">${tr(b.body, { tag: 'div', html: true })}</div>
            </section>`;
        },

        image_text(b) {
            return `<div class="promo-section${b.reverse ? ' reverse' : ''}">
                ${b.image ? `<div class="promo-image-wrapper"><img src="${safeUrl(b.image)}" alt="${esc(pick(b.title, 'en'))}" class="promo-image" loading="lazy"></div>` : ''}
                <div class="promo-content">
                    ${anyText(b.title) ? `<h2 class="promo-title">${tr(b.title)}</h2>` : ''}
                    ${anyText(b.text) ? `<div class="promo-text">${tr(b.text, { tag: 'div', html: true })}</div>` : ''}
                    ${button(b.button)}
                </div>
            </div>`;
        },

        cards(b) {
            const items = (b.items || []).filter(c => c && (anyText(c.title) || c.link));
            if (!items.length) return '';
            return `<section class="blk-cards${b.overlap ? ' blk-overlap' : ''}">
                ${anyText(b.title) ? `<h2 class="blk-title blk-center">${tr(b.title)}</h2>` : ''}
                <div class="featured-cards-container blk-cards-grid" style="--blk-cols:${Math.min(items.length, 4)}">
                ${items.map(c => `<a href="${safeUrl(c.link || '#')}"${target(c.link)} class="link-card">
                    ${c.icon ? `<i class="${esc(c.icon)}"></i>` : ''}
                    <h3>${tr(c.title)}</h3>
                    ${anyText(c.desc) ? `<p>${tr(c.desc)}</p>` : ''}
                </a>`).join('')}
                </div>
            </section>`;
        },

        quote(b) {
            if (!anyText(b.text)) return '';
            return `<section class="blk-quote">
                <i class="fa-solid fa-quote-left"></i>
                <blockquote>${tr(b.text)}</blockquote>
                ${anyText(b.author) ? `<cite>— ${tr(b.author)}</cite>` : ''}
            </section>`;
        },

        gallery(b) {
            const imgs = (b.images || []).filter(x => x && x.src);
            if (!imgs.length) return '';
            return `<section class="blk-gallery">${titleH2(b)}
                <div class="blk-gallery-grid" style="--blk-cols:${num(b.cols, 3, 2, 4)}">
                ${imgs.map(x => `<figure><a href="${safeUrl(x.src)}" class="blk-zoom" target="_blank" rel="noopener"><img src="${safeUrl(x.src)}" alt="${esc(pick(x.caption, 'en'))}" loading="lazy"></a>
                    ${anyText(x.caption) ? `<figcaption>${tr(x.caption)}</figcaption>` : ''}</figure>`).join('')}
                </div></section>`;
        },

        video(b) {
            const v = videoEmbed(b.url);
            if (!v) return '';
            const player = v.kind === 'frame'
                ? `<iframe src="${safeUrl(v.src)}" title="${esc(pick(b.title, 'en') || 'Video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
                : `<video src="${safeUrl(v.src)}" controls preload="metadata"></video>`;
            return `<section class="blk-video">${titleH2(b)}<div class="blk-video-frame">${player}</div>
                ${anyText(b.caption) ? `<p class="blk-caption">${tr(b.caption)}</p>` : ''}</section>`;
        },

        posts_feed(b) {
            return `<section class="blk-feed">${titleH2(b)}${dataBlock((() => {
                const posts = Object.entries(typeof postsDB === 'object' ? postsDB : {}).filter(([id, p]) => !p.hidden && id !== 'featured').slice(0, num(b.count, 3, 1, 12));
                if (!posts.length) return `<p class="blk-empty">${tr(UI.empty)}</p>`;
                return `<div class="blk-feed-grid">${posts.map(([id, p]) => `<a class="blk-post" href="post/${encodeURIComponent(id)}">
                    ${p.image ? `<img src="${safeUrl(p.image)}" alt="${esc(p.title_en || p.title_ru)}" loading="lazy">` : ''}
                    <div class="blk-post-body"><h3>${tr(L3(p, 'title'))}</h3><p>${trPlain(L3(p, 'body'), 120)}</p>
                    <span class="blk-more">${tr(UI.read)} <i class="fa-solid fa-arrow-right"></i></span></div></a>`).join('')}</div>`;
            })())}${b.button && b.button.link && anyText(b.button.label) ? `<div class="blk-buttons">${button(b.button)}</div>` : ''}</section>`;
        },

        books(b) {
            return `<section class="blk-books">${titleH2(b)}${dataBlock((() => {
                const want = String(b.ids || '').split(',').map(x => x.trim()).filter(Boolean);
                const all = typeof booksDB === 'object' && Array.isArray(booksDB) ? booksDB : [];
                const list = want.length ? want.map(id => all.find(x => x.id === id)).filter(Boolean) : all;
                if (!list.length) return `<p class="blk-empty">${tr(UI.empty)}</p>`;
                return list.map(k => {
                    const read = k.link_read || `read/${encodeURIComponent(k.id)}/1`;
                    return `<div class="blk-book">
                        ${k.cover ? `<img src="${safeUrl(k.cover)}" alt="${esc(k.title_en || k.title_ru)}" loading="lazy">` : ''}
                        <div><h3>${tr(L3(k, 'title'))}</h3><div class="blk-prose">${tr(L3(k, 'desc'), { tag: 'div', html: true })}</div>
                        <div class="blk-buttons blk-left"><a class="btn-primary" href="${safeUrl(read)}"${target(read)}>${tr(UI.read)} <i class="fa-solid fa-book-open"></i></a>
                        ${k.link_buy ? `<a class="btn-secondary" href="${safeUrl(k.link_buy)}"${target(k.link_buy)}>${tr(UI.buy)} <i class="fa-solid fa-cart-shopping"></i></a>` : ''}</div></div></div>`;
                }).join('');
            })())}</section>`;
        },

        book_toc(b) {
            if (!b.book_id) return '';
            return `<section class="blk-toc">${titleH2(b)}${dataBlock((() => {
                const ch = (typeof chaptersDB === 'object' && Array.isArray(chaptersDB) ? chaptersDB : []).filter(c => c.book_id === b.book_id && !c.hidden)
                    .sort((x, y) => parseFloat(x.chapter_num) - parseFloat(y.chapter_num));
                if (!ch.length) return `<p class="blk-empty">${tr(UI.empty)}</p>`;
                return `<ol class="blk-toc-list">${ch.map(c => `<li><a href="read/${encodeURIComponent(b.book_id)}/${encodeURIComponent(c.chapter_num)}">
                    ${LANGS.map(l => { const t = pick(L3(c, 'title'), l), num = /^\s*(глава|chapter|розділ|часть|part|частина|пролог|prologue|эпилог|epilogue|епілог)(?=[\s.:,\d]|$)/i.test(t) ? '' : `<span class="blk-toc-num">${esc(pick(UI.chapter, l))} ${esc(c.chapter_num)}</span>`;
                        return `<span class="lang-${l} blk-toc-row"${l === 'ru' ? '' : ' hidden'}>${num}<span class="blk-toc-title">${esc(t)}</span></span>`; }).join('')}<i class="fa-solid fa-arrow-right"></i></a></li>`).join('')}</ol>`;
            })())}</section>`;
        },

        notes_feed(b) {
            return `<section class="blk-notes">${titleH2(b)}${dataBlock((() => {
                const notes = (typeof notesDB === 'object' && Array.isArray(notesDB) ? notesDB.slice().reverse() : []).slice(0, num(b.count, 3, 1, 12));
                if (!notes.length) return `<p class="blk-empty">${tr(UI.empty)}</p>`;
                return notes.map(n => `<article class="blk-note"><div class="blk-note-date">${tr(L3(n, 'date'))}</div>
                    ${anyText(L3(n, 'title')) ? `<h3>${tr(L3(n, 'title'))}</h3>` : ''}<div class="blk-prose">${tr(L3(n, 'text'), { tag: 'div', html: true })}</div></article>`).join('');
            })())}</section>`;
        },

        projects(b) {
            return `<section class="blk-projects">${titleH2(b)}${dataBlock((() => {
                const list = typeof projectsDB === 'object' && Array.isArray(projectsDB) ? projectsDB : [];
                if (!list.length) return `<p class="blk-empty">${tr(UI.empty)}</p>`;
                return `<div class="blk-projects-grid">${list.map(p => {
                    const pr = num(p.progress, 0, 0, 100);
                    return `<div class="blk-project"><span class="blk-status">${tr(L3(p, 'status'))}</span><h3>${tr(L3(p, 'title'))}</h3>
                        <div class="blk-prose">${tr(L3(p, 'desc'), { tag: 'div', html: true })}</div>
                        <div class="blk-progress-label">${tr({ ru: p.progressLabel_ru, en: p.progressLabel_en, uk: p.progressLabel_uk })} <b>${pr}%</b></div>
                        <div class="blk-progress"><div style="width:${pr}%"></div></div></div>`;
                }).join('')}</div>`;
            })())}</section>`;
        },

        faq(b) {
            const items = (b.items || []).filter(x => x && anyText(x.q));
            if (!items.length) return '';
            return `<section class="blk-faq">${titleH2(b)}${items.map(x => `<details><summary>${tr(x.q)}<i class="fa-solid fa-chevron-down"></i></summary>
                <div class="blk-faq-a">${LANGS.map(l => `<div class="lang-${l}"${l === 'ru' ? '' : ' hidden'}>${esc(pick(x.a, l)).replace(/\n/g, '<br>')}</div>`).join('')}</div></details>`).join('')}</section>`;
        },

        divider(b) {
            const size = { s: 20, m: 50, l: 90 }[b.size] || 50;
            const inner = b.style === 'space' ? '' : b.style === 'dots' ? '<span>• • •</span>' : '<hr>';
            return `<div class="blk-divider blk-divider-${b.style === 'space' ? 'space' : b.style === 'dots' ? 'dots' : 'line'}" style="padding:${size}px 20px">${inner}</div>`;
        },

        // Одна или несколько кнопок в ряд
        buttons(b) {
            const items = (b.items || []).filter(x => x && x.link && anyText(x.label));
            if (!items.length) return '';
            return `<div class="blk-buttons blk-buttons-row${b.align === 'left' ? ' blk-left' : ''}">${items.map(x => button(x, x.style !== 'secondary')).join('')}</div>`;
        },

        // «Вы остановились на…» — для тех, кто уже читал книгу на сайте
        continue_reading(b) {
            if (!state.dataReady) return '';
            let bookId = null, num = null;
            try { bookId = localStorage.getItem('lastReadBook'); num = localStorage.getItem('lastReadChapter'); } catch (e) { }
            if (!bookId || !num) return '';
            const book = (typeof booksDB === 'object' && Array.isArray(booksDB) ? booksDB : []).find(x => x.id === bookId);
            const ch = (typeof chaptersDB === 'object' && Array.isArray(chaptersDB) ? chaptersDB : []).find(c => c.book_id === bookId && parseInt(c.chapter_num, 10) === parseInt(num, 10));
            if (!book || !ch) return '';
            const label = { ru: 'Вы остановились на:', en: 'You left off at:', uk: 'Ви зупинилися на:' };
            const btn = { ru: 'Продолжить чтение', en: 'Continue Reading', uk: 'Продовжити читання' };
            const name = {}; LANGS.forEach(l => name[l] = `${pick(L3(book, 'title'), l)} — ${pick(L3(ch, 'title'), l)}`);
            return `<div class="blk-continue"><div>
                <div class="blk-continue-label">${tr(label)}</div><h3>${tr(name)}</h3></div>
                <a class="btn-primary" href="read/${encodeURIComponent(bookId)}/${encodeURIComponent(num)}">${tr(btn)} <i class="fa-solid fa-book-open"></i></a></div>`;
        },

        contact(b) {
            const ph = (key) => LANGS.map(l => `data-ph-${l}="${esc(pick(UI[key], l))}"`).join(' ');
            return `<section class="contact-section blk-contact"><div class="contact-container">
                ${anyText(b.title) ? `<h2 class="contact-title">${tr(b.title)}</h2>` : ''}
                ${anyText(b.desc) ? `<p class="contact-desc">${tr(b.desc)}</p>` : ''}
                <form name="author-contact" method="POST" data-netlify="true" class="contact-form" action="/" netlify-honeypot="bot-field">
                    <input type="hidden" name="form-name" value="author-contact"><div hidden><input name="bot-field"></div>
                    <div class="form-row"><input type="text" name="Имя" class="contact-input blk-ph" ${ph('name')} placeholder="${esc(UI.name.ru)}" required>
                    <input type="email" name="Email" class="contact-input blk-ph" ${ph('email')} placeholder="${esc(UI.email.ru)}" required></div>
                    <input type="hidden" name="Тема обращения" value="${esc(b.subject || 'Page form')}">
                    <textarea name="Сообщение" class="contact-textarea blk-ph" ${ph('message')} placeholder="${esc(UI.message.ru)}" required></textarea>
                    <button type="submit" class="contact-submit">${tr(UI.send)}</button>
                </form></div></section>`;
        }
    };

    // Видимость блока на конкретных языках: b.langs = ['en','uk'] (пусто — на всех)
    function langClasses(b) {
        if (!Array.isArray(b.langs) || !b.langs.length || b.langs.length === LANGS.length) return '';
        return ' blk-only ' + b.langs.map(l => 'blk-in-' + l).join(' ');
    }

    function render(blocks, opts = {}) {
        return (blocks || []).map((b, i) => {
            if (!b || b.hidden || !TYPES[b.type]) return '';
            let html = '';
            try { html = TYPES[b.type](b); } catch (e) { console.error('Блок не отрисован', b, e); }
            if (!html) return '';
            const sel = opts.editable ? ` data-block-index="${i}" data-block-id="${esc(b.id || '')}"` : '';
            return `<div class="blk blk-type-${b.type}${langClasses(b)}"${sel}>${html}</div>`;
        }).join('');
    }

    // Плейсхолдеры полей формы на текущем языке
    function applyLang(root, lang) {
        (root || document).querySelectorAll('.blk-ph').forEach(i => { const v = i.getAttribute('data-ph-' + lang); if (v) i.placeholder = v; });
    }
    const DATA_TYPES = ['posts_feed', 'books', 'book_toc', 'notes_feed', 'projects', 'continue_reading'];

    // Галерея: просмотр картинки поверх страницы (кроме предпросмотра в админке)
    document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('.blk-zoom');
        if (!a || state.preview || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const box = document.createElement('div');
        box.className = 'blk-lightbox';
        const img = document.createElement('img'); img.src = a.getAttribute('href'); img.alt = '';
        box.appendChild(img);
        const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = ev => { if (ev.key === 'Escape') close(); };
        box.addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(box);
    });
    const needsData = blocks => (blocks || []).some(b => b && !b.hidden && DATA_TYPES.includes(b.type));

    return { render, pick, tr, esc, TYPES, LANGS, state, needsData, applyLang, videoEmbed };
})();
