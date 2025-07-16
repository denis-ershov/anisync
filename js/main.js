// Константы и конфигурация
const CONFIG = {
  CLIENT_ID: 'VR54LgcFVBy7f7skFdXd7y7pIC4XZKpkncJ2av38_Ic',
  CLIENT_SECRET: 'EtGBP7rD5cLX35BajNvxbfry-2z43EXKsZXR-c0QxZg',
  REDIRECT_URI: 'https://denis-ershov.github.io/anisync/',
  BASE_URL: 'https://shikimori.one',
  // API лимиты: 5 запросов в секунду, 90 в минуту
  RATE_LIMIT: {
    REQUESTS_PER_SECOND: 4, // Немного меньше лимита для безопасности
    REQUESTS_PER_MINUTE: 85, // Немного меньше лимита для безопасности
    DELAY_BETWEEN_REQUESTS: 250, // 250ms между запросами (4 в секунду)
    BATCH_SIZE: 4 // Уменьшаем размер батча
  }
};

const DAYS = {
  0: "Воскресенье", 1: "Понедельник", 2: "Вторник", 3: "Среда",
  4: "Четверг", 5: "Пятница", 6: "Суббота", 7: "Неизвестно", 8: "Закончилось"
};

const SEASONS = ["Зима", "Весна", "Лето", "Осень"];

const DAY_PRIORITY = {
  Понедельник: 1, Вторник: 2, Среда: 3, Четверг: 4, Пятница: 5,
  Суббота: 6, Воскресенье: 7, Неизвестно: 8, Закончилось: 9
};

// Класс для управления частотой запросов
class RateLimiter {
  constructor() {
    this.requestTimes = [];
    this.requestsThisMinute = 0;
    this.minuteStartTime = Date.now();
  }

  async waitForSlot() {
    const now = Date.now();
    
    // Сброс счетчика запросов в минуту каждую минуту
    if (now - this.minuteStartTime >= 60000) {
      this.requestsThisMinute = 0;
      this.minuteStartTime = now;
    }
    
    // Проверка лимита в минуту
    if (this.requestsThisMinute >= CONFIG.RATE_LIMIT.REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - (now - this.minuteStartTime);
      console.log(`Достигнут лимит в минуту. Ожидание ${Math.ceil(waitTime/1000)} секунд...`);
      await Utils.delay(waitTime);
      this.requestsThisMinute = 0;
      this.minuteStartTime = Date.now();
    }
    
    // Проверка лимита в секунду
    this.requestTimes = this.requestTimes.filter(time => now - time < 1000);
    
    if (this.requestTimes.length >= CONFIG.RATE_LIMIT.REQUESTS_PER_SECOND) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = 1000 - (now - oldestRequest);
      await Utils.delay(waitTime);
    }
    
    // Добавляем время текущего запроса
    this.requestTimes.push(Date.now());
    this.requestsThisMinute++;
    
    // Дополнительная задержка между запросами
    await Utils.delay(CONFIG.RATE_LIMIT.DELAY_BETWEEN_REQUESTS);
  }
}

// Глобальный rate limiter
const rateLimiter = new RateLimiter();

// Глобальные переменные
let authToken = null;
let userId = null;

// Класс для работы с API
class ShikimoriAPI {
  constructor(token) {
    this.token = token;
    this.headers = {
      "User-Agent": "AniSync",
      'Authorization': `Bearer ${token}`
    };
  }

  async request(url, options = {}) {
    // Ждем разрешения на выполнение запроса
    await rateLimiter.waitForSlot();
    
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    
    if (!response.ok) {
      // Если получили 429 (Too Many Requests), ждем дольше
      if (response.status === 429) {
        console.log('Получен статус 429, ожидание 60 секунд...');
        await Utils.delay(60000);
        return this.request(url, options); // Повторяем запрос
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async getUserInfo() {
    return this.request(`${CONFIG.BASE_URL}/api/users/whoami`);
  }

  async getAnimeRates(userId, status = 'watching', limit = 100) {
    return this.request(`${CONFIG.BASE_URL}/api/users/${userId}/anime_rates?status=${status}&limit=${limit}`);
  }

  async getAnimeData(id) {
    return this.request(`${CONFIG.BASE_URL}/api/animes/${id}`);
  }

  async updateEpisode(rateId, increment = true) {
    const url = increment 
      ? `${CONFIG.BASE_URL}/api/v2/user_rates/${rateId}/increment`
      : `${CONFIG.BASE_URL}/api/v2/user_rates/${rateId}`;
    
    return this.request(url, { method: increment ? 'POST' : 'PATCH' });
  }

  async updateEpisodeCount(rateId, episodes) {
    return this.request(`${CONFIG.BASE_URL}/api/v2/user_rates/${rateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_rate: {
          user_id: userId,
          episodes: episodes,
          target_type: "Anime"
        }
      })
    });
  }
}

// Утилиты
const Utils = {
  delay: (ms = CONFIG.RATE_LIMIT.DELAY_BETWEEN_REQUESTS) => new Promise(resolve => setTimeout(resolve, ms)),
  
  getSeason(date) {
    const month = date.getMonth();
    if (month <= 1 || month === 11) return 0; // Зима
    if (month >= 2 && month <= 4) return 1;   // Весна
    if (month >= 5 && month <= 7) return 2;   // Лето
    return 3; // Осень
  },

  getNextEpisodeDay(time) {
    if (time === null) return DAYS[7];
    if (time === 'released') return DAYS[8];
    return DAYS[new Date(time).getDay()];
  },

  sortByDate: (a, b) => new Date(a.anime.aired_on) - new Date(b.anime.aired_on),
  sortByDay: (a, b) => DAY_PRIORITY[a.next_episode] - DAY_PRIORITY[b.next_episode],

  formatDate(dateString) {
    if (!dateString) return '?';
    if (dateString === 'released') return 'Закончилось';
    return new Date(dateString).toLocaleDateString();
  },

  getDubType(licensors) {
    if (!licensors || licensors.length === 0) return "Anistar";
    const first = licensors[0];
    if (first === "Wakanim") return "WAKANIM";
    if (first === "Crunchyroll") return "Субтитры";
    return "Anistar";
  }
};

// Класс для работы с DOM
class DOMManager {
  static updateProgress(percent) {
    const progress = document.querySelector('.progress-done');
    if (progress) {
      progress.style.width = `${percent}%`;
      progress.style.opacity = 1;
    }
  }

  static showElement(selector) {
    const element = document.querySelector(selector);
    if (element) element.style.display = "block";
  }

  static hideElement(selector) {
    const element = document.querySelector(selector);
    if (element) element.style.display = "none";
  }

  static setLoginState() {
    const loginLink = document.querySelector('div.container-xl > div.row > div:nth-child(1) > a');
    if (loginLink) {
      loginLink.textContent = "Выйти";
      loginLink.classList.add('on-hold');
      // Добавляем CSS правило более безопасным способом
      const style = document.createElement('style');
      style.textContent = 'div.container-xl > div.row > div:nth-child(1):hover{cursor: not-allowed;}';
      document.head.appendChild(style);
    }
  }

  static setError(message) {
    DOMManager.hideElement('.load');
    DOMManager.hideElement('.table');
    DOMManager.showElement('.info');
    
    const infoSpan = document.querySelector('.info > span');
    if (infoSpan) infoSpan.textContent = message;
  }

  static clearTable() {
    const tbody = document.querySelector('.data');
    if (tbody) tbody.innerHTML = '';
  }

  static createSeasonRow(seasonName) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<th class="season" colspan="9">${seasonName}</th>`;
    return tr;
  }

  static createAnimeRow(anime) {
    const tr = document.createElement("tr");
    const allEpisodes = anime.all_episodes === 0 ? "?" : anime.all_episodes;
    
    tr.innerHTML = `
      <th></th>
      <th>${anime.next_episode}</th>
      <th class='inv'>${anime.update_id}</th>
      <td style='overflow: hidden;'>
        <a href='${CONFIG.BASE_URL}${anime.url}'>${anime.name}</a>
      </td>
      <td>${anime.score}</td>
      <td>${anime.watch_episodes}</td>
      <td>
        <div class='btn-group btn-group-sm' role='group' aria-label='Управление просмотренными сериями'>
          <button type='button' class='btn btn-outline-secondary' onclick='updateEpisodeMinus(this)'>&#8722;</button>
          <button type='button' class='btn btn-outline-secondary' onclick='updateEpisodePlus(this)'>&#43;</button>
        </div>
      </td>
      <td>из</td>
      <td>${allEpisodes}</td>
      <td>${anime.date_episode}</td>
    `;
    return tr;
  }

  static applyRowStyling() {
    const table = document.querySelector("body > div > table > tbody");
    if (!table) return;

    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row.cells[8] && !row.cells[5] && !row.cells[4]) continue;

      const episodes = parseInt(row.cells[8]?.innerHTML);
      const watchedEpisodes = parseInt(row.cells[5]?.innerHTML);
      const score = parseFloat(row.cells[4]?.innerHTML);

      // Стилизация для количества серий
      if (episodes >= 20 || row.cells[8]?.innerHTML === "?") {
        row.cells[8].style.backgroundColor = "#dad1f4";
      }

      // Стилизация для просмотренных серий (остался 1 эпизод)
      if (episodes - watchedEpisodes === 1) {
        row.cells[5].style.backgroundColor = "#ffe599";
      }

      // Стилизация для оценки
      if (score <= 6.5) {
        row.cells[4].style.backgroundColor = "#f4cccc";
      } else if (score <= 7.7) {
        row.cells[4].style.backgroundColor = "#d9ead3";
      } else {
        row.cells[4].style.backgroundColor = "#b7e1cd";
      }
    }
  }
}

// Основной класс приложения
class AniSync {
  constructor() {
    this.api = null;
    this.init();
  }

  async init() {
    const code = location.search.substring(6);
    
    if (!code) {
      DOMManager.setError('Войдите в свою учетную запись Shikimori!');
      return;
    }

    try {
      DOMManager.setLoginState();
      authToken = await this.getAccessToken(code);
      this.api = new ShikimoriAPI(authToken);
      
      const userInfo = await this.api.getUserInfo();
      userId = userInfo.id;
      
      await this.loadAndDisplayAnime();
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      DOMManager.setError('Произошла ошибка при загрузке данных');
    }
  }

  async getAccessToken(code) {
    // Используем оригинальный способ - GET запрос с параметрами в URL
    const url = `${CONFIG.BASE_URL}/oauth/token?grant_type=authorization_code&client_id=${CONFIG.CLIENT_ID}&client_secret=${CONFIG.CLIENT_SECRET}&code=${code}&redirect_uri=${CONFIG.REDIRECT_URI}`;
    
    const response = await fetch(url, {
      method: 'POST', // Оставляем POST как в оригинале
      headers: { "User-Agent": "AniSync" }
    });

    if (!response.ok) {
      throw new Error('Ошибка получения токена');
    }

    const result = await response.json();
    return result.access_token;
  }

  async loadAndDisplayAnime() {
    try {
      const animeRates = await this.api.getAnimeRates(userId);
      const animeList = this.processAnimeRates(animeRates);
      const groupedAnime = await this.fetchAnimeDataBatched(animeList);
      
      this.displayAnime(groupedAnime);
      DOMManager.hideElement('.load');
      DOMManager.applyRowStyling();
      
      console.log("Done!");
    } catch (error) {
      console.error('Ошибка загрузки аниме:', error);
      DOMManager.setError('Ошибка загрузки данных аниме');
    }
  }

  processAnimeRates(animeRates) {
    return animeRates
      .sort(Utils.sortByDate)
      .map(item => ({
        id: item.anime.id,
        episodes: item.episodes,
        release_date: item.anime.aired_on
      }));
  }

  async fetchAnimeDataBatched(animeList) {
    const totalItems = animeList.length;
    const groupedAnime = {};
    
    console.log(`Загружаем данные для ${totalItems} аниме. Это займет примерно ${Math.ceil(totalItems * CONFIG.RATE_LIMIT.DELAY_BETWEEN_REQUESTS / 1000)} секунд...`);
    
    // Обрабатываем аниме последовательно с учетом rate limiting
    for (let i = 0; i < totalItems; i++) {
      const anime = animeList[i];
      const percent = Math.round((i / totalItems) * 100);
      DOMManager.updateProgress(percent);
      
      try {
        const animeData = await this.api.getAnimeData(anime.id);
        const result = this.processAnimeData(animeData, anime, i);
        
        const { seasonKey, animeData: processedData, index } = result;
        if (!groupedAnime[seasonKey]) {
          groupedAnime[seasonKey] = {};
        }
        groupedAnime[seasonKey][index] = processedData;
        
        // Обновляем прогресс в консоли каждые 10 элементов
        if (i % 10 === 0) {
          console.log(`Обработано ${i}/${totalItems} аниме (${percent}%)`);
        }
        
      } catch (error) {
        console.error(`Ошибка загрузки данных для аниме ID ${anime.id}:`, error);
        // Продолжаем обработку остальных аниме
      }
    }
    
    DOMManager.updateProgress(100);
    return groupedAnime;
  }

  processAnimeData(result, originalAnime, index) {
    const now = new Date();
    const onair = new Date(originalAnime.release_date);
    const seasonKey = this.getSeasonKey(now, onair);
    
    const nextEpisode = result.next_episode_at;
    const processedNextEpisode = result.status === 'released' ? 'released' : nextEpisode;
    
    const animeData = {
      id: originalAnime.id,
      name: result.name,
      url: result.url,
      next_episode: Utils.getNextEpisodeDay(processedNextEpisode),
      dub: result.licensors || [],
      sub: result.fandubbers || [],
      watch_episodes: originalAnime.episodes,
      all_episodes: result.episodes,
      score: result.score,
      date_episode: Utils.formatDate(processedNextEpisode),
      update_id: result.user_rate.id
    };
    
    return { seasonKey, animeData, index };
  }

  getSeasonKey(now, onair) {
    const yearDiff = now.getFullYear() - onair.getFullYear();
    
    if (yearDiff > 1) {
      return "Основное";
    }
    
    if (yearDiff === 1) {
      const season = SEASONS[Utils.getSeason(onair)];
      return (season === "Зима" || season === "Осень") ? season : "Основное";
    }
    
    return SEASONS[Utils.getSeason(onair)];
  }

  displayAnime(groupedAnime) {
    const tbody = document.querySelector('.data');
    if (!tbody) return;
    
    DOMManager.clearTable();
    
    for (const [seasonName, seasonAnime] of Object.entries(groupedAnime)) {
      const sortedAnime = Object.values(seasonAnime).sort(Utils.sortByDay);
      
      // Добавляем заголовок сезона
      tbody.appendChild(DOMManager.createSeasonRow(seasonName));
      
      // Добавляем аниме
      sortedAnime.forEach(anime => {
        tbody.appendChild(DOMManager.createAnimeRow(anime));
      });
    }
  }
}

// Обработчики событий для кнопок
window.updateEpisodePlus = async function(button) {
  try {
    const row = button.closest('tr');
    const rateId = row.cells[2].innerText;
    
    const api = new ShikimoriAPI(authToken);
    await api.updateEpisode(rateId, true);
    
    // Перезагружаем данные
    const app = new AniSync();
    await app.loadAndDisplayAnime();
  } catch (error) {
    console.error('Ошибка обновления эпизода:', error);
  }
};

window.updateEpisodeMinus = async function(button) {
  try {
    const row = button.closest('tr');
    const rateId = row.cells[2].innerText;
    const currentEpisodes = parseInt(row.cells[5].innerText);
    
    if (currentEpisodes <= 0) return;
    
    const api = new ShikimoriAPI(authToken);
    await api.updateEpisodeCount(rateId, currentEpisodes - 1);
    
    // Перезагружаем данные
    const app = new AniSync();
    await app.loadAndDisplayAnime();
  } catch (error) {
    console.error('Ошибка обновления эпизода:', error);
  }
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  new AniSync();
});