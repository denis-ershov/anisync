//https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100

/* function nextEpisode(ne) {
    return fetch("https://shikimori.one/api/animes/" + ne)
      .then(response => response.json())
      .then(result => {
        let days = [
          "Воскресенье",
          "Понедельник",
          "Вторник",
          "Среда",
          "Четверг",
          "Пятница",
          "Суббота",
        ];
        let d = new Date(result.next_episode_at);
        let n = d.getDay();
        //console.log(days[n]);
        return days[n];
      })
} */

function nextEpisode(ne) {
  return fetch("https://shikimori.one/api/animes/" + ne)
    .then(response => response.json())
    .then(result => {
      let days = [
        "Воскресенье",
        "Понедельник",
        "Вторник",
        "Среда",
        "Четверг",
        "Пятница",
        "Суббота",
      ];
      let d = new Date(result.next_episode_at);
      let n = d.getDay();
      //console.log(days[n]);
      return days[n];
    })
}

var i = 0;
(function loopIt(i) {
  setTimeout(function(){
    let tbody = document.querySelector(".data");
    let tr = document.createElement("tr");
    let id = data[i].anime.id;
/*     const aniDate = () => {
      nextEpisode(id).then((a) => {
        console.log(a);
      });
    }; */
    if (data[i].anime.episodes == 0) {
      tr.innerHTML = '<th>' +
        nextEpisode(id) +
        "<th>[???]</th><td>" +
        data[i].anime.name +
        "</td><td>" +
        data[i].episodes +
        "</td><td>из</td><td>?</td><td>???</td>";
      tbody.append(tr);
    } else {
      tr.innerHTML = '<th>' +
        nextEpisode(id) +
        "<th>[???]</th><td>" +
        data[i].anime.name +
        "</td><td>" +
        data[i].episodes +
        "</td><td>из</td><td>" +
        data[i].anime.episodes +
        "</td><td>???</td>";
      tbody.append(tr);
    }
    //console.log(i);
      if(i < data.length - 1)  loopIt(i+1)
    }, 200);
})(i)

/* var i = 0;
for (let key in data) {
  let tbody = document.querySelector(".data");
  let tr = document.createElement("tr");
  let id = data[i].anime.id;
  if (data[i].anime.episodes == 0) {
    tr.innerHTML =
      "<th>" +
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
} */

/*   fetch('https://shikimori.one/api/animes/'+id)
  .then((response) => {
    return response.json();
  })
  .then((result) => {
    let time = date(result.next_episode_at);
    return time;
  }) 
});*/

/* async function nextEpisode(ne) {
  let req = await fetch("https://shikimori.one/api/animes/" + ne);
  let result = await req.json();
      //console.log(result);
      let days = [
        "Воскресенье",
        "Понедельник",
        "Вторник",
        "Среда",
        "Четверг",
        "Пятница",
        "Суббота",
      ];
      let d = new Date(result.next_episode_at);
      let n = d.getDay();
      //console.log(days[n]);
      let time = days[n];
      //console.log(time);
      return time;
} */
