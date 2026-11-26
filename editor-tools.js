// --- editor-tools.js ---
// Инструменты редактирования в админке:
//  • окно выбора ссылки на страницу сайта, пост, главу или рубрику (или внешний адрес);
//  • кнопка «Кнопка» в визуальном редакторе — вставляет ссылку, оформленную как кнопка;
//  • у всех полей «Куда ведёт» появляется кнопка выбора из списка.
// Использует функции админки (el, esc, toast, linkSuggestions, loadLinkSuggestions, blogCategories).

/* ---------- Форматы визуального редактора ---------- */
(function registerQuillFormats() {
    if (typeof Quill === 'undefined') return;
    const BaseLink = Quill.import('formats/link');
    const isExternal = v => /^(https?:)?\/\//i.test(String(v || ''));
    // Ссылки внутри сайта открываются в той же вкладке, внешние — в новой
    class SiteLink extends BaseLink {
        static create(value) {
            const node = super.create(value);
            if (!isExternal(value)) { node.removeAttribute('target'); node.removeAttribute('rel'); }
            return node;
        }
    }
    Quill.register('formats/link', SiteLink, true);
    // Кнопка в тексте: <a class="content-btn" href="…">Текст</a>
    class ButtonLink extends SiteLink { }
    ButtonLink.blotName = 'button';
    ButtonLink.className = 'content-btn';
    Quill.register('formats/button', ButtonLink, true);
})();

// Панель инструментов визуального редактора (одна для всей админки)
function richToolbar(full = true) {
    return [[{ header: [2, 3, false] }], full ? ['bold', 'italic', 'underline', 'strike'] : ['bold', 'italic', 'underline'],
        ['blockquote', 'link', 'button'], [{ list: 'ordered' }, { list: 'bullet' }], [{ align: [] }], ['image'], ['clean']];
}

// Подключает к редактору выбор ссылки, кнопку и подсказки на панели
function setupQuillTools(q) {
    const tb = q.getModule('toolbar');
    const btnEl = tb.container.querySelector('button.ql-button');
    if (btnEl) { btnEl.innerHTML = '<i class="fa-solid fa-hand-pointer" style="font-size:13px"></i>'; btnEl.title = 'Кнопка со ссылкой'; }
    const linkEl = tb.container.querySelector('button.ql-link');
    if (linkEl) linkEl.title = 'Ссылка (на страницу сайта или внешний адрес)';
    const imgEl = tb.container.querySelector('button.ql-image');
    if (imgEl) imgEl.title = 'Картинка из медиатеки';

    const edit = async kind => {
        const range = q.getSelection(true) || { index: q.getLength() - 1, length: 0 };
        const fmt = q.getFormat(range);
        // Если курсор стоит на ссылке/кнопке — правим её целиком
        let r = range;
        if (range.length === 0 && (fmt.link || fmt.button)) {
            const [leaf, offset] = q.getLeaf(range.index);
            if (leaf && leaf.parent && /^(link|button)$/.test(leaf.parent.statics.blotName)) {
                r = { index: range.index - offset, length: leaf.parent.length() };
            }
        }
        const current = fmt[kind] || fmt.link || fmt.button || '';
        const text = q.getText(r.index, r.length);
        const res = await openLinkPicker({ title: kind === 'button' ? 'Кнопка' : 'Ссылка', url: current, askText: r.length === 0, text, allowRemove: !!(fmt.link || fmt.button) });
        if (!res) return;
        if (res.remove) { q.formatText(r.index, r.length, { link: false, button: false }, 'user'); return; }
        if (r.length === 0) {
            const t = res.text || res.label || res.url;
            q.insertText(r.index, t, { [kind]: res.url }, 'user');
            q.setSelection(r.index + t.length, 0, 'user');
        } else {
            q.formatText(r.index, r.length, { link: false, button: false }, 'silent');
            q.formatText(r.index, r.length, { [kind]: res.url }, 'user');
        }
    };
    tb.addHandler('link', () => edit('link'));
    tb.addHandler('button', () => edit('button'));
}

/* ---------- Окно выбора ссылки ---------- */
function linkGroups() {
    const groups = {};
    const add = (g, v, l) => (groups[g] = groups[g] || []).push([v, l]);
    linkSuggestions.forEach(([v, l]) => {
        const m = l.match(/^(Страница|Пост|Глава): (.*)$/);
        if (m) add({ Страница: 'Страницы конструктора', Пост: 'Посты блога', Глава: 'Главы книг' }[m[1]], v, m[2]);
        else add('Разделы сайта', v, l);
    });
    (typeof blogCategories !== 'undefined' ? blogCategories : []).forEach(c => add('Рубрики блога', `blog.html?cat=${c.id}`, c.label_ru || c.id));
    const order = ['Разделы сайта', 'Страницы конструктора', 'Посты блога', 'Рубрики блога', 'Главы книг'];
    return order.filter(g => groups[g]).map(g => [g, groups[g]]);
}

// Возвращает { url, text, label } или { remove: true } или null (отмена)
async function openLinkPicker({ title = 'Ссылка', url = '', askText = false, text = '', allowRemove = false } = {}) {
    if (!linkSuggestions.length) await loadLinkSuggestions();
    return new Promise(resolve => {
        let chosenLabel = '';
        const close = v => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
        const onKey = e => { if (e.key === 'Escape') close(null); };
        const textInp = el('input', { class: 'input', placeholder: 'Например: Читать первую главу', value: text || '' });
        const urlInp = el('input', { class: 'input', placeholder: 'Выберите ниже или вставьте адрес https://…', value: url || '' });
        const search = el('input', { class: 'input', type: 'search', placeholder: 'Поиск: пост, глава, страница…' });
        const listBox = el('div', { class: 'lp-list' });
        const draw = () => {
            const words = normText(search.value).split(/\s+/).filter(Boolean);
            listBox.innerHTML = '';
            let n = 0;
            linkGroups().forEach(([g, items]) => {
                const shown = items.filter(([v, l]) => words.every(w => normText(l + ' ' + v).includes(w)));
                if (!shown.length) return;
                listBox.append(el('div', { class: 'lp-group', text: g }));
                shown.forEach(([v, l]) => {
                    n++;
                    listBox.append(el('button', { type: 'button', class: 'lp-item' + (v === urlInp.value.trim() ? ' active' : ''), onclick: () => {
                        urlInp.value = v; chosenLabel = l; draw();
                        if (askText && !textInp.value.trim()) textInp.value = l;
                    } }, [el('span', { text: l }), el('code', { text: v })]));
                });
            });
            if (!n) listBox.append(el('div', { class: 'empty', text: 'Ничего не найдено' }));
        };
        search.addEventListener('input', draw);
        urlInp.addEventListener('input', draw);
        const ok = () => {
            const u = urlInp.value.trim();
            if (!u) { toast('Выберите, куда ведёт ссылка', 'err'); return; }
            if (/^javascript:/i.test(u)) { toast('Такой адрес нельзя', 'err'); return; }
            if (askText && !textInp.value.trim() && title === 'Кнопка') { toast('Напишите текст кнопки', 'err'); return; }
            close({ url: /^www\./i.test(u) ? 'https://' + u : u, text: textInp.value.trim(), label: chosenLabel });
        };
        const overlay = el('div', { class: 'md-overlay', onclick: e => { if (e.target === overlay) close(null); } }, el('div', { class: 'md-modal lp-modal' }, [
            el('div', { class: 'md-modal-head' }, [el('b', { text: title }),
                el('button', { class: 'btn btn-icon', type: 'button', title: 'Закрыть', onclick: () => close(null) }, el('i', { class: 'fa-solid fa-xmark' }))]),
            askText ? el('div', { class: 'field' }, [el('label', { text: title === 'Кнопка' ? 'Текст кнопки' : 'Текст ссылки' }), textInp]) : null,
            el('div', { class: 'field' }, [el('label', { text: 'Куда ведёт' }), urlInp,
                el('div', { class: 'hint', text: 'Страницы сайта откроются в той же вкладке и на языке читателя, внешние адреса — в новой вкладке.' })]),
            search, listBox,
            el('div', { class: 'form-bottom' }, [
                el('div', { class: 'left' }, [el('button', { class: 'btn btn-primary', type: 'button', onclick: ok }, 'Готово'),
                    el('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Отмена')]),
                allowRemove ? el('button', { class: 'btn btn-danger', type: 'button', onclick: () => close({ remove: true }) }, [el('i', { class: 'fa-solid fa-link-slash' }), title === 'Кнопка' ? 'Убрать кнопку' : 'Убрать ссылку']) : null])]));
        document.addEventListener('keydown', onKey);
        document.body.append(overlay);
        draw();
        (askText ? textInp : search).focus();
    });
}

/* ---------- Кнопка выбора у всех полей «Куда ведёт» ---------- */
function enhanceLinkInputs(root) {
    root.querySelectorAll('input[list="link-options"]:not([data-lp])').forEach(inp => {
        inp.dataset.lp = '1';
        const wrap = el('div', { class: 'lp-field' });
        inp.replaceWith(wrap);
        wrap.append(inp, el('button', { class: 'btn', type: 'button', title: 'Выбрать страницу, пост или главу', onclick: async () => {
            const res = await openLinkPicker({ url: inp.value });
            if (!res || res.remove) return;
            inp.value = res.url;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        } }, [el('i', { class: 'fa-solid fa-link' }), 'Выбрать']));
    });
}
new MutationObserver(muts => {
    for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) enhanceLinkInputs(n.matches && n.matches('input') ? n.parentElement || document : n); });
}).observe(document.documentElement, { childList: true, subtree: true });
