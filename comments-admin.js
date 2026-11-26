// --- comments-admin.js ---
// Раздел «Комментарии» в админке: модерация комментариев читателей к постам.
// Использует функции админки (sb, el, esc, toast, errText, state).

let CM = { filter: 'pending' };

async function updateCommentsBadge() {
    const { count } = await sb.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const item = document.querySelector('#nav .nav-item[data-s="comments"]');
    if (!item) return;
    let b = item.querySelector('.nav-badge');
    if (!count) { if (b) b.remove(); return; }
    if (!b) { b = el('span', { class: 'nav-badge' }); item.append(b); }
    b.textContent = count;
}

async function renderComments() {
    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Загрузка…</div>';
    const [{ data, error }, posts] = await Promise.all([
        sb.from('comments').select('*').eq('status', CM.filter).order('created_at', { ascending: CM.filter === 'pending' }).limit(200),
        sb.from('posts').select('id,title_ru'),
    ]);
    if (state.section !== 'comments') return;
    if (error) { main.innerHTML = ''; toast(errText(error), 'err'); return; }
    const titles = Object.fromEntries((posts.data || []).map(p => [p.id, p.title_ru || p.id]));
    main.innerHTML = '';
    main.append(el('div', { class: 'page-head' }, el('div', {}, [
        el('h2', { text: 'Комментарии' }),
        el('div', { class: 'sub', text: 'Комментарии читателей к постам. Новые ждут здесь вашего решения и появляются на сайте только после одобрения. Email читателя виден только вам.' })])));
    const tabs = el('div', { class: 'lang-tabs', style: 'margin-bottom:18px' }, [['pending', 'На модерации'], ['approved', 'Опубликованные'], ['rejected', 'Отклонённые']].map(([k, t]) =>
        el('button', { type: 'button', class: CM.filter === k ? 'active' : '', text: t, onclick: () => { CM.filter = k; renderComments(); } })));
    main.append(tabs);
    const list = el('div', { class: 'cm-list' });
    if (!data.length) list.append(el('div', { class: 'empty', text: CM.filter === 'pending' ? 'Новых комментариев нет' : 'Пусто' }));
    data.forEach(c => list.append(commentCard(c, titles[c.post_id] || c.post_id)));
    main.append(list);
    updateCommentsBadge();
}

function commentCard(c, postTitle) {
    const when = new Date(c.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const setStatus = async status => {
        const { error } = await sb.from('comments').update({ status, moderated_at: new Date().toISOString() }).eq('id', c.id);
        if (error) { toast(errText(error), 'err'); return; }
        toast({ approved: 'Опубликовано на сайте', rejected: 'Отклонено', pending: 'Возвращено на модерацию' }[status], 'ok');
        renderComments();
    };
    const replyBox = el('textarea', { class: 'input', rows: 3, placeholder: 'Ваш ответ — покажется под комментарием с подписью «Ответ автора»' });
    replyBox.value = c.admin_reply || '';
    const replyWrap = el('div', { class: 'cm-reply', hidden: !c.admin_reply || undefined }, [replyBox, el('div', { class: 'inline', style: 'margin-top:8px' }, [
        el('button', { class: 'btn', type: 'button', onclick: async () => {
            const v = replyBox.value.trim() || null;
            const { error } = await sb.from('comments').update({ admin_reply: v }).eq('id', c.id);
            if (error) { toast(errText(error), 'err'); return; }
            toast(v ? 'Ответ сохранён' : 'Ответ удалён', 'ok'); c.admin_reply = v;
        } }, [el('i', { class: 'fa-solid fa-floppy-disk' }), 'Сохранить ответ'])])]);
    const btn = (icon, text, cls, fn) => el('button', { class: 'btn ' + cls, type: 'button', onclick: fn }, [el('i', { class: icon }), text]);
    const actions = el('div', { class: 'inline', style: 'flex-wrap:wrap' }, [
        c.status !== 'approved' ? btn('fa-solid fa-check', 'Одобрить', 'btn-primary', () => setStatus('approved')) : null,
        c.status !== 'rejected' ? btn('fa-solid fa-ban', c.status === 'approved' ? 'Скрыть с сайта' : 'Отклонить', '', () => setStatus('rejected')) : null,
        c.status === 'rejected' ? btn('fa-solid fa-rotate-left', 'Вернуть на модерацию', '', () => setStatus('pending')) : null,
        btn('fa-regular fa-comment', c.admin_reply ? 'Ответ' : 'Ответить', '', () => { replyWrap.hidden = !replyWrap.hidden; if (!replyWrap.hidden) replyBox.focus(); }),
        btn('fa-solid fa-trash', 'Удалить', 'btn-danger', async () => {
            if (!confirm('Удалить комментарий навсегда?')) return;
            const { error } = await sb.from('comments').delete().eq('id', c.id);
            if (error) { toast(errText(error), 'err'); return; }
            toast('Удалено', 'ok'); renderComments();
        })]);
    return el('div', { class: 'cm-card' }, [
        el('div', { class: 'cm-head' }, [
            el('div', {}, [el('b', { text: c.name }), c.email ? el('a', { class: 'cm-email', href: 'mailto:' + c.email, text: c.email }) : null]),
            el('div', { class: 'cm-meta' }, [document.createTextNode(when + ' · '), el('a', { href: `/${c.lang || 'ru'}/post/${encodeURIComponent(c.post_id)}`, target: '_blank', text: postTitle }),
                c.lang ? el('span', { class: 'badge', text: c.lang.toUpperCase() }) : null])]),
        el('div', { class: 'cm-body', text: c.body }),
        actions, replyWrap]);
}
