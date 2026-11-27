// --- stats-admin.js ---
// Раздел админки «Статистика»: посещения сайта без cookies и без IP.
// Данные пишет cms.js (функция trackView) через функцию базы track_view,
// а здесь они читаются одной функцией stats_summary (доступна только админу).

const ST = { days: 7 };

function stAddStyles() {
    if (document.getElementById('st-styles')) return;
    const css = `
    .st-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .st-tile { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
    .st-tile .lbl { color: var(--muted); font-size: 13px; }
    .st-tile .num { font-size: 28px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .st-tile .delta { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .st-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 18px; }
    .st-card h3 { font-family: 'Inter', system-ui, sans-serif; font-size: 15px; font-weight: 600; margin: 0 0 12px; }
    .st-chart { position: relative; display: flex; align-items: flex-end; gap: 2px; height: 160px; border-bottom: 1px solid var(--border); padding-top: 18px; }
    .st-bar { flex: 1 1 0; min-width: 2px; height: 100%; display: flex; align-items: flex-end; cursor: default; }
    .st-bar i { display: block; width: 100%; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 0; }
    .st-bar:hover i { opacity: .75; }
    .st-max { position: absolute; top: 0; left: 0; font-size: 11px; color: var(--muted); }
    .st-axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 6px; }
    .st-tip { position: fixed; z-index: 1000; pointer-events: none; background: #1d1d1d; color: #fff; font-size: 12px; padding: 6px 9px; border-radius: 6px; white-space: nowrap; }
    .st-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 18px; }
    .st-grid .st-card { margin-bottom: 0; }
    .st-row { position: relative; display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-radius: 6px; font-size: 14px; }
    .st-row + .st-row { margin-top: 3px; }
    .st-row .fill { position: absolute; inset: 0 auto 0 0; background: var(--accent-soft); border-radius: 6px; }
    .st-row .name, .st-row .n { position: relative; }
    .st-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .st-row .name small { color: var(--muted); margin-left: 6px; }
    .st-row .n { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
    .st-note { color: var(--muted); font-size: 13px; margin-top: 18px; line-height: 1.5; }
    `;
    document.head.append(el('style', { id: 'st-styles', text: css }));
}

const ST_LANGS = { en: 'English', ru: 'Русский', uk: 'Українська', '?': 'Не определён' };
const ST_DEVICES = { mobile: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер', '?': 'Не определено' };
const stNum = n => Number(n || 0).toLocaleString('ru-RU');

function stDelta(cur, prev, days) {
    const span = `прошлыми ${days} дн.`;
    if (!prev) return cur ? `раньше данных не было` : '';
    const p = Math.round((cur - prev) / prev * 100);
    return `${p > 0 ? '+' : ''}${p}% по сравнению с ${span}`;
}

// Названия страниц вместо адресов: /post/x → «Пост: …» и т. п.
async function stLoadTitles() {
    const [p, b, pg] = await Promise.all([
        sb.from('posts').select('id,title_ru'),
        sb.from('books').select('id,title_ru'),
        sb.from('pages').select('slug,draft'),
    ]);
    const posts = Object.fromEntries((p.data || []).map(x => [x.id, x.title_ru]));
    const books = Object.fromEntries((b.data || []).map(x => [x.id, x.title_ru]));
    const pages = Object.fromEntries((pg.data || []).map(x => [x.slug, (x.draft && x.draft.title && x.draft.title.ru) || x.slug]));
    const fixed = { '/': 'Главная', '/blog': 'Блог', '/books': 'Библиотека', '/notes': 'Заметки', '/projects': 'Проекты', '/reader': 'Читалка', '/posts': 'Пост', '/page': 'Страница' };
    return path => {
        let m;
        if (fixed[path]) return fixed[path];
        if ((m = path.match(/^\/post\/([^/]+)$/))) return posts[decodeURIComponent(m[1])] ? `Пост: ${posts[decodeURIComponent(m[1])]}` : null;
        if ((m = path.match(/^\/read\/([^/]+)\/(\d+)$/))) return `${books[decodeURIComponent(m[1])] || m[1]}, глава ${m[2]}`;
        if ((m = path.match(/^\/p\/([^/]+)$/))) return pages[decodeURIComponent(m[1])] ? `Страница: ${pages[decodeURIComponent(m[1])]}` : null;
        return null;
    };
}

function stList(title, rows, total, emptyText) {
    const card = el('div', { class: 'st-card' }, el('h3', { text: title }));
    if (!rows.length) { card.append(el('div', { class: 'empty', text: emptyText || 'Пока пусто' })); return card; }
    const max = Math.max(...rows.map(r => r.n), 1);
    rows.forEach(r => card.append(el('div', { class: 'st-row', title: r.hint || r.name }, [
        el('span', { class: 'fill', style: `width:${Math.max(2, r.n / max * 100)}%` }),
        el('span', { class: 'name' }, [document.createTextNode(r.name), r.sub ? el('small', { text: r.sub }) : null]),
        el('span', { class: 'n', text: total ? `${stNum(r.n)} · ${Math.round(r.n / total * 100)}%` : stNum(r.n) }),
    ])));
    return card;
}

function stChart(daily) {
    const card = el('div', { class: 'st-card' }, el('h3', { text: 'Просмотры по дням' }));
    const max = Math.max(...daily.map(d => d.views), 0);
    const chart = el('div', { class: 'st-chart', role: 'img', 'aria-label': 'Просмотры по дням' });
    chart.append(el('span', { class: 'st-max', text: max ? `макс. ${stNum(max)}` : '' }));
    let tip = null;
    const hide = () => { if (tip) { tip.remove(); tip = null; } };
    const fmt = d => new Date(d.day.slice(0, 10) + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
    daily.forEach(d => {
        const bar = el('div', { class: 'st-bar' }, el('i', { style: `height:${max ? d.views / max * 100 : 0}%` }));
        const show = e => {
            if (!tip) tip = document.body.appendChild(el('div', { class: 'st-tip' }));
            tip.textContent = `${fmt(d)} — просмотров: ${stNum(d.views)}, визитов: ${stNum(d.visits)}`;
            const x = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
            tip.style.left = Math.max(8, x) + 'px'; tip.style.top = (e.clientY - 36) + 'px';
        };
        bar.addEventListener('mousemove', show);
        bar.addEventListener('mouseleave', hide);
        bar.addEventListener('click', show); // на телефоне — по нажатию
        chart.append(bar);
    });
    chart.addEventListener('mouseleave', hide);
    card.append(chart);
    if (daily.length) {
        const f = d => new Date(d.day.slice(0, 10) + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        card.append(el('div', { class: 'st-axis' }, [el('span', { text: f(daily[0]) }), el('span', { text: f(daily[daily.length - 1]) })]));
    }
    return card;
}

async function renderStats() {
    stAddStyles();
    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Загрузка…</div>';
    document.querySelectorAll('.st-tip').forEach(t => t.remove());
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Kiev';
    const [{ data: s, error }, titleOf] = await Promise.all([
        sb.rpc('stats_summary', { p_days: ST.days, p_tz: tz }),
        stLoadTitles().catch(() => () => null),
    ]);
    if (state.section !== 'stats') return;
    if (error) { main.innerHTML = ''; toast(errText(error), 'err'); return; }
    main.innerHTML = '';
    main.append(el('div', { class: 'page-head' }, el('div', {}, [
        el('h2', { text: 'Статистика' }),
        el('div', { class: 'sub', text: 'Сколько читателей заходит на сайт, что читают и откуда приходят. Без cookies и без IP-адресов — баннер о согласии не нужен.' })])));
    main.append(el('div', { class: 'lang-tabs', style: 'margin-bottom:18px' }, [[7, '7 дней'], [30, '30 дней'], [90, '90 дней'], [365, 'Год']].map(([d, t]) =>
        el('button', { type: 'button', class: ST.days === d ? 'active' : '', text: t, onclick: () => { ST.days = d; renderStats(); } }))));

    const perVisit = s.visits ? (s.views / s.visits).toFixed(1).replace('.', ',') : '—';
    main.append(el('div', { class: 'st-tiles' }, [
        ['Просмотры', stNum(s.views), stDelta(s.views, s.prev_views, s.days)],
        ['Визиты', stNum(s.visits), stDelta(s.visits, s.prev_visits, s.days)],
        ['Страниц за визит', perVisit, ''],
        ['Сегодня', stNum(s.today), 'просмотров'],
    ].map(([l, n, d]) => el('div', { class: 'st-tile' }, [el('div', { class: 'lbl', text: l }), el('div', { class: 'num', text: n }), el('div', { class: 'delta', text: d })]))));

    if (!s.views && !s.prev_views) {
        main.append(el('div', { class: 'empty', text: 'За этот период посещений пока нет.' }));
    } else {
        main.append(stChart(s.daily || []));
        const pages = (s.pages || []).map(r => { const t = titleOf(r.path); let shown = r.path; try { shown = decodeURI(r.path); } catch (e) {} return { name: t || shown, sub: t && shown !== '/' ? shown : '', n: r.n, hint: shown }; });
        const refs = (s.refs || []).map(r => ({ name: r.ref_host, n: r.n }));
        if (s.direct) refs.push({ name: 'Прямые заходы', sub: 'закладки, ссылки из мессенджеров и писем', n: s.direct });
        refs.sort((a, b) => b.n - a.n);
        main.append(el('div', { class: 'st-grid' }, [
            stList('Популярные страницы', pages, 0),
            stList('Откуда приходят (визиты)', refs, s.visits, 'Визитов пока нет'),
            stList('Языки сайта', (s.langs || []).map(r => ({ name: ST_LANGS[r.lang] || r.lang, n: r.n })), s.views),
            stList('Устройства', (s.devices || []).map(r => ({ name: ST_DEVICES[r.device] || r.device, n: r.n })), s.views),
        ]));
    }
    main.append(el('div', { class: 'st-note', html:
        '<b>Просмотр</b> — каждое открытие страницы. <b>Визит</b> — заход на сайт извне: из поиска, соцсети, по ссылке или из закладки; переходы между страницами сайта новым визитом не считаются. ' +
        'Не учитываются: поисковые роботы, ваши собственные просмотры (пока вы вошли в админку в этом браузере) и читатели с отключённым JavaScript. ' +
        'Хранится только адрес страницы, язык, сайт-источник и тип устройства; записи старше 13 месяцев удаляются автоматически.' }));
}
