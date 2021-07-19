const watchList =
  "https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100";

  const seasons = ['Зима', 'Весна', 'Лето', 'Осень'];

  function delay() {
    return new Promise(resolve => setTimeout(resolve, 210));
  }

function animeList(url) {
  return fetch(url)
    .then((response) => response.json())
    .then((result) => {
      let list = {};
      let i = 0;
      for (key in result) {
        list[i] = {
          id: result[i].anime.id,
          episodes: result[i].episodes,
          release_date: result[i].anime.aired_on
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
  ];
  let d = new Date(time);
  let n = d.getDay();
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

function animeData(id, episodes) {
  return fetch("https://shikimori.one/api/animes/" + id)
    .then((response) => response.json())
    .then((result) => {
      let data = {};
      let i = 0;
        data = {
          id: id,
          name: result.name,
          url: result.url,
          next_episode: nextEpisode(result.next_episode_at),
          dub: result.licensors,
          sub: result.fandubbers,
          watch_episodes: episodes,
          all_episodes: result.episodes,
          score: result.score
        }
        i++;
      //console.log(data);
      return data;
    });
}

//animeData(48406);

const info = animeList(watchList);

/* async function animeData(id, episodes) {
  await delay();
  return fetch("https://shikimori.one/api/animes/" + id)
    .then((response) => response.json())
    .then((result) => {
      let data = {};
      let i = 0;
        data = {
          id: id,
          name: result.name,
          url: result.url,
          next_episode: nextEpisode(result.next_episode_at),
          dub: result.licensors,
          sub: result.fandubbers,
          watch_episodes: episodes,
          all_episodes: result.episodes
        }
        i++;
      //console.log(data);
      return data;
    });
}

async function processArray(obj) {
  let base = {};
  let list = await obj;
  //console.log(list);
  for (const item in list) {
    let now = new Date();
    let onair = new Date(list[item].release_date);

    if (now.getFullYear() - onair.getFullYear() > 1) {
      base['Основное'] = Object.assign({[item]: await animeData(list[item].id, list[item].episodes)}, base['Основное']);
    }
    if (now.getFullYear() - onair.getFullYear() <= 1 && seasons[getSeason(onair)] == 'Зима') {
      base['Зима'] = Object.assign({[item]: await animeData(list[item].id, list[item].episodes)}, base['Зима']);
    }
    if (now.getFullYear() - onair.getFullYear() == 0) {
      base[seasons[getSeason(onair)]] = Object.assign({[item]: await animeData(list[item].id, list[item].episodes)}, base[seasons[getSeason(onair)]]);
    }
    //console.log(list[item]);
  }
  console.log(base);
  console.log('Done!');
  return base;
}

const json = processArray(info);

let tbody = document.querySelector(".data");
    let tr = document.createElement("tr");
    let data = json;
    console.log(data);
    let dub = "";
    if (data[i].dub[0] == "Wakanim") {
      dub = "WAKANIM";
    } else {
      dub = "???";
    }
    let allEpisodes = "";
    if (data[i].all_episodes == 0) {
      allEpisodes = "?";
    } else {
      allEpisodes = data[i].all_episodes;
    }
    tr.innerHTML =
      "<th>" +
      data.next_episode +
      "<th>[" +
      dub +
      "]</th><td><a href='https://shikimori.one/" +
      data.url +
      "'>" +
      data.name +
      "</td><td>" + data.score +
      "</td><td>" +
      data.watch_episodes +
      "</td><td>из</td><td>" +
      allEpisodes +
      "</td><td> </td>";
    tbody.append(tr); */


var i = 0;
(function loopIt(i) {
  setTimeout(async function () {
    let tbody = document.querySelector(".data");
    let tr = document.createElement("tr");
    let list = await info;
    let data = await animeData(list[i].id, list[i].episodes);
    //console.log(data);
    let dub = "";
    if (data.dub[0] == "Wakanim") {
      dub = "WAKANIM";
    } else {
      dub = "???";
    }
    let allEpisodes = "";
    if (data.all_episodes == 0) {
      allEpisodes = "?";
    } else {
      allEpisodes = data.all_episodes;
    }

    tr.innerHTML =
      "<th>" +
      data.next_episode +
      "<th>[" +
      dub +
      "]</th><td><a href='https://shikimori.one/" +
      data.url +
      "'>" +
      data.name +
      "</td><td>" + data.score +
      "</td><td>" +
      data.watch_episodes +
      "</td><td>из</td><td>" +
      allEpisodes +
      "</td><td> </td>";
    tbody.append(tr);
    if (i < Object.keys(list).length - 1) loopIt(i + 1);
  }, 210);
})(i);
