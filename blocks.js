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
            return `<section class="blk-cards">
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
            return `<div class="blk blk-${b.type}${langClasses(b)}"${sel}>${html}</div>`;
        }).join('');
    }

    return { render, pick, tr, esc, TYPES, LANGS };
})();
