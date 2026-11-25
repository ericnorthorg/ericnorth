// --- cms.js ---

// ВСТАВЬТЕ СЮДА ВАШУ ССЫЛКУ ИЗ APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycby8mSZck_QJcgPfbVR09ZktSUJqmLBArIywA_pgGmV4wSdQRxUEM1NcT48-NsNDDFOV/exec";

// Настройки кэширования
const CACHE_KEY = 'ericNorthCMS_Data';
const CACHE_TIME_KEY = 'ericNorthCMS_Time';
const CACHE_EXPIRATION_MS = 60 * 60 * 1000; // 1 час в миллисекундах (60 мин * 60 сек * 1000)

let projectsDB = [];
let booksDB = [];
let notesDB = [];
let postsDB = {}; 
let chaptersDB = [];
let homeDB = [];

// 1. ФУНКЦИЯ ПОКАЗА СПИННЕРА
function showSpinner() {
    if (!document.getElementById('cms-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'cms-spinner-style';
        style.innerHTML = `
            #cms-global-spinner {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: var(--bg-color); 
                z-index: 99999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                transition: opacity 0.4s ease;
            }
            .spinner-circle {
                width: 50px; height: 50px;
                border: 4px solid var(--border-color);
                border-top: 4px solid var(--accent-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            .spinner-text {
                margin-top: 20px;
                font-family: 'Merriweather', serif;
                color: var(--secondary-text);
                font-size: 1.1rem;
                letter-spacing: 1px;
                animation: pulse 1.5s ease-in-out infinite;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    const spinner = document.createElement('div');
    spinner.id = 'cms-global-spinner';
    
    const lang = localStorage.getItem('lang') || 'ru';
    const text = lang === 'ru' ? 'Открываем портал...' : 'Opening the portal...';
    
    spinner.innerHTML = `
        <div class="spinner-circle"></div>
        <div class="spinner-text">${text}</div>
    `;
    document.body.appendChild(spinner);
}

// 2. ФУНКЦИЯ СКРЫТИЯ СПИННЕРА
function hideSpinner() {
    const spinner = document.getElementById('cms-global-spinner');
    if (spinner) {
        spinner.style.opacity = '0';
        setTimeout(() => spinner.remove(), 400); 
    }
}

// 3. ГЛАВНАЯ ЛОГИКА С УМНЫМ ДОЛГОСРОЧНЫМ КЭШЕМ
async function initCMS() {
    try {
        let data;
        const now = new Date().getTime();
        
        // Проверяем, нет ли секретной команды на принудительное обновление в адресной строке
        const urlParams = new URLSearchParams(window.location.search);
        const forceUpdate = urlParams.get('update') === 'true';
        
        // Достаем данные и время их сохранения из localStorage
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        
        // Логика проверки: если данные есть, время сохранено, прошел меньше 1 часа И нет команды на сброс
        if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_EXPIRATION_MS) && !forceUpdate) {
            data = JSON.parse(cachedData);
            console.log("⚡ Данные моментально загружены из кэша браузера");
        } else {
            // Если данных нет, они устарели или мы вызвали ?update=true
            showSpinner();
            console.log("⏳ Скачивание свежих данных из Google Таблиц...");
            
            const response = await fetch(API_URL);
            data = await response.json();
            
            // Сохраняем новые данные и ставим свежий штамп времени
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIME_KEY, now.toString());
            
            hideSpinner();
            
            // Если использовали секретную ссылку, очищаем ее, чтобы она не мешала
            if (forceUpdate) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        // Распределяем данные
        if (data.Projects) projectsDB = data.Projects;
        if (data.Books) booksDB = data.Books;
        if (data.Notes) notesDB = data.Notes;
        if (data.Chapters) chaptersDB = data.Chapters;
        if (data.Home) homeDB = data.Home;
        
        if (data.Blog) {
            data.Blog.forEach(post => {
                if (post.id) {
                    post.hidden = (post.hidden === 'true' || post.hidden === 'TRUE');
                    postsDB[post.id] = post;
                }
            });
        }

        // Даем команду сайту рисовать контент
        document.dispatchEvent(new Event('db-ready'));
        
    } catch (error) {
        console.error("Ошибка загрузки данных из CMS:", error);
        hideSpinner(); 
    }
}

document.addEventListener('DOMContentLoaded', initCMS);