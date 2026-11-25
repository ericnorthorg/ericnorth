const translations = {
    ru: {
        home: "Главная", blog: "Блог", books: "Книги", notes: "Заметки", projects: "Проекты",
        subscribe: "Подписаться", search_placeholder: "Введите название книги или темы...", search_hint: "Нажмите Enter для поиска",
        rights: "Все права защищены.", join_news: "Новости и обновления", subscribe_btn: "Подписаться",
        spam_note: "Никакого спама, только магия.", blog_card: "Истории", stories_desc: "Короткая проза и черновики",
        books_desc: "Мои опубликованные романы", notes_desc: "Мысли и объявления", projects_desc: "Эксперименты и идеи",
        hero_part1: "Архитектура", hero_part2: "иных миров"
    },
    en: {
        home: "Home", blog: "Blog", books: "Books", notes: "Notes", projects: "Projects",
        subscribe: "Subscribe", search_placeholder: "Type book title or topic...", search_hint: "Press Enter to search",
        rights: "All rights reserved.", join_news: "News & Updates", subscribe_btn: "Subscribe",
        spam_note: "No spam, just magic.", blog_card: "Stories", stories_desc: "Short fiction and drafts",
        books_desc: "My published novels", notes_desc: "Thoughts and announcements", projects_desc: "Experiments and ideas",
        hero_part1: "Architecture", hero_part2: "of Other Worlds"
    }
};

let currentLang = localStorage.getItem('lang') || 'ru';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang); 
    
    const langSwitch = document.querySelector('.lang-switch');
    if (langSwitch) langSwitch.textContent = lang === 'ru' ? 'EN' : 'RU';
    
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if (translations[lang] && translations[lang][key]) el.textContent = translations[lang][key];
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput && translations[lang]['search_placeholder']) {
        searchInput.placeholder = translations[lang]['search_placeholder'];
    }
    
    document.querySelectorAll('.lang-ru').forEach(el => el.hidden = (lang !== 'ru'));
    document.querySelectorAll('.lang-en').forEach(el => el.hidden = (lang !== 'en'));
}

function toggleLanguage() { 
    setLanguage(currentLang === 'ru' ? 'en' : 'ru'); 
}

function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function toggleSearch() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.classList.toggle('active');
        if (modal.classList.contains('active')) setTimeout(() => document.getElementById('searchInput').focus(), 100);
    }
}

function toggleSubscribe() {
    const modal = document.getElementById('subscribeModal');
    if (modal) modal.classList.toggle('active');
}

document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        const searchModal = document.getElementById('searchModal');
        const subModal = document.getElementById('subscribeModal');
        if (searchModal) searchModal.classList.remove('active');
        if (subModal) subModal.classList.remove('active');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = currentTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
});