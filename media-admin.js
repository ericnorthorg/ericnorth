// --- media-admin.js ---
// Медиатека: все картинки сайта в одном месте. Раздел админки и окно выбора картинки,
// которое открывается из любых полей «Картинка» и из визуального редактора.
// Использует функции админки (sb, el, esc, toast, errText, uploadImage, state).

const mediaUrl = name => sb.storage.from('media').getPublicUrl(name).data.publicUrl;
const mediaSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
const mediaIsImage = f => /^image\//.test(f.mimetype || '') || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f.name);

function pickFiles() {
    return new Promise(res => {
        const inp = el('input', { type: 'file', accept: 'image/*', multiple: true });
        inp.onchange = () => res([...inp.files]);
        inp.click();
    });
}

async function uploadMany(files) {
    const urls = [];
    for (const f of files) {
        if (!/^image\//.test(f.type)) { toast(`«${f.name}» — не картинка, пропущен`, 'err'); continue; }
        const u = await uploadImage(f);
        if (u) urls.push(u);
    }
    if (urls.length > 1) toast(`Загружено картинок: ${urls.length}`, 'ok');
    return urls;
}

// Сетка медиатеки. mode: 'library' (управление) или 'pick' (выбор, onPick(url))
function mediaGrid({ mode = 'library', onPick } = {}) {
    const box = el('div', { class: 'md-box' });
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Поиск по имени файла…', style: 'max-width:320px' });
    const count = el('span', { class: 'hint', style: 'margin:0' });
    const uploadBtn = el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        const urls = await uploadMany(await pickFiles());
        if (mode === 'pick' && urls.length === 1) { onPick(urls[0]); return; }
        load();
    } }, [el('i', { class: 'fa-solid fa-upload' }), 'Загрузить с компьютера']);
    const grid = el('div', { class: 'md-grid' });
    box.append(el('div', { class: 'md-toolbar' }, [uploadBtn, search, count]),
        el('div', { class: 'md-drop-hint hint', text: 'Можно перетащить файлы прямо сюда. Большие фото автоматически уменьшаются до 2400 px и сохраняются в лёгком формате WebP.' }), grid);
    let files = [];
    const draw = () => {
        const q = search.value.trim().toLowerCase();
        const list = files.filter(f => !q || f.name.toLowerCase().includes(q));
        count.textContent = `${list.length} из ${files.length}`;
        grid.innerHTML = '';
        if (!list.length) grid.append(el('div', { class: 'empty', text: files.length ? 'Ничего не найдено' : 'Пока нет ни одной картинки' }));
        list.forEach(f => grid.append(mediaTile(f, mode, onPick, load)));
    };
    async function load() {
        grid.innerHTML = '<div class="loading">Загрузка…</div>';
        const { data, error } = await sb.rpc('media_list');
        if (error) { grid.innerHTML = ''; toast(errText(error), 'err'); return; }
        files = data; draw();
    }
    search.addEventListener('input', draw);
    // Перетаскивание файлов
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('md-drag'); });
    box.addEventListener('dragleave', e => { if (!box.contains(e.relatedTarget)) box.classList.remove('md-drag'); });
    box.addEventListener('drop', async e => {
        e.preventDefault(); box.classList.remove('md-drag');
        const urls = await uploadMany([...e.dataTransfer.files]);
        if (mode === 'pick' && urls.length === 1) { onPick(urls[0]); return; }
        load();
    });
    load();
    return box;
}

function mediaTile(f, mode, onPick, reload) {
    const url = mediaUrl(f.name);
    const short = f.name.split('/').pop();
    const thumb = mediaIsImage(f) ? el('img', { src: url, alt: '', loading: 'lazy' }) : el('i', { class: 'fa-regular fa-file' });
    const tile = el('div', { class: 'md-tile' + (mode === 'pick' ? ' md-pickable' : ''), title: f.name }, [
        el('div', { class: 'md-thumb' }, thumb),
        el('div', { class: 'md-name', text: short }),
        el('div', { class: 'md-meta', text: `${mediaSize(f.size)} · ${new Date(f.created_at).toLocaleDateString('ru-RU')}` })]);
    if (mode === 'pick') { tile.addEventListener('click', () => onPick(url)); return tile; }
    tile.append(el('div', { class: 'md-actions' }, [
        el('button', { class: 'btn btn-icon', type: 'button', title: 'Скопировать ссылку', onclick: async () => {
            try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована', 'ok'); } catch (e) { prompt('Ссылка на картинку:', url); }
        } }, el('i', { class: 'fa-regular fa-copy' })),
        el('a', { class: 'btn btn-icon', href: url, target: '_blank', title: 'Открыть' }, el('i', { class: 'fa-solid fa-arrow-up-right-from-square' })),
        el('button', { class: 'btn btn-icon', type: 'button', title: 'Где используется', onclick: async () => {
            const used = await mediaUsage(f.name);
            if (used) alert(used.length ? 'Картинка используется:\n\n• ' + used.join('\n• ') : 'Картинка нигде не используется.');
        } }, el('i', { class: 'fa-solid fa-magnifying-glass' })),
        el('button', { class: 'btn btn-icon btn-danger', type: 'button', title: 'Удалить', onclick: async () => {
            const used = await mediaUsage(f.name);
            if (!used) return;
            const msg = used.length
                ? `Эта картинка используется на сайте:\n\n• ${used.join('\n• ')}\n\nЕсли удалить, там будет пустое место. Всё равно удалить?`
                : `Удалить «${short}»? Она нигде не используется.`;
            if (!confirm(msg)) return;
            const { error } = await sb.storage.from('media').remove([f.name]);
            if (error) { toast(errText(error), 'err'); return; }
            toast('Картинка удалена', 'ok'); reload();
        } }, el('i', { class: 'fa-solid fa-trash' }))]));
    return tile;
}

async function mediaUsage(name) {
    const { data, error } = await sb.rpc('media_usage', { p_path: name });
    if (error) { toast(errText(error), 'err'); return null; }
    return [...new Set(data.map(x => x.place))];
}

async function renderMedia() {
    const main = document.getElementById('main');
    main.innerHTML = '';
    main.append(el('div', { class: 'page-head' }, el('div', {}, [
        el('h2', { text: 'Медиатека' }),
        el('div', { class: 'sub', text: 'Все картинки сайта. Загруженные здесь можно выбирать в любом поле «Картинка» и в текстах — повторно загружать не нужно.' })])));
    main.append(mediaGrid({ mode: 'library' }));
}

// Окно выбора картинки. Возвращает адрес выбранной картинки или null.
function openMediaPicker() {
    return new Promise(resolve => {
        const close = url => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(url || null); };
        const onKey = e => { if (e.key === 'Escape') close(null); };
        const overlay = el('div', { class: 'md-overlay', onclick: e => { if (e.target === overlay) close(null); } }, el('div', { class: 'md-modal' }, [
            el('div', { class: 'md-modal-head' }, [el('b', { text: 'Выберите картинку' }),
                el('button', { class: 'btn btn-icon', type: 'button', title: 'Закрыть', onclick: () => close(null) }, el('i', { class: 'fa-solid fa-xmark' }))]),
            mediaGrid({ mode: 'pick', onPick: url => close(url) })]));
        document.addEventListener('keydown', onKey);
        document.body.append(overlay);
    });
}

// Перед загрузкой: большие фото (JPG, PNG, WebP, AVIF) уменьшаем до 2400 px и сохраняем в WebP (GIF и SVG не трогаем)
async function prepareImage(file) {
    try {
        if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;
        const img = await createImageBitmap(file);
        const max = 2400, scale = Math.min(1, max / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 1.5 * 1024 * 1024) { img.close && img.close(); return file; }
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        img.close && img.close();
        const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.86));
        if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    } catch (e) { return file; }
}
