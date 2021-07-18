const watchList =
  "https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100";

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

/* async function animeBase() {
  let base = {};
  let i = 0;
  let list = await info;
  let y = 0;
(function loopIt(i) {
  setTimeout(async function () {
     base[i] = await animeData(list[i].id, list[i].episodes);
     y++;
     if (y == Object.keys(list).length) {
      return(base);
      }
   if (i < Object.keys(list).length - 1) loopIt(i + 1);
  }, 210);
})(i);
}

const json = animeBase();

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
      data[i].next_episode +
      "<th>[" +
      dub +
      "]</th><td><a href='https://shikimori.one/" +
      data[i].url +
      "'>" +
      data[i].name +
      "</td><td>" +
      data[i].watch_episodes +
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
