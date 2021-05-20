//https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100
var i = 0;
for (let key in data) {
  let tbody = document.querySelector(".data");
  let tr = document.createElement("tr");
  let id = data[i].anime.id;
  if (data[i].anime.episodes == 0) {
    tr.innerHTML =
      "<th>" +
      console.log(nextEpisode(id));
      nextEpisode(id) +
      "</th><th>[???]</th><td>" +
      data[i].anime.name +
      "</td><td>" +
      data[i].episodes +
      "</td><td>из</td><td>?</td><td>???</td>";
    tbody.append(tr);
    i++;
  } else {
    tr.innerHTML =
      "<th>" +
      nextEpisode(id) +
      "</th><th>[???]</th><td>" +
      data[i].anime.name +
      "</td><td>" +
      data[i].episodes +
      "</td><td>из</td><td>" +
      data[i].anime.episodes +
      "</td><td>???</td>";
    tbody.append(tr);
    i++;
  }
}

function date(dt) {
  let days = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  let d = new Date(dt);
  let n = d.getDay();
  return days[n];
}

function nextEpisode(ne) {
  fetch("https://shikimori.one/api/animes/" + ne)
    .then((response) => {
      return response.json();
    })
    .then((result) => {
      //console.log(result);
      let time = date(result.next_episode_at);
      //console.log(time);
      return time;
    })
    .catch((err) => {
      console.log(err);
    });
}
