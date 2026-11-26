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
    gallery: { label: 'Галерея', icon: 'fa-regular fa-images', hint: 'Сетка картинок с подписями, открываются крупно',
        make: () => ({ title: {}, cols: '3', images: [] }),
        summary: b => Blocks.pick(b.title, 'ru') || `картинок: ${(b.images || []).length}` },
    video: { label: 'Видео', icon: 'fa-brands fa-youtube', hint: 'YouTube, Vimeo или ссылка на mp4',
        make: () => ({ url: '', title: {}, caption: {} }),
        summary: b => Blocks.pick(b.title, 'ru') || b.url || '' },
    divider: { label: 'Разделитель', icon: 'fa-solid fa-grip-lines', hint: 'Линия, точки или просто отступ',
        make: () => ({ style: 'line', size: 'm' }),
        summary: b => ({ line: 'линия', dots: 'точки', space: 'отступ' }[b.style] || 'линия') },
    faq: { label: 'Вопросы и ответы', icon: 'fa-regular fa-circle-question', hint: 'Раскрывающийся список (FAQ)',
        make: () => ({ title: {}, items: [{ q: {}, a: {} }] }),
        summary: b => Blocks.pick(b.title, 'ru') || `вопросов: ${(b.items || []).length}` },
    posts_feed: { label: 'Последние посты', icon: 'fa-solid fa-feather-pointed', hint: 'Подтягивается из раздела «Блог» автоматически',
        make: () => ({ title: {}, count: '3', button: { label: {}, link: 'blog.html' } }),
        summary: b => Blocks.pick(b.title, 'ru') || `${b.count || 3} шт.` },
    books: { label: 'Книги', icon: 'fa-solid fa-book', hint: 'Обложки и описания из раздела «Книги»',
        make: () => ({ title: {}, ids: '' }),
        summary: b => Blocks.pick(b.title, 'ru') || (b.ids ? b.ids : 'все книги') },
    book_toc: { label: 'Оглавление книги', icon: 'fa-solid fa-list-ol', hint: 'Список глав со ссылками на читалку',
        make: () => ({ title: {}, book_id: (peBooks[0] || {}).id || '' }),
        summary: b => Blocks.pick(b.title, 'ru') || ((peBooks.find(x => x.id === b.book_id) || {}).title_ru || b.book_id || '') },
    notes_feed: { label: 'Последние заметки', icon: 'fa-regular fa-note-sticky', hint: 'Из раздела «Заметки»',
        make: () => ({ title: {}, count: '3' }),
        summary: b => Blocks.pick(b.title, 'ru') || `${b.count || 3} шт.` },
    projects: { label: 'Проекты', icon: 'fa-solid fa-diagram-project', hint: 'Все проекты с прогрессом',
        make: () => ({ title: {} }),
        summary: b => Blocks.pick(b.title, 'ru') },
    continue_reading: { label: '«Продолжить чтение»', icon: 'fa-solid fa-bookmark', hint: 'Плашка «Вы остановились на…» — видна только тем, кто уже читал',
        make: () => ({}),
        summary: () => 'показывается читателям, которые уже начали книгу' },
    contact: { label: 'Форма «Написать автору»', icon: 'fa-regular fa-envelope', hint: 'Письма приходят туда же, куда и с главной (Netlify Forms)',
        make: () => ({ title: { ru: 'Написать автору', en: 'Contact the author', uk: 'Написати автору' }, desc: {}, subject: '' }),
        summary: b => Blocks.pick(b.title, 'ru') },
};
let peBooks = [];

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
    const [{ data: all, error }, set] = await Promise.all([
        sb.from('pages').select('id,slug,draft,published,published_at,updated_at').order('slug'),
        sb.from('settings').select('value').eq('key', 'home').maybeSingle()]);
    if (state.section !== 'pages') return;
    if (error) { main.innerHTML = ''; toast(errText(error), 'err'); return; }
    main.innerHTML = '';
    const home = all.find(p => p.slug === 'home');
    const data = all.filter(p => p.slug !== 'home');
    const homeMode = ((set.data || {}).value || {}).mode === 'blocks' ? 'blocks' : 'classic';
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
    main.prepend(peHomePanel(home, homeMode));
    main.append(el('h3', { style: 'margin:26px 0 12px;font-family:Merriweather,serif', text: 'Другие страницы' }), list);
}

/* ---------- ГЛАВНАЯ ИЗ БЛОКОВ ---------- */
function peStatus(p) {
    return !p.published ? ['Не опубликована', 'hidden-b'] : !peSame(p.draft, p.published) ? ['Есть неопубликованные изменения', 'accent'] : ['Опубликована', ''];
}

function peHomePanel(home, mode) {
    const box = el('div', { class: 'pe-card pe-home' }, [
        el('div', { class: 'pe-home-head' }, [el('i', { class: 'fa-solid fa-house' }), el('b', { text: 'Главная страница' })])]);
    if (!home) {
        box.append(
            el('p', { class: 'hint', text: 'Сейчас главная собирается по-старому: шапка и промо-блоки из раздела «Главная», карточки и форма из «Настроек». Можно сделать её копию из блоков — тогда главную можно будет собирать здесь как любую страницу. Сайт при этом не изменится, пока вы сами не переключите.' }),
            el('button', { class: 'btn btn-primary', type: 'button', onclick: peCreateHome }, [el('i', { class: 'fa-solid fa-wand-magic-sparkles' }), 'Создать главную из блоков (копия текущей)']));
        return box;
    }
    const st = peStatus(home);
    box.append(el('div', { class: 'row', style: 'margin:12px 0' }, [
        el('div', { class: 'info', onclick: () => peOpen(home.id) }, [
            el('div', { class: 'title' }, [document.createTextNode('Главная из блоков'), el('span', { class: 'badge ' + st[1], text: st[0] })]),
            el('div', { class: 'meta', text: `блоков: ${(home.draft.blocks || []).length}` })]),
        el('div', { class: 'actions' }, el('button', { class: 'btn', type: 'button', onclick: () => peOpen(home.id) }, [el('i', { class: 'fa-solid fa-pen' }), 'Редактировать']))]));
    const opt = (val, title, desc) => {
        const r = el('input', { type: 'radio', name: 'home-mode', value: val }); r.checked = mode === val;
        r.addEventListener('change', () => peSetHomeMode(val, home, r));
        return el('label', { class: 'pe-home-opt' + (mode === val ? ' active' : '') }, [r, el('div', {}, [el('b', { text: title }), el('div', { class: 'hint', style: 'margin:2px 0 0', text: desc })])]);
    };
    box.append(el('div', { style: 'font-weight:600;margin:16px 0 8px', text: 'Что показывать на сайте:' }),
        el('div', { class: 'pe-home-opts' }, [
            opt('classic', 'Классическую главную', 'Как раньше: разделы «Главная» и «Настройки» админки.'),
            opt('blocks', 'Главную из блоков', 'Опубликованную версию из этого редактора.')]));
    return box;
}

async function peSetHomeMode(mode, home, radio) {
    if (mode === 'blocks' && !home.published) {
        toast('Сначала откройте главную из блоков и опубликуйте её', 'err');
        renderPages(); return;
    }
    const q = mode === 'blocks' ? 'Показать на сайте главную из блоков? Вернуть классическую можно здесь же в любой момент.' : 'Вернуть на сайт классическую главную?';
    if (!confirm(q)) { renderPages(); return; }
    const { error } = await sb.from('settings').upsert({ key: 'home', value: { mode }, updated_at: new Date().toISOString() });
    if (error) { toast(errText(error), 'err'); renderPages(); return; }
    toast(mode === 'blocks' ? 'На сайте теперь главная из блоков' : 'На сайте снова классическая главная', 'ok');
    renderPages();
}

// Копия текущей главной в блоки: шапка, карточки, «продолжить чтение», промо-блоки, форма
async function peCreateHome() {
    const [hb, st] = await Promise.all([
        sb.from('home_blocks').select('*').eq('hidden', false).order('sort_order').order('id'),
        sb.from('settings').select('value').eq('key', 'site').maybeSingle()]);
    if (hb.error) { toast(errText(hb.error), 'err'); return; }
    const site = (st.data || {}).value || {};
    const L = (o, f, def = {}) => { const r = {}; ['ru', 'en', 'uk'].forEach(l => { const v = o && o[`${f}_${l}`]; r[l] = v != null && String(v).trim() ? String(v) : (def[l] || ''); }); return r; };
    const blocks = [];
    const hero = hb.data.find(x => x.kind === 'hero') || {};
    blocks.push({ id: peUid(), type: 'hero', image: hero.image || '',
        title: L(hero, 'title', { ru: 'Истории на грани', en: 'Stories on the edge', uk: 'Історії на межі' }),
        accent: L(hero, 'text', { ru: 'света и тьмы', en: 'of light and dark', uk: 'світла й темряви' }),
        subtitle: L(hero, 'subline', { ru: 'Добро пожаловать в творческую мастерскую Эрика Норта. Романы, рассказы и лор вселенной от первого лица.', en: "Welcome to Eric North's creative workshop. Novels, short fiction, and universe lore firsthand.", uk: 'Ласкаво просимо до творчої майстерні Еріка Норта. Романи, оповідання та лор всесвіту з перших вуст.' }),
        buttons: [] });
    const cards = (site.home_cards || []).filter(c => c && !c.hidden);
    const items = cards.length ? cards.map(c => ({ icon: c.icon || '', title: L(c, 'title'), desc: L(c, 'desc'), link: c.link || '' })) : [
        { icon: 'fa-solid fa-feather-pointed', title: { ru: 'Истории', en: 'Stories', uk: 'Історії' }, desc: { ru: 'Короткая проза и черновики', en: 'Short fiction and drafts', uk: 'Коротка проза та чернетки' }, link: 'blog.html' },
        { icon: 'fa-solid fa-book-open', title: { ru: 'Книги', en: 'Books', uk: 'Книги' }, desc: { ru: 'Мои опубликованные романы', en: 'My published novels', uk: 'Мої опубліковані романи' }, link: 'books.html' },
        { icon: 'fa-regular fa-note-sticky', title: { ru: 'Заметки', en: 'Notes', uk: 'Нотатки' }, desc: { ru: 'Мысли и объявления', en: 'Thoughts and announcements', uk: 'Думки та оголошення' }, link: 'notes.html' },
        { icon: 'fa-solid fa-diagram-project', title: { ru: 'Проекты', en: 'Projects', uk: 'Проєкти' }, desc: { ru: 'Эксперименты и идеи', en: 'Experiments and ideas', uk: 'Експерименти та ідеї' }, link: 'projects.html' }];
    blocks.push({ id: peUid(), type: 'cards', title: {}, overlap: true, items });
    blocks.push({ id: peUid(), type: 'continue_reading' });
    hb.data.filter(x => x.kind === 'promo').forEach(p => {
        const text = L(p, 'text'); Object.keys(text).forEach(l => { if (text[l] && !/^\s*</.test(text[l])) text[l] = `<p>${esc(text[l])}</p>`; });
        blocks.push({ id: peUid(), type: 'image_text', image: p.image || '', title: L(p, 'title'), text, button: { label: L(p, 'btn_text'), link: p.link || '' }, reverse: !!p.reverse });
    });
    const ct = site.contact || {};
    if (ct.enabled !== false) blocks.push({ id: peUid(), type: 'contact', title: L(ct, 'title', { ru: 'Написать автору', en: 'Contact the Author', uk: 'Написати автору' }),
        desc: L(ct, 'desc', { ru: 'Открыт для предложений по изданию, готов обсудить лор миров или просто поболтать о книгах.', en: 'Open to publishing offers, ready to discuss the lore of worlds, or just chat about books.', uk: 'Відкритий до пропозицій щодо видання, готовий обговорити лор світів або просто поговорити про книги.' }), subject: 'Home page' });
    const { data, error } = await sb.from('pages').insert({ slug: 'home', draft: { title: {}, seo: {}, blocks } }).select('id').single();
    if (error) { toast(errText(error), 'err'); return; }
    toast('Главная из блоков создана. Сайт пока не изменился.', 'ok');
    peOpen(data.id);
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
        if (s === 'home') { toast('Адрес home зарезервирован для главной страницы', 'err'); return; }
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
    if (!peBooks.length) { const r = await sb.from('books').select('id,title_ru').order('sort_order'); peBooks = r.data || []; }
    const d = data.draft || {};
    PE = {
        row: data,
        draft: { title: d.title || {}, seo: d.seo || {}, blocks: (d.blocks || []).map(b => ({ id: b.id || peUid(), ...b })) },
        lang: state.editLang || 'ru', device: 'desktop', open: null, dirty: false, ready: false, timer: null, view: 'blocks', revPreview: null,
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
    const rev = PE.view === 'history' && PE.revPreview;
    PE.iframe.contentWindow.postMessage({ type: 'page-preview', content: rev ? rev.content : PE.draft, lang: PE.lang, selected: rev ? null : PE.open, scrollTo: opts.scrollTo }, window.location.origin);
    if (PE.previewLabel) PE.previewLabel.textContent = rev ? 'Просмотр версии от ' + peDate(rev.created_at) : 'Предпросмотр черновика';
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
    PE.ready = false;
    const main = document.getElementById('main');
    main.innerHTML = '';
    // Верх: назад, название, статус, кнопки
    PE.statusEl = el('span', { class: 'badge' });
    const saveBtn = el('button', { class: 'btn', type: 'button', onclick: peSave }, [el('i', { class: 'fa-solid fa-floppy-disk' }), 'Сохранить черновик']);
    const pubBtn = el('button', { class: 'btn btn-primary', type: 'button', onclick: pePublish }, [el('i', { class: 'fa-solid fa-upload' }), 'Опубликовать']);
    const live = el('a', { class: 'btn', href: PE.row.slug === 'home' ? `/${PE.lang}/` : `/${PE.lang}/p/${PE.row.slug}`, target: '_blank', title: 'Открыть опубликованную страницу' }, [el('i', { class: 'fa-solid fa-arrow-up-right-from-square' }), 'На сайте']);
    main.append(el('div', { class: 'pe-top' }, [
        el('div', {}, [
            el('button', { class: 'link-btn', style: 'margin:0 0 6px', onclick: () => { if (peConfirmLeave()) { PE = null; renderPages(); } }, html: '<i class="fa-solid fa-arrow-left"></i> Все страницы' }),
            el('h2', {}, [document.createTextNode(Blocks.pick(PE.draft.title, 'ru') || PE.row.slug), el('span', { class: 'meta', style: 'font-size:.85rem;font-family:Inter;color:var(--muted);margin-left:10px', text: '/p/' + PE.row.slug })]),
            PE.statusEl]),
        el('div', { class: 'inline', style: 'flex-wrap:wrap' }, [
            el('button', { class: 'btn btn-icon btn-danger', type: 'button', title: 'Удалить страницу', onclick: peDelete }, el('i', { class: 'fa-solid fa-trash' })),
            PE.row.published ? el('button', { class: 'btn', type: 'button', title: 'Убрать страницу с сайта, не удаляя её', onclick: peUnpublish }, [el('i', { class: 'fa-regular fa-eye-slash' }), 'Снять с публикации']) : null,
            el('button', { class: 'btn', type: 'button', onclick: () => PE.view === 'history' ? peCloseHistory() : peOpenHistory() }, [el('i', { class: 'fa-solid fa-clock-rotate-left' }), 'История']),
            PE.row.published ? live : null, saveBtn, pubBtn])]));

    // Панели: слева настройки и блоки, справа предпросмотр
    const panel = el('div', { class: 'pe-panel' });
    const langBar = el('div', { class: 'lang-tabs pe-lang' }, PE_LANGS.map(([l, t]) => el('button', { type: 'button', 'data-l': l, class: l === PE.lang ? 'active' : '', text: t, onclick: () => peSetLang(l) })));
    const devBar = el('div', { class: 'lang-tabs pe-device' }, PE_DEVICES.map(([d, ic]) => el('button', { type: 'button', 'data-d': d, class: d === PE.device ? 'active' : '', title: d, onclick: () => peSetDevice(d) }, el('i', { class: ic }))));
    PE.iframe = el('iframe', { class: 'pe-frame', src: '/page.html?preview=1', title: 'Предпросмотр' });
    PE.frameBox = el('div', { class: 'pe-frame-box', style: 'width:' + PE_DEVICES.find(x => x[0] === PE.device)[2] }, PE.iframe);
    const previewCol = el('div', { class: 'pe-preview' }, [
        el('div', { class: 'pe-preview-bar' }, [langBar, PE.previewLabel = el('span', { class: 'hint', text: 'Предпросмотр черновика' }), devBar]),
        el('div', { class: 'pe-frame-wrap' }, PE.frameBox)]);
    main.append(el('div', { class: 'pe-wrap' }, [panel, previewCol]));
    PE.panel = panel;
    if (PE.view === 'history') peRenderHistory(); else peRenderPanel();
    peUpdateStatus();
}

window.addEventListener('message', e => {
    if (!PE || e.origin !== window.location.origin || !e.data) return;
    if (e.data.type === 'preview-ready') { PE.ready = true; pePost(); }
    if (e.data.type === 'block-click' && Number.isInteger(e.data.index) && PE.view !== 'history') { PE.open = e.data.index; peRenderPanel(true); pePost(); }
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
            add(peBool(b, 'overlap', 'Наезжать на шапку (как на главной)'));
            add(peRepeater(b, 'items', 'Карточки', 8, () => ({ icon: 'fa-solid fa-star', title: {}, desc: {}, link: '' }), c => [
                peIcon(c, 'icon', 'Иконка'), peI18nText(c, 'title', 'Заголовок'), peI18nText(c, 'desc', 'Подпись'), peLink(c, 'link', 'Куда ведёт')]));
            break;
        case 'quote':
            add(peI18nText(b, 'text', 'Цитата', { textarea: true }));
            add(peI18nText(b, 'author', 'Автор'));
            break;
        case 'gallery':
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(peSelect(b, 'cols', 'Картинок в ряд', [['3', '3'], ['2', '2'], ['4', '4']]));
            add(peRepeater(b, 'images', 'Картинки', 40, () => ({ src: '', caption: {} }), x => [peImage(x, 'src', 'Картинка'), peI18nText(x, 'caption', 'Подпись (необязательно)')]));
            break;
        case 'video': {
            const note = el('div', { class: 'hint' });
            const check = () => { note.textContent = !b.url ? 'Вставьте ссылку на видео YouTube или Vimeo, либо прямую ссылку на файл .mp4' : Blocks.videoEmbed(b.url) ? '✓ Ссылка распознана' : '✗ Не удалось распознать ссылку — видео не покажется'; };
            const f2 = peText(b, 'url', 'Ссылка на видео', { placeholder: 'https://www.youtube.com/watch?v=…' });
            f2.querySelector('input').addEventListener('input', check); check(); f2.append(note);
            add(f2);
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(peI18nText(b, 'caption', 'Подпись под видео (необязательно)'));
            break;
        }
        case 'divider':
            add(el('div', { class: 'grid-2' }, [
                peSelect(b, 'style', 'Вид', [['line', 'Линия'], ['dots', 'Три точки'], ['space', 'Просто отступ']]),
                peSelect(b, 'size', 'Высота', [['m', 'Средняя'], ['s', 'Маленькая'], ['l', 'Большая']])]));
            break;
        case 'faq':
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(peRepeater(b, 'items', 'Вопросы', 30, () => ({ q: {}, a: {} }), x => [peI18nText(x, 'q', 'Вопрос'), peI18nText(x, 'a', 'Ответ', { textarea: true })]));
            break;
        case 'posts_feed':
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(peSelect(b, 'count', 'Сколько постов показать', ['3', '6', '9', '1', '2', '4'].map(n => [n, n])));
            b.button = b.button || { label: {}, link: '' };
            add(peI18nText(b.button, 'label', 'Кнопка под постами (пусто — без кнопки)'));
            add(peLink(b.button, 'link', 'Куда ведёт кнопка'));
            add(el('div', { class: 'hint', text: 'Посты берутся из раздела «Блог» — сначала верхние в списке. Скрытые посты не показываются.' }));
            break;
        case 'books': {
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            const chosen = () => String(b.ids || '').split(',').map(x => x.trim()).filter(Boolean);
            const box = el('div', { class: 'inline', style: 'flex-direction:column;align-items:flex-start;gap:8px' });
            peBooks.forEach(k => {
                const cb = el('input', { type: 'checkbox' }); cb.checked = chosen().includes(k.id);
                cb.addEventListener('change', () => { const ids = peBooks.map(x => x.id).filter(id => id === k.id ? cb.checked : chosen().includes(id)); b.ids = ids.join(','); peChanged(); });
                box.append(el('label', { class: 'check' }, [cb, k.title_ru || k.id]));
            });
            add(el('div', { class: 'field' }, [el('label', { text: 'Какие книги показать' }), box, el('div', { class: 'hint', text: 'Ничего не отмечено — показываются все книги в порядке из раздела «Книги».' })]));
            break;
        }
        case 'book_toc':
            add(peSelect(b, 'book_id', 'Книга', peBooks.length ? peBooks.map(k => [k.id, k.title_ru || k.id]) : [['', '— книг нет —']]));
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(el('div', { class: 'hint', text: 'Главы подтягиваются автоматически. Скрытые главы не показываются.' }));
            break;
        case 'notes_feed':
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(peSelect(b, 'count', 'Сколько заметок показать', ['3', '5', '10', '1', '2'].map(n => [n, n])));
            break;
        case 'continue_reading':
            add(el('div', { class: 'hint', style: 'margin-top:12px', text: 'Настраивать нечего: плашка появляется сама у читателей, которые уже открывали главу в читалке. В предпросмотре её видно, только если вы сами недавно читали на сайте.' }));
            break;
        case 'projects':
            add(peI18nText(b, 'title', 'Заголовок (необязательно)'));
            add(el('div', { class: 'hint', text: 'Показываются все видимые проекты из раздела «Проекты».' }));
            break;
        case 'contact':
            add(peI18nText(b, 'title', 'Заголовок'));
            add(peI18nText(b, 'desc', 'Пояснение под заголовком', { textarea: true }));
            add(peText(b, 'subject', 'Пометка в письме (необязательно)', { placeholder: 'например: Страница «Об авторе»' }));
            add(el('div', { class: 'hint', text: 'Сообщения приходят в Netlify → Forms → author-contact, как и с главной. В предпросмотре форма не отправляется.' }));
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

/* ---------- ИСТОРИЯ И СНЯТИЕ С ПУБЛИКАЦИИ ---------- */
const peDate = d => new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function peOpenHistory() {
    PE.view = 'history'; PE.revPreview = null; PE.revisions = null;
    peRenderHistory();
    const { data, error } = await sb.from('page_revisions').select('id,content,note,created_at').eq('page_id', PE.row.id).order('created_at', { ascending: false }).limit(50);
    if (!PE || PE.view !== 'history') return;
    if (error) { toast(errText(error), 'err'); return; }
    PE.revisions = data;
    peRenderHistory();
}

function peCloseHistory() {
    PE.view = 'blocks'; PE.revPreview = null;
    peRenderPanel(); pePost();
}

function peRenderHistory() {
    const panel = PE.panel; panel.innerHTML = ''; editors = [];
    panel.append(el('div', { class: 'pe-card', style: 'padding:14px 16px' }, [
        el('button', { class: 'link-btn', style: 'margin:0 0 8px', type: 'button', onclick: peCloseHistory, html: '<i class="fa-solid fa-arrow-left"></i> Назад к редактору' }),
        el('b', { text: 'История публикаций' }),
        el('div', { class: 'hint', style: 'margin-top:6px', text: 'Каждая публикация сохраняется здесь. Нажмите на версию, чтобы посмотреть её справа, и, если нужно, верните её в черновик. Сайт при этом не меняется, пока вы снова не опубликуете.' })]));
    if (!PE.revisions) { panel.append(el('div', { class: 'loading', text: 'Загрузка…' })); return; }
    if (!PE.revisions.length) { panel.append(el('div', { class: 'empty', text: 'Пока нет ни одной публикации из админки' })); return; }
    PE.revisions.forEach((r, i) => {
        const active = PE.revPreview && PE.revPreview.id === r.id;
        const isLive = PE.row.published && peSame(PE.row.published, r.content);
        const card = el('div', { class: 'pe-card pe-block' + (active ? ' open' : '') }, [
            el('div', { class: 'pe-block-head', onclick: () => { PE.revPreview = active ? null : r; peRenderHistory(); pePost({ scrollTo: 0 }); } }, [
                el('i', { class: 'fa-solid fa-clock-rotate-left pe-block-icon' }),
                el('div', { class: 'pe-block-name' }, [el('b', { text: peDate(r.created_at) }), isLive ? el('span', { class: 'badge', text: 'сейчас на сайте' }) : null,
                    el('div', { class: 'meta', text: `${r.note || ''} · блоков: ${((r.content || {}).blocks || []).length}` })])])]);
        if (active) card.append(el('div', { class: 'pe-form', style: 'padding-top:12px' }, el('button', { class: 'btn btn-primary', type: 'button', onclick: () => peRestore(r) }, [el('i', { class: 'fa-solid fa-rotate-left' }), 'Вернуть эту версию в черновик'])));
        panel.append(card);
    });
}

function peRestore(r) {
    if (PE.dirty && !confirm('В редакторе есть несохранённые изменения. Заменить их этой версией?')) return;
    const c = peClone(r.content || {});
    PE.draft = { title: c.title || {}, seo: c.seo || {}, blocks: (c.blocks || []).map(b => ({ id: b.id || peUid(), ...b })) };
    PE.open = null;
    peCloseHistory();
    peChanged({ now: true });
    toast('Версия возвращена в редактор. Сохраните или опубликуйте, чтобы применить.', 'ok');
}

async function peUnpublish() {
    if (!confirm('Убрать страницу с сайта? Читатели увидят «страница не найдена». Черновик и история останутся, опубликовать можно снова в любой момент.')) return;
    const { data, error } = await sb.from('pages').update({ published: null, published_at: null }).eq('id', PE.row.id).select('*').single();
    if (error) { toast(errText(error), 'err'); return; }
    PE.row = data; linkSuggestions = [];
    toast('Страница снята с публикации', 'ok');
    peRenderShell();
}
