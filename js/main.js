const watchList = "https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100";
//const watchList = "https://shikimori.one/api/users/@me/anime_rates?status=watching&limit=100";

const seasons = ["Зима", "Весна", "Лето", "Осень"];

const code = location.search.substring(6);
//console.log(code);

function accessToken (code) {
  const url = 'https://shikimori.one/oauth/token?grant_type=authorization_code&client_id=VR54LgcFVBy7f7skFdXd7y7pIC4XZKpkncJ2av38_Ic&client_secret=EtGBP7rD5cLX35BajNvxbfry-2z43EXKsZXR-c0QxZg&code='+code+'&redirect_uri=https://denis-ershov.github.io/anisync/';
  const options = {  
    method: 'post',  
    headers: {  
      "User-Agent": "AniSync"  
    } 
  }
    return fetch(url, options)
      .then((response) => response.json())
    .then((result) => {
      let token = result.access_token;
      //console.log(token);
        return token;
    });
}


function delay() {
  return new Promise((resolve) => setTimeout(resolve, 210));
}

function sortByDate(a, b) {
  if (a.anime.aired_on < b.anime.aired_on) {
    return -1;
  }
  if (a.anime.aired_on > b.anime.aired_on) {
    return 1;
  }
  return 0;
}

function sortByDay(a, b) {
  let days = {
    Понедельник: 1,
    Вторник: 2,
    Среда: 3,
    Четверг: 4,
    Пятница: 5,
    Суббота: 6,
    Воскресенье: 7,
    Неизвестно: 8,
    Закончилось: 9
  };
  return days[a.next_episode] - days[b.next_episode];
}

async function animeList(url) {
  let auth = await accessToken(code);
  console.log(auth);
  return fetch(url, /*{headers : {'Authorization': 'Bearer' + auth}}*/)
    .then((response) => response.json())
    .then((result) => {
      let list = {};
      let i = 0;
      result.sort(sortByDate);
      for (key in result) {
        list[i] = {
          id: result[i].anime.id,
          episodes: result[i].episodes,
          release_date: result[i].anime.aired_on,
        };
        i++;
      }
      //console.log(list);
      return list;
    });
}

//animeList(watchList);

function nextEpisode(time) {
  let days = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
    "Неизвестно",
    "Закончилось"
  ];
  let d = new Date(time);
  let n = d.getDay();
  if (time == null) {
    n = 7;
  }
  if (time == 'released') {
    n = 8;
  }
  return days[n];
}

function getSeason(date) {
  let i = 0;
  if (date.getMonth() <= 1 || date.getMonth() == 11) {
    i = 0;
    //return i;
  }
  if (date.getMonth() >= 2 && date.getMonth() <= 4) {
    i = 1;
    //return i;
  }
  if (date.getMonth() >= 5 && date.getMonth() <= 7) {
    i = 2;
    //return i;
  }
  if (date.getMonth() >= 8 && date.getMonth() <= 10) {
    i = 3;
    //return i;
  }
  return i;
}

//animeData(48406);

const info = animeList(watchList);

async function animeData(id, episodes) {
  await delay();
  return fetch("https://shikimori.one/api/animes/" + id)
    .then((response) => response.json())
    .then((result) => {
      //console.log(result);
      let nxEpisode = result.next_episode_at;
      if (result.status == 'released') {
        nxEpisode = 'released';
      }
      let data = {};
      let nextDate = new Date(nxEpisode);
      let newDate;
      if (nxEpisode == null) {
        newDate = '?';
      } else if (nxEpisode == 'released') {
        newDate = 'Закончилось';
      }
      else {
        newDate = nextDate.toLocaleDateString();
      }

      data = {
        id: id,
        name: result.name,
        url: result.url,
        next_episode: nextEpisode(nxEpisode),
        dub: result.licensors,
        sub: result.fandubbers,
        watch_episodes: episodes,
        all_episodes: result.episodes,
        score: result.score,
        date_episode: newDate
      };
      //console.log(data);
      return data;
    });
}

async function processArray(obj) {
  let base = {};
  let list = await obj;
  let size = Object.keys(await info).length;
  const progress = document.querySelector('.progress-done');
  //console.log(list);
  for (const item in list) {

  let persent = Math.round(100*item/size);
  progress.style.width = persent + '%';
  progress.style.opacity = 1;
  
    let now = new Date();
    var onair = new Date(list[item].release_date);

    if (now.getFullYear() - onair.getFullYear() > 1) {
      base["Основное"] = Object.assign(
        { [item]: await animeData(list[item].id, list[item].episodes) },
        base["Основное"]
      );
    }
    if (
      now.getFullYear() - onair.getFullYear() <= 1 &&
      seasons[getSeason(onair)] == "Зима"
    ) {
      base["Зима"] = Object.assign(
        { [item]: await animeData(list[item].id, list[item].episodes) },
        base["Зима"]
      );
    }
    if (now.getFullYear() - onair.getFullYear() == 0) {
      base[seasons[getSeason(onair)]] = Object.assign(
        { [item]: await animeData(list[item].id, list[item].episodes) },
        base[seasons[getSeason(onair)]]
      );
    }
    //console.log(list[item]);
  }
  //console.log(base);
  console.log("Done!");
  return base;
}

async function print() {
  const json = await processArray(info);
  Object.values(json["Лето"]).sort(sortByDay);

  let tbody = document.querySelector(".data");
  let tr = "";
  let data = json;

  for (let key in data) {
    //console.log(data[key]);
    let db = Object.values(data[key]).sort(sortByDay);
    //console.log(db);
    tr = document.createElement("tr");
    tr.innerHTML = '<th class="season" colspan="9">' + key + "</th>";
    tbody.append(tr);
    for (let item in db) {
      //console.log(db);
      let dub = "";
      if (db[item].dub[0] == "Wakanim") {
        dub = "WAKANIM";
      } else if (db[item].dub[0] == "Crunchyroll") {
        dub = "Субтитры";
      } else {
        dub = "Anistar";
      }
      let allEpisodes = "";
      if (db[item].all_episodes == 0) {
        allEpisodes = "?";
      } else {
        allEpisodes = db[item].all_episodes;
      }
      tr = document.createElement("tr");
      tr.innerHTML =
        "<th></th><th>" +
        db[item].next_episode +
        "<th>[" +
        dub +
        "]</th><td style='overflow: hidden;'><a href='https://shikimori.one" +
        db[item].url +
        "'>" +
        db[item].name +
        "</td><td>" +
        db[item].score +
        "</td><td>" +
        db[item].watch_episodes +
        "</td><td>из</td><td>" +
        allEpisodes +
        "</td><td>"+ db[item].date_episode +"</td>";
      tbody.append(tr);
    }
  }
  document.querySelector('.load').style.display = "none";
  front();
}

print();

function front() {
  let table = document.querySelector("body > div > table > tbody");
  for (let i = 0, row; (row = table.rows[i]); i++) {
    if (row.cells[7] != undefined || row.cells[5] != undefined || row.cells[4] != undefined) {
    if (row.cells[7].innerHTML >= 20 || row.cells[7].innerHTML == "?") {
      document.querySelector("body > div > table > tbody > tr:nth-child(" + (i+1) + ") > td:nth-child(8)").style.backgroundColor = "#dad1f4";
    }
    if ((row.cells[7].innerHTML - row.cells[5].innerHTML) == 1) {
      document.querySelector("body > div > table > tbody > tr:nth-child(" + (i+1) + ") > td:nth-child(6)").style.backgroundColor = "#ffe599";
    }
    if (row.cells[4].innerHTML <= 6.7) {
      document.querySelector("body > div > table > tbody > tr:nth-child(" + (i+1) + ") > td:nth-child(5)").style.backgroundColor = "#fa8072";
    }
    if (row.cells[4].innerHTML >= 7.8) {
      document.querySelector("body > div > table > tbody > tr:nth-child(" + (i+1) + ") > td:nth-child(5)").style.backgroundColor = "#66ff66";
    }
  }
  }
}