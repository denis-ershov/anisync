const watchList =
  "https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100";

const seasons = ["Зима", "Весна", "Лето", "Осень"];

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 210));
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

//animeData(48406);

const info = animeList(watchList);

async function animeData(id, episodes) {
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
        all_episodes: result.episodes,
        score: result.score
      };
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

  let tbody = document.querySelector(".data");
  let tr = '';
  let data = json;
  console.log(data);

  for (let key in data) {
    //console.log(key);
    if (key == "Основное") {
      tr = document.createElement("tr");
      tr.innerHTML = '<th colspan="9">' + key + "</th>";
        tbody.append(tr);
      for (let item in data[key]) {
        //console.log(key);
        let dub = "";
        if (data[key][item].dub[0] == "Wakanim") {
          dub = "WAKANIM";
        } else {
          dub = "???";
        }
        let allEpisodes = "";
        if (data[key][item].all_episodes == 0) {
          allEpisodes = "?";
        } else {
          allEpisodes = data[key][item].all_episodes;
        }
        tr = document.createElement("tr");
        tr.innerHTML =
          "<th></th><th>" +
          data[key][item].next_episode +
          "<th>[" +
          dub +
          "]</th><td style='overflow: hidden;'><a href='https://shikimori.one" +
          data[key][item].url +
          "'>" +
          data[key][item].name +
          "</td><td>" +
          data[key][item].score +
          "</td><td>" +
          data[key][item].watch_episodes +
          "</td><td>из</td><td>" +
          allEpisodes +
          "</td><td> </td>";
        tbody.append(tr);
      }
    }
    if (key == "Зима") {
      tr = document.createElement("tr");
      tr.innerHTML = '<th colspan="9">' + key + "</th>";
        tbody.append(tr);
      for (let item in data[key]) {
        //console.log(key);
        let dub = "";
        if (data[key][item].dub[0] == "Wakanim") {
          dub = "WAKANIM";
        } else {
          dub = "???";
        }
        let allEpisodes = "";
        if (data[key][item].all_episodes == 0) {
          allEpisodes = "?";
        } else {
          allEpisodes = data[key][item].all_episodes;
        }
        tr = document.createElement("tr");
        tr.innerHTML =
          "<th></th><th>" +
          data[key][item].next_episode +
          "<th>[" +
          dub +
          "]</th><td style='overflow: hidden;'><a href='https://shikimori.one" +
          data[key][item].url +
          "'>" +
          data[key][item].name +
          "</td><td>" +
          data[key][item].score +
          "</td><td>" +
          data[key][item].watch_episodes +
          "</td><td>из</td><td>" +
          allEpisodes +
          "</td><td> </td>";
        tbody.append(tr);
      }
    }
    if (key == "Весна") {
      tr = document.createElement("tr");
      tr.innerHTML = '<th colspan="9">' + key + "</th>";
        tbody.append(tr);
      for (let item in data[key]) {
        //console.log(key);
        let dub = "";
        if (data[key][item].dub[0] == "Wakanim") {
          dub = "WAKANIM";
        } else {
          dub = "???";
        }
        let allEpisodes = "";
        if (data[key][item].all_episodes == 0) {
          allEpisodes = "?";
        } else {
          allEpisodes = data[key][item].all_episodes;
        }
        tr = document.createElement("tr");
        tr.innerHTML =
          "<th></th><th>" +
          data[key][item].next_episode +
          "<th>[" +
          dub +
          "]</th><td style='overflow: hidden;'><a href='https://shikimori.one" +
          data[key][item].url +
          "'>" +
          data[key][item].name +
          "</td><td>" +
          data[key][item].score +
          "</td><td>" +
          data[key][item].watch_episodes +
          "</td><td>из</td><td>" +
          allEpisodes +
          "</td><td> </td>";
        tbody.append(tr);
      }
    }
    if (key == "Лето") {
      tr = document.createElement("tr");
      tr.innerHTML = '<th colspan="9">' + key + "</th>";
        tbody.append(tr);
      for (let item in data[key]) {
        //console.log(key);
        let dub = "";
        if (data[key][item].dub[0] == "Wakanim") {
          dub = "WAKANIM";
        } else {
          dub = "???";
        }
        let allEpisodes = "";
        if (data[key][item].all_episodes == 0) {
          allEpisodes = "?";
        } else {
          allEpisodes = data[key][item].all_episodes;
        }
        tr = document.createElement("tr");
        tr.innerHTML =
          "<th></th><th>" +
          data[key][item].next_episode +
          "<th>[" +
          dub +
          "]</th><td style='overflow: hidden;'><a href='https://shikimori.one" +
          data[key][item].url +
          "'>" +
          data[key][item].name +
          "</td><td>" +
          data[key][item].score +
          "</td><td>" +
          data[key][item].watch_episodes +
          "</td><td>из</td><td>" +
          allEpisodes +
          "</td><td> </td>";
        tbody.append(tr);
      }
    }
    if (key == "Осень") {
      tr = document.createElement("tr");
      tr.innerHTML = '<th colspan="9">' + key + "</th>";
        tbody.append(tr);
      for (let item in data[key]) {
        //console.log(key);
        let dub = "";
        if (data[key][item].dub[0] == "Wakanim") {
          dub = "WAKANIM";
        } else {
          dub = "???";
        }
        let allEpisodes = "";
        if (data[key][item].all_episodes == 0) {
          allEpisodes = "?";
        } else {
          allEpisodes = data[key][item].all_episodes;
        }
        tr = document.createElement("tr");
        tr.innerHTML =
          "<th></th><th>" +
          data[key][item].next_episode +
          "<th>[" +
          dub +
          "]</th><td style='overflow: hidden;'><a href='https://shikimori.one" +
          data[key][item].url +
          "'>" +
          data[key][item].name +
          "</td><td>" +
          data[key][item].score +
          "</td><td>" +
          data[key][item].watch_episodes +
          "</td><td>из</td><td>" +
          allEpisodes +
          "</td><td> </td>";
        tbody.append(tr);
      }
    }
  }
}

print();
