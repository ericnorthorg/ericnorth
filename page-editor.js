// --- page-editor.js ---
// Раздел «Страницы» в админке: список страниц и редактор блоков с живым предпросмотром.
// Использует функции админки (sb, el, esc, toast, errText, imageInput, pickAndUpload, ICONS, ...)
// и общий рендерер blocks.js.

const PE_LANGS = [['ru', 'RU'], ['en', 'EN'], ['uk', 'UK']];
const PE_DEVICES = [['desktop', 'fa-solid fa-desktop', '100%'], ['tablet', 'fa-solid fa-tablet-screen-button', '820px'], ['phone', 'fa-solid fa-mobile-screen', '390px']];

const BLOCK_TYPES = {
    hero: { label: 'Шапка', icon: 'fa-solid fa-panorama', hint: 'Большой заголовок с фоном и кнопками',
        make: () => ({ image: '', title: {}, accent: {}, subtitle: {}, buttons: [] }),
        summary: b => [Blocks.pick(b.title, 'ru'), Blocks.pick(b.accent, 'ru')].join(' ').trim() },
    text: { label: 'Текст', icon: 'fa-solid fa-align-left', hint: 'Заголовок и текст с оформлением',
        make: () => ({ title: {}, body: {}, width: 'narrow', align: 'left' }),
        summary: b => Blocks.pick(b.title, 'ru') || stripHtml(Blocks.pick(b.body, 'ru')).slice(0, 70) },
    image_text: { label: 'Картинка и текст', icon: 'fa-solid fa-image', hint: 'Как промо-блоки на главной',
        make: () => ({ image: '', title: {}, text: {}, button: { label: {}, link: '' }, reverse: false }),
        summary: b => Blocks.pick(b.title, 'ru') },
    cards: { label: 'Карточки', icon: 'fa-solid fa-table-cells-large', hint: 'Плитки-ссылки с иконками',
        make: () => ({ title: {}, items: [{ icon: 'fa-solid fa-star', title: {}, desc: {}, link: '' }] }),
        summary: b => Blocks.pick(b.title, 'ru') || `${(b.items || []).length} шт.` },
    quote: { label: 'Цитата', icon: 'fa-solid fa-quote-left', hint: 'Крупная цитата с автором',
        make: () => ({ text: {}, author: {} }),
        summary: b => stripHtml(Blocks.pick(b.text, 'ru')).slice(0, 70) },
};

let PE = null; // состояние открытого редактора

const peUid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const peClone = o => JSON.parse(JSON.stringify(o));
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
// jsonb в базе меняет порядок ключей, поэтому сравниваем через нормализацию
const peNorm = v => Array.isArray(v) ? v.map(peNorm) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = peNorm(v[k]), o), {}) : v;
const peSame = (a, b) => JSON.stringify(peNorm(a)) === JSON.stringify(peNorm(b));

function peConfirmLeave() {
    if (PE && PE.dirty) return confirm('Есть несохранённые изменения на странице. Уйти без сохранения?');
    return true;
}
window.addEventListener('beforeunload', e => { if (PE && PE.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- СПИСОК СТРАНИЦ ---------- */
async function renderPages() {
    PE = null;
    document.getElementById('main').classList.remove('main-wide');
    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Загрузка…</div>';
    const { data, error } = await sb.from('pages').select('id,slug,draft,published,published_at,updated_at').order('slug');
    if (state.section !== 'pages') return;
    if (error) { main.innerHTML = ''; toast(errText(error), 'err'); return; }
    main.innerHTML = '';
    main.append(el('div', { class: 'page-head' }, [
        el('div', {}, [el('h2', { text: 'Страницы' }), el('div', { class: 'sub', text: 'Собственные страницы сайта из блоков: «Об авторе», «Мир», «Персонажи» и любые другие. Адрес страницы — /p/название.' })]),
        el('button', { class: 'btn btn-primary', onclick: peCreateDialog }, [el('i', { class: 'fa-solid fa-plus' }), 'Новая страница'])]));
    const list = el('div', { class: 'list' });
    if (!data.length) list.append(el('div', { class: 'empty', text: 'Страниц пока нет' }));
    data.forEach(p => {
        const status = !p.published ? ['Черновик', 'hidden-b'] : !peSame(p.draft, p.published) ? ['Есть неопубликованные изменения', 'accent'] : ['Опубликована', ''];
        list.append(el('div', { class: 'row' }, [
            el('div', { class: 'info', onclick: () => peOpen(p.id) }, [
                el('div', { class: 'title' }, [document.createTextNode(Blocks.pick(p.draft.title, 'ru') || p.slug), el('span', { class: 'badge ' + status[1], text: status[0] })]),
                el('div', { class: 'meta', text: `/p/${p.slug} · блоков: ${(p.draft.blocks || []).length}` })]),
            el('div', { class: 'actions' }, [
                p.published ? el('a', { class: 'btn btn-icon', href: `/ru/p/${p.slug}`, target: '_blank', title: 'Открыть на сайте' }, el('i', { class: 'fa-solid fa-eye' })) : null,
                el('button', { class: 'btn btn-icon', title: 'Редактировать', onclick: () => peOpen(p.id) }, el('i', { class: 'fa-solid fa-pen' }))])]));
    });
    main.append(list);
}

function peCreateDialog() {
    const main = document.getElementById('main');
    main.innerHTML = '';
    const slug = el('input', { class: 'input', placeholder: 'например: about' });
    const title = el('input', { class: 'input', placeholder: 'Об авторе' });
    title.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugify(title.value).replace(/_/g, '-'); });
    slug.addEventListener('input', () => slug.dataset.touched = '1');
    const form = el('form', { class: 'form', onsubmit: async e => {
        e.preventDefault();
        const s = slug.value.trim();
        if (!SLUG_RE.test(s)) { toast('Адрес: латинские строчные буквы, цифры и дефис, например about или my-world', 'err'); return; }
        const { data, error } = await sb.from('pages').insert({ slug: s, draft: { title: { ru: title.value.trim() }, seo: {}, blocks: [] } }).select('id').single();
        if (error) { toast(/duplicate/i.test(error.message) ? 'Страница с таким адресом уже есть' : errText(error), 'err'); return; }
        peOpen(data.id);
    } }, [
        el('div', { class: 'field' }, [el('label', { text: 'Название страницы (RU)' }), title]),
        el('div', { class: 'field' }, [el('label', { text: 'Адрес' }), slug, el('div', { class: 'hint', text: 'Страница будет доступна по адресу /p/адрес. Латиница, цифры и дефис; после создания не меняется.' })]),
        el('div', { class: 'form-bottom' }, el('div', { class: 'left' }, [
            el('button', { class: 'btn btn-primary', type: 'submit' }, 'Создать'),
            el('button', { class: 'btn', type: 'button', onclick: renderPages }, 'Отмена')]))]);
    main.append(el('div', { class: 'page-head' }, el('h2', { text: 'Новая страница' })), form);
    title.focus();
}

/* ---------- РЕДАКТОР ---------- */
async function peOpen(id) {
    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Загрузка страницы…</div>';
    const { data, error } = await sb.from('pages').select('*').eq('id', id).single();
    if (error) { toast(errText(error), 'err'); return renderPages(); }
    if (!linkSuggestions.length) loadLinkSuggestions();
    const d = data.draft || {};
    PE = {
        row: data,
        draft: { title: d.title || {}, seo: d.seo || {}, blocks: (d.blocks || []).map(b => ({ id: b.id || peUid(), ...b })) },
        lang: state.editLang || 'ru', device: 'desktop', open: null, dirty: false, ready: false, timer: null,
    };
    main.classList.add('main-wide');
    peRenderShell();
}

function peChanged(opts = {}) {
    PE.dirty = true;
    peUpdateStatus();
    clearTimeout(PE.timer);
    PE.timer = setTimeout(() => pePost(opts), opts.now ? 0 : 150);
}

function pePost(opts = {}) {
    if (!PE || !PE.ready || !PE.iframe) return;
    PE.iframe.contentWindow.postMessage({ type: 'page-preview', content: PE.draft, lang: PE.lang, selected: PE.open, scrollTo: opts.scrollTo }, window.location.origin);
}

function peUpdateStatus() {
    if (!PE || !PE.statusEl) return;
    const pub = PE.row.published, same = pub && peSame(pub, PE.row.draft);
    PE.statusEl.textContent = PE.dirty ? 'Есть несохранённые изменения' : !pub ? 'Черновик, не опубликована' : same ? 'Опубликована, всё актуально' : 'Сохранено, но не опубликовано';
    PE.statusEl.className = 'badge ' + (PE.dirty ? 'accent' : !pub || !same ? 'hidden-b' : '');
}

function peSetLang(l) {
    PE.lang = l; state.editLang = l;
    document.querySelectorAll('.pe-lang button').forEach(b => b.classList.toggle('active', b.dataset.l === l));
    document.querySelectorAll('.pe-panel [data-lang-field]').forEach(f => f.hidden = f.dataset.langField !== l);
    pePost();
}

function peSetDevice(dv) {
    PE.device = dv;
    document.querySelectorAll('.pe-device button').forEach(b => b.classList.toggle('active', b.dataset.d === dv));
    PE.frameBox.style.width = PE_DEVICES.find(x => x[0] === dv)[2];
}

function peRenderShell() {
    const main = document.getElementById('main');
    main.innerHTML = '';
    // Верх: назад, название, статус, кнопки
    PE.statusEl = el('span', { class: 'badge' });
    const saveBtn = el('button', { class: 'btn', type: 'button', onclick: peSave }, [el('i', { class: 'fa-solid fa-floppy-disk' }), 'Сохранить черновик']);
    const pubBtn = el('button', { class: 'btn btn-primary', type: 'button', onclick: pePublish }, [el('i', { class: 'fa-solid fa-upload' }), 'Опубликовать']);
    const live = el('a', { class: 'btn', href: `/${PE.lang}/p/${PE.row.slug}`, target: '_blank', title: 'Открыть опубликованную страницу' }, [el('i', { class: 'fa-solid fa-arrow-up-right-from-square' }), 'На сайте']);
    main.append(el('div', { class: 'pe-top' }, [
        el('div', {}, [
            el('button', { class: 'link-btn', style: 'margin:0 0 6px', onclick: () => { if (peConfirmLeave()) { PE = null; renderPages(); } }, html: '<i class="fa-solid fa-arrow-left"></i> Все страницы' }),
            el('h2', {}, [document.createTextNode(Blocks.pick(PE.draft.title, 'ru') || PE.row.slug), el('span', { class: 'meta', style: 'font-size:.85rem;font-family:Inter;color:var(--muted);margin-left:10px', text: '/p/' + PE.row.slug })]),
            PE.statusEl]),
        el('div', { class: 'inline', style: 'flex-wrap:wrap' }, [
            el('button', { class: 'btn btn-icon btn-danger', type: 'button', title: 'Удалить страницу', onclick: peDelete }, el('i', { class: 'fa-solid fa-trash' })),
            PE.row.published ? live : null, saveBtn, pubBtn])]));

    // Панели: слева настройки и блоки, справа предпросмотр
    const panel = el('div', { class: 'pe-panel' });
    const langBar = el('div', { class: 'lang-tabs pe-lang' }, PE_LANGS.map(([l, t]) => el('button', { type: 'button', 'data-l': l, class: l === PE.lang ? 'active' : '', text: t, onclick: () => peSetLang(l) })));
    const devBar = el('div', { class: 'lang-tabs pe-device' }, PE_DEVICES.map(([d, ic]) => el('button', { type: 'button', 'data-d': d, class: d === PE.device ? 'active' : '', title: d, onclick: () => peSetDevice(d) }, el('i', { class: ic }))));
    PE.iframe = el('iframe', { class: 'pe-frame', src: '/page.html?preview=1', title: 'Предпросмотр' });
    PE.frameBox = el('div', { class: 'pe-frame-box' }, PE.iframe);
    const previewCol = el('div', { class: 'pe-preview' }, [
        el('div', { class: 'pe-preview-bar' }, [langBar, el('span', { class: 'hint', text: 'Предпросмотр черновика' }), devBar]),
        el('div', { class: 'pe-frame-wrap' }, PE.frameBox)]);
    main.append(el('div', { class: 'pe-wrap' }, [panel, previewCol]));
    PE.panel = panel;
    peRenderPanel();
    peUpdateStatus();
}

window.addEventListener('message', e => {
    if (!PE || e.origin !== window.location.origin || !e.data) return;
    if (e.data.type === 'preview-ready') { PE.ready = true; pePost(); }
    if (e.data.type === 'block-click' && Number.isInteger(e.data.index)) { PE.open = e.data.index; peRenderPanel(true); pePost(); }
});

function peRenderPanel(scrollToOpen) {
    const panel = PE.panel; panel.innerHTML = '';
    editors = [];
    // Настройки страницы
    const settings = el('details', { class: 'pe-card', open: PE.draft.blocks.length === 0 || undefined }, [
        el('summary', {}, [el('i', { class: 'fa-solid fa-gear' }), ' Настройки страницы']),
        peI18nText(PE.draft, 'title', 'Название (вкладка браузера и поиск)'),
        peI18nText((PE.draft.seo = PE.draft.seo || {}), 'description', 'Описание для поисковиков и соцсетей', { textarea: true }),
        peImage(PE.draft.seo, 'image', 'Картинка для соцсетей')]);
    panel.append(settings);

    // Блоки
    panel.append(el('div', { class: 'pe-blocks-head' }, [el('b', { text: `Блоки (${PE.draft.blocks.length})` })]));
    PE.draft.blocks.forEach((b, i) => panel.append(peBlockCard(b, i)));
    panel.append(peAddMenu());
    peSetLang(PE.lang);
    if (scrollToOpen && PE.open != null) {
        const card = panel.querySelector(`[data-pe-index="${PE.open}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function peAddMenu() {
    const box = el('div', { class: 'pe-add' });
    const btn = el('button', { class: 'btn', type: 'button', style: 'width:100%;justify-content:center', onclick: () => { menu.hidden = !menu.hidden; } }, [el('i', { class: 'fa-solid fa-plus' }), PE.open != null ? 'Добавить блок после выбранного' : 'Добавить блок в конец']);
    const menu = el('div', { class: 'pe-add-menu', hidden: true }, Object.entries(BLOCK_TYPES).map(([t, def]) =>
        el('button', { type: 'button', class: 'pe-add-item', onclick: () => {
            const at = PE.open != null ? PE.open + 1 : PE.draft.blocks.length;
            PE.draft.blocks.splice(at, 0, { id: peUid(), type: t, ...def.make() });
            PE.open = at; peRenderPanel(true); peChanged({ scrollTo: at });
        } }, [el('i', { class: def.icon }), el('div', {}, [el('b', { text: def.label }), el('div', { class: 'hint', style: 'margin:0', text: def.hint })])])));
    box.append(btn, menu);
    return box;
}

function peBlockCard(b, i) {
    const def = BLOCK_TYPES[b.type] || { label: b.type, icon: 'fa-solid fa-cube', summary: () => '' };
    const blocks = PE.draft.blocks, isOpen = PE.open === i;
    const move = dir => { const j = i + dir; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; if (PE.open === i) PE.open = j; else if (PE.open === j) PE.open = i; peRenderPanel(); peChanged({ scrollTo: j }); };
    const head = el('div', { class: 'pe-block-head', onclick: e => { if (e.target.closest('button')) return; PE.open = isOpen ? null : i; peRenderPanel(); pePost({ scrollTo: PE.open }); } }, [
        el('i', { class: def.icon + ' pe-block-icon' }),
        el('div', { class: 'pe-block-name' }, [el('b', { text: def.label }), b.hidden ? el('span', { class: 'badge hidden-b', text: 'скрыт' }) : null,
            Array.isArray(b.langs) && b.langs.length && b.langs.length < 3 ? el('span', { class: 'badge', text: b.langs.map(l => l.toUpperCase()).join('+') }) : null,
            el('div', { class: 'meta', text: def.summary(b) || '' })]),
        el('div', { class: 'actions' }, [
            el('button', { class: 'btn btn-icon', type: 'button', title: 'Выше', disabled: i === 0, onclick: () => move(-1) }, el('i', { class: 'fa-solid fa-arrow-up' })),
            el('button', { class: 'btn btn-icon', type: 'button', title: 'Ниже', disabled: i === blocks.length - 1, onclick: () => move(1) }, el('i', { class: 'fa-solid fa-arrow-down' })),
            el('button', { class: 'btn btn-icon', type: 'button', title: 'Дублировать', onclick: () => { blocks.splice(i + 1, 0, { ...peClone(b), id: peUid() }); PE.open = i + 1; peRenderPanel(); peChanged({ scrollTo: i + 1 }); } }, el('i', { class: 'fa-regular fa-copy' })),
            el('button', { class: 'btn btn-icon', type: 'button', title: b.hidden ? 'Показать' : 'Скрыть', onclick: () => { b.hidden = !b.hidden; peRenderPanel(); peChanged(); } }, el('i', { class: b.hidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye' })),
            el('button', { class: 'btn btn-icon btn-danger', type: 'button', title: 'Удалить', onclick: () => { if (!confirm(`Удалить блок «${def.label}»?`)) return; blocks.splice(i, 1); PE.open = null; peRenderPanel(); peChanged(); } }, el('i', { class: 'fa-solid fa-trash' }))])]);
    const card = el('div', { class: 'pe-card pe-block' + (isOpen ? ' open' : ''), 'data-pe-index': i }, head);
    if (isOpen) card.append(peBlockForm(b));
    return card;
}

function peBlockForm(b) {
    const f = el('div', { class: 'pe-form' });
    const add = n => n && f.append(n);
    switch (b.type) {
        case 'hero':
            add(peImage(b, 'image', 'Фоновая картинка'));
            add(peI18nText(b, 'title', 'Заголовок'));
            add(peI18nText(b, 'accent', 'Продолжение заголовка (выделено цветом)'));
            add(peI18nText(b, 'subtitle', 'Подзаголовок', { textarea: true }));
            add(peRepeater(b, 'buttons', 'Кнопки', 2, () => ({ label: {}, link: '' }), btn => [peI18nText(btn, 'label', 'Текст кнопки'), peLink(btn, 'link', 'Куда ведёт')]));
            break;
        case 'text':
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(peI18nRich(b, 'body', 'Текст'));
            add(el('div', { class: 'grid-2' }, [
                peSelect(b, 'width', 'Ширина', [['narrow', 'Узкая колонка (удобно читать)'], ['wide', 'Широкая']]),
                peSelect(b, 'align', 'Выравнивание', [['left', 'По левому краю'], ['center', 'По центру']])]));
            break;
        case 'image_text':
            add(peImage(b, 'image', 'Картинка'));
            add(peI18nText(b, 'title', 'Заголовок'));
            add(peI18nRich(b, 'text', 'Текст'));
            b.button = b.button || { label: {}, link: '' };
            add(peI18nText(b.button, 'label', 'Текст кнопки (пусто — без кнопки)'));
            add(peLink(b.button, 'link', 'Куда ведёт кнопка'));
            add(peBool(b, 'reverse', 'Картинка справа'));
            break;
        case 'cards':
            add(peI18nText(b, 'title', 'Заголовок над карточками (необязательно)'));
            add(peRepeater(b, 'items', 'Карточки', 8, () => ({ icon: 'fa-solid fa-star', title: {}, desc: {}, link: '' }), c => [
                peIcon(c, 'icon', 'Иконка'), peI18nText(c, 'title', 'Заголовок'), peI18nText(c, 'desc', 'Подпись'), peLink(c, 'link', 'Куда ведёт')]));
            break;
        case 'quote':
            add(peI18nText(b, 'text', 'Цитата', { textarea: true }));
            add(peI18nText(b, 'author', 'Автор'));
            break;
    }
    add(peLangsField(b));
    return f;
}

/* ---------- ПОЛЯ ---------- */
function peField(label, ...children) { return el('div', { class: 'field' }, [el('label', { text: label }), ...children]); }

function peI18nText(obj, key, label, opts = {}) {
    obj[key] = obj[key] && typeof obj[key] === 'object' ? obj[key] : {};
    const box = el('div');
    PE_LANGS.forEach(([l, t]) => {
        const inp = opts.textarea ? el('textarea', { class: 'input', rows: 3 }) : el('input', { class: 'input', type: 'text' });
        inp.value = obj[key][l] || '';
        inp.addEventListener('input', () => { obj[key][l] = inp.value; peChanged(); });
        box.append(el('div', { class: 'field', 'data-lang-field': l }, [el('label', { text: label }, el('span', { class: 'lang-mark', text: t })), inp]));
    });
    return box;
}

function peI18nRich(obj, key, label) {
    obj[key] = obj[key] && typeof obj[key] === 'object' ? obj[key] : {};
    const box = el('div');
    PE_LANGS.forEach(([l, t]) => {
        const holder = el('div', { class: 'rich' }, el('div'));
        box.append(el('div', { class: 'field', 'data-lang-field': l }, [el('label', { text: label }, el('span', { class: 'lang-mark', text: t })), holder]));
        const q = new Quill(holder.firstChild, { theme: 'snow', modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], ['blockquote', 'link'], [{ list: 'ordered' }, { list: 'bullet' }], [{ align: [] }], ['image'], ['clean']] } });
        q.getModule('toolbar').addHandler('image', async () => { const url = await pickAndUpload(); if (!url) return; const r = q.getSelection(true); q.insertEmbed(r.index, 'image', url, 'user'); });
        if (obj[key][l]) q.clipboard.dangerouslyPasteHTML(obj[key][l], 'silent');
        q.on('text-change', () => { const h = q.root.innerHTML; obj[key][l] = (!q.getText().trim() && !h.includes('<img')) ? '' : h; peChanged(); });
        editors.push(q);
    });
    return box;
}

function peText(obj, key, label, attrs = {}) {
    const inp = el('input', { class: 'input', type: 'text', value: obj[key] || '', ...attrs });
    inp.addEventListener('input', () => { obj[key] = inp.value.trim(); peChanged(); });
    return peField(label, inp);
}
function peLink(obj, key, label) {
    const w = peText(obj, key, label, { list: 'link-options', placeholder: 'blog.html, p/about или https://…' });
    return w;
}
function peSelect(obj, key, label, options) {
    const sel = el('select', { class: 'input' });
    options.forEach(([v, t]) => sel.append(el('option', { value: v, text: t, selected: (obj[key] || options[0][0]) === v })));
    sel.addEventListener('change', () => { obj[key] = sel.value; peChanged(); });
    return peField(label, sel);
}
function peBool(obj, key, label) {
    const cb = el('input', { type: 'checkbox' }); cb.checked = !!obj[key];
    cb.addEventListener('change', () => { obj[key] = cb.checked; peChanged(); });
    return el('div', { class: 'field' }, el('label', { class: 'check' }, [cb, label]));
}
function peIcon(obj, key, label) {
    const prev = el('span', { class: 'icon-preview', html: `<i class="${esc(obj[key] || '')}"></i>` });
    const sel = el('select', { class: 'input' });
    const list = ICONS.includes(obj[key]) || !obj[key] ? ICONS : [obj[key], ...ICONS];
    list.forEach(ic => sel.append(el('option', { value: ic, text: ic.replace(/fa-(solid|regular|brands) fa-/, ''), selected: ic === obj[key] })));
    sel.addEventListener('change', () => { obj[key] = sel.value; prev.innerHTML = `<i class="${esc(sel.value)}"></i>`; peChanged(); });
    return peField(label, el('div', { class: 'inline' }, [prev, sel]));
}
function peImage(obj, key, label) {
    const preview = el('img', { class: 'preview', alt: '' });
    const url = el('input', { class: 'input', type: 'text', value: obj[key] || '', placeholder: 'https://… или загрузите файл' });
    const upd = () => { preview.src = url.value.trim() || 'data:,'; preview.style.visibility = url.value.trim() ? 'visible' : 'hidden'; };
    const set = v => { url.value = v; obj[key] = v.trim(); upd(); peChanged(); };
    url.addEventListener('input', () => set(url.value)); upd();
    const node = el('div', { class: 'img-field' }, [preview, el('div', { class: 'controls' }, [url, el('div', { class: 'inline' }, [
        el('button', { class: 'btn', type: 'button', onclick: async () => { const u = await pickAndUpload(); if (u) set(u); } }, [el('i', { class: 'fa-solid fa-upload' }), 'Загрузить']),
        el('button', { class: 'btn', type: 'button', onclick: () => set('') }, 'Убрать')])])]);
    return peField(label, node);
}
function peRepeater(obj, key, label, max, make, fields) {
    obj[key] = Array.isArray(obj[key]) ? obj[key] : [];
    const box = el('div');
    const draw = () => {
        box.innerHTML = '';
        box.append(el('label', { style: 'display:block;font-weight:600;font-size:.88rem;margin-bottom:8px', text: label }));
        obj[key].forEach((item, i) => {
            box.append(el('div', { class: 'repeater-item' }, [
                el('div', { class: 'repeater-head' }, [el('span', { text: `${i + 1}` }), el('div', { class: 'inline' }, [
                    el('button', { class: 'btn btn-icon', type: 'button', disabled: i === 0, onclick: () => { [obj[key][i - 1], obj[key][i]] = [obj[key][i], obj[key][i - 1]]; draw(); peSetLang(PE.lang); peChanged(); } }, el('i', { class: 'fa-solid fa-arrow-up' })),
                    el('button', { class: 'btn btn-icon btn-danger', type: 'button', onclick: () => { obj[key].splice(i, 1); draw(); peSetLang(PE.lang); peChanged(); } }, el('i', { class: 'fa-solid fa-xmark' }))])]),
                ...fields(item)]));
        });
        if (obj[key].length < max) box.append(el('button', { class: 'btn', type: 'button', onclick: () => { obj[key].push(make()); draw(); peSetLang(PE.lang); peChanged(); } }, [el('i', { class: 'fa-solid fa-plus' }), 'Добавить']));
    };
    draw();
    return el('div', { class: 'field' }, box);
}
function peLangsField(b) {
    const cur = Array.isArray(b.langs) && b.langs.length ? b.langs : ['ru', 'en', 'uk'];
    const box = el('div', { class: 'inline', style: 'gap:16px' });
    PE_LANGS.forEach(([l, t]) => {
        const cb = el('input', { type: 'checkbox' }); cb.checked = cur.includes(l);
        cb.addEventListener('change', () => {
            const now = PE_LANGS.map(x => x[0]).filter(x => box.querySelector(`[data-l="${x}"]`).checked);
            if (!now.length) { cb.checked = true; toast('Блок должен показываться хотя бы на одном языке', 'err'); return; }
            if (now.length === 3) delete b.langs; else b.langs = now;
            peChanged();
        });
        cb.dataset.l = l;
        box.append(el('label', { class: 'check' }, [cb, t]));
    });
    return el('div', { class: 'field pe-langs' }, [el('label', { text: 'Показывать на языках' }), box]);
}

/* ---------- СОХРАНЕНИЕ И ПУБЛИКАЦИЯ ---------- */
function peCleanDraft() {
    const d = peClone(PE.draft);
    d.blocks = d.blocks.filter(b => b && BLOCK_TYPES[b.type]);
    return d;
}

async function peSave() {
    const draft = peCleanDraft();
    const { data, error } = await sb.from('pages').update({ draft, updated_at: new Date().toISOString() }).eq('id', PE.row.id).select('*').single();
    if (error) { toast(errText(error), 'err'); return false; }
    PE.row = data; PE.dirty = false; peUpdateStatus();
    toast('Черновик сохранён', 'ok');
    return true;
}

async function pePublish() {
    if (!(await peSave())) return;
    const content = peClone(PE.row.draft);
    if (PE.row.published && peSame(PE.row.published, content)) { toast('Уже опубликовано, изменений нет', 'ok'); return; }
    if (!confirm('Опубликовать страницу? Читатели сразу увидят эту версию.')) return;
    const { data, error } = await sb.from('pages').update({ published: content, published_at: new Date().toISOString() }).eq('id', PE.row.id).select('*').single();
    if (error) { toast(errText(error), 'err'); return; }
    await sb.from('page_revisions').insert({ page_id: PE.row.id, content, note: 'Публикация' });
    PE.row = data; peUpdateStatus();
    linkSuggestions = [];
    toast('Опубликовано', 'ok');
    peRenderShell();
}

async function peDelete() {
    const name = Blocks.pick(PE.draft.title, 'ru') || PE.row.slug;
    if (prompt(`Удалить страницу «${name}» навсегда? Она исчезнет с сайта вместе с историей.\nЧтобы подтвердить, введите адрес страницы: ${PE.row.slug}`) !== PE.row.slug) return;
    const { error } = await sb.from('pages').delete().eq('id', PE.row.id);
    if (error) { toast(errText(error), 'err'); return; }
    PE = null; linkSuggestions = [];
    toast('Страница удалена', 'ok');
    renderPages();
}
