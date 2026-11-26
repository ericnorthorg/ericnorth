/* --- УМНЫЙ ЖИВОЙ ПОИСК ПО ВСЕМУ САЙТУ --- */

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchModal = document.getElementById('searchModal');
    
    // Находим контейнер именно внутри модального окна поиска
    const searchContainer = searchModal ? searchModal.querySelector('.search-container') : null;
    
    if (!searchInput || !searchContainer) return;

    // Создаем блок для вывода результатов, если его еще нет
    let resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) {
        resultsDiv = document.createElement('div');
        resultsDiv.id = 'search-results';
        searchContainer.appendChild(resultsDiv);
    }

    // Внедряем стили для красивого отображения результатов
    const style = document.createElement('style');
    style.innerHTML = `
        .search-results { text-align: left; margin-top: 20px; max-height: 60vh; overflow-y: auto; width: 100%; border-top: 1px solid var(--border-color); padding-top: 10px;}
        .search-item { padding: 15px 0; border-bottom: 1px solid var(--border-color); transition: padding-left 0.2s; display: block; text-decoration: none; }
        .search-item:hover { padding-left: 10px; background-color: transparent; }
        .search-item-title { color: var(--accent-color); font-family: 'Merriweather', serif; font-size: 1.3rem; margin-bottom: 5px; line-height: 1.2; }
        .search-item-type { font-size: 0.75rem; text-transform: uppercase; color: var(--secondary-text); font-weight: 700; letter-spacing: 1px; margin-bottom: 5px; }
        .search-item-text { color: var(--text-color); font-size: 0.95rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.8; }
        .search-results::-webkit-scrollbar { width: 6px; }
        .search-results::-webkit-scrollbar-thumb { background-color: var(--border-color); border-radius: 4px; }
    `;
    document.head.appendChild(style);

    // Слушатель ввода (Живой поиск)
    searchInput.addEventListener('input', (e) => {
        const query = searchInput.value.toLowerCase().trim();
        
        if (!query) {
            resultsDiv.innerHTML = ''; // Очищаем результаты, если строка пустая
            return;
        }

        performSearch(query);

        // Тексты глав грузятся только при первом поиске — потом повторяем поиск с ними
        if (typeof loadChapterTexts === 'function' && !chapterTextsLoaded) {
            loadChapterTexts().then(() => {
                if (searchInput.value.toLowerCase().trim() === query) performSearch(query);
            });
        }
    });

    function performSearch(query) {
        resultsDiv.innerHTML = ''; 
        let results = [];
        
        // Определяем текущий язык сайта
        const lang = (typeof currentLang !== 'undefined' && currentLang) ? currentLang : (typeof detectLang === 'function' ? detectLang() : 'en'); 

        // Функция-предохранитель: переводит текст в строку и нижний регистр, защищает от пустых ячеек
        const getSafeStr = (str) => (str ? String(str).toLowerCase() : '');

        // 1. ПОИСК ПО БЛОГУ (postsDB)
        if (typeof postsDB !== 'undefined') {
            for (const [id, post] of Object.entries(postsDB)) {
                if (post.hidden) continue;
                
                const title = (post[`title_${lang}`] || post.title_en);
                const body = (post[`body_${lang}`] || post.body_en);
                
                if (getSafeStr(title).includes(query) || getSafeStr(body).includes(query)) {
                    results.push({
                        type: (lang === 'ru' ? 'Блог' : lang === 'uk' ? 'Блог' : 'Blog'),
                        title: title || ((lang === 'ru' ? 'Без заголовка' : lang === 'uk' ? 'Без назви' : 'Untitled')),
                        text: stripHtml(body),
                        link: `post/${id}`
                    });
                }
            }
        }

        // 2. ПОИСК ПО ГЛАВАМ ИЗ ЧИТАЛКИ (chaptersDB)
        if (typeof chaptersDB !== 'undefined') {
            chaptersDB.forEach(chapter => {
                const title = (chapter[`title_${lang}`] || chapter.title_en);
                const text = (chapter[`text_${lang}`] || chapter.text_en);

                if (getSafeStr(title).includes(query) || getSafeStr(text).includes(query)) {
                    results.push({
                        type: (lang === 'ru' ? 'Книга (Глава)' : lang === 'uk' ? 'Книга (розділ)' : 'Book (Chapter)'),
                        title: title || ((lang === 'ru' ? `Глава ${chapter.chapter_num}` : lang === 'uk' ? `Розділ ${chapter.chapter_num}` : `Chapter ${chapter.chapter_num}`)),
                        text: stripHtml(text),
                        link: `read/${chapter.book_id}/${chapter.chapter_num}`
                    });
                }
            });
        }

        // 3. ПОИСК ПО КНИГАМ (booksDB)
        if (typeof booksDB !== 'undefined') {
            booksDB.forEach(book => {
                const title = (book[`title_${lang}`] || book.title_en);
                const desc = (book[`desc_${lang}`] || book.desc_en);

                if (getSafeStr(title).includes(query) || getSafeStr(desc).includes(query)) {
                    results.push({
                        type: (lang === 'ru' ? 'Витрина книг' : lang === 'uk' ? 'Вітрина книг' : 'Bookstore'),
                        title: title || 'Книга',
                        text: desc || '',
                        link: 'books.html'
                    });
                }
            });
        }

        // 4. ПОИСК ПО ПРОЕКТАМ (projectsDB)
        if (typeof projectsDB !== 'undefined') {
            projectsDB.forEach(proj => {
                const title = (proj[`title_${lang}`] || proj.title_en);
                const desc = (proj[`desc_${lang}`] || proj.desc_en);

                if (getSafeStr(title).includes(query) || getSafeStr(desc).includes(query)) {
                    results.push({
                        type: (lang === 'ru' ? 'Проект' : lang === 'uk' ? 'Проєкт' : 'Project'),
                        title: title || 'Проект',
                        text: desc || '',
                        link: 'projects.html'
                    });
                }
            });
        }

        // 5. ПОИСК ПО ЗАМЕТКАМ (notesDB)
        if (typeof notesDB !== 'undefined') {
            notesDB.forEach(note => {
                const title = (note[`title_${lang}`] || note.title_en);
                const text = (note[`text_${lang}`] || note.text_en);

                if (getSafeStr(title).includes(query) || getSafeStr(text).includes(query)) {
                    results.push({
                        type: (lang === 'ru' ? 'Заметка' : lang === 'uk' ? 'Нотатка' : 'Note'),
                        title: title || ((lang === 'ru' ? 'Короткая заметка' : lang === 'uk' ? 'Коротка нотатка' : 'Quick Note')),
                        text: text || '',
                        link: 'notes.html'
                    });
                }
            });
        }

        // --- ВЫВОД РЕЗУЛЬТАТОВ НА ЭКРАН ---
        if (results.length === 0) {
            resultsDiv.innerHTML = `<p style="margin-top:20px; text-align:center; font-style:italic; color: var(--secondary-text)">${(lang === 'ru' ? 'По вашему запросу ничего не найдено.' : lang === 'uk' ? 'За вашим запитом нічого не знайдено.' : 'No results found.')}</p>`;
        } else {
            results.forEach(item => {
                const el = document.createElement('a');
                el.className = 'search-item';
                el.href = item.link;
                
                // Обрезаем текст для превью, чтобы карточки не были огромными
                const previewText = item.text.length > 180 ? item.text.substring(0, 180) + '...' : item.text;
                
                el.innerHTML = `
                    <div class="search-item-type">${item.type}</div>
                    <div class="search-item-title">${item.title}</div>
                    <div class="search-item-text">${previewText}</div>
                `;
                
                // При клике на результат - закрываем модалку поиска
                el.addEventListener('click', () => {
                    searchModal.classList.remove('active');
                });
                
                resultsDiv.appendChild(el);
            });
        }
    }

    // Вспомогательная функция: очищает HTML-теги из текста (чтобы <b> и <p> не выводились в результатах поиска)
    function stripHtml(html) {
        if (!html) return "";
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }
});