/* --- ЗАГРУЗКА КОНТЕНТА ИЗ SUPABASE ---
   Посты, книги, заметки и проекты хранятся в базе Supabase
   (таблицы posts, books, notes, projects). Редактировать их можно
   в Table Editor на supabase.com — код менять не нужно.
   Публичный ключ ниже безопасен: база разрешает только чтение. */

const SUPABASE_URL = 'https://eaumjrfaosozzoebnlcf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GqIgz56xMe8Qq68x5tqGZw_GybLuFuT';

var postsDB, booksDB, notesDB, projectsDB;

function fetchTable(table) {
    return fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=sort_order.asc,id.asc`, {
        headers: { apikey: SUPABASE_KEY }
    }).then(res => {
        if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
        return res.json();
    });
}

const siteDataReady = Promise.all(['posts', 'books', 'notes', 'projects'].map(fetchTable))
    .then(([posts, books, notes, projects]) => {
        // Посты: объект { id: пост }, как раньше в posts.js
        postsDB = {};
        posts.forEach(p => {
            postsDB[p.id] = {
                hidden: p.hidden, category: p.category || undefined, image: p.image,
                meta_ru: p.meta_ru, meta_en: p.meta_en,
                title_ru: p.title_ru, title_en: p.title_en || p.title_ru,
                body_ru: p.body_ru || '', body_en: p.body_en || p.body_ru || ''
            };
        });

        booksDB = books.map(b => ({
            cover: b.cover, meta_ru: b.meta_ru, meta_en: b.meta_en,
            title_ru: b.title_ru, title_en: b.title_en || b.title_ru,
            desc_ru: b.desc_ru || '', desc_en: b.desc_en || b.desc_ru || '',
            link_buy: b.link_buy || '#', link_read: b.link_read || '#'
        }));

        notesDB = notes.map(n => ({
            type: n.type, category: n.category, date: n.date, image: n.image,
            title_ru: n.title_ru, title_en: n.title_en || n.title_ru,
            text_ru: n.text_ru || '', text_en: n.text_en || n.text_ru || '',
            author: n.author
        }));

        projectsDB = projects.map(p => ({
            statusClass: p.status_class, status_ru: p.status_ru, status_en: p.status_en,
            title_ru: p.title_ru, title_en: p.title_en || p.title_ru,
            desc_ru: p.desc_ru || '', desc_en: p.desc_en || p.desc_ru || '',
            progressLabel_ru: p.progress_label_ru, progressLabel_en: p.progress_label_en,
            progress: p.progress
        }));
    })
    .catch(err => {
        console.error('Не удалось загрузить данные из Supabase:', err);
    });
