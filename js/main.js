//https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100

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
      return days[n];
    })
}

var i = 0;
(function loopIt(i) {
  setTimeout( async function(){
    let tbody = document.querySelector(".data");
    let tr = document.createElement("tr");
    let id = data[i].anime.id;
    if (data[i].anime.episodes == 0) {
      tr.innerHTML = '<th>' +
        await nextEpisode(id) +
        "<th>[???]</th><td><a href='https://shikimori.one/"+ data[i].anime.url +"'>" +
        data[i].anime.name +
        "</td><td>" +
        data[i].episodes +
        "</td><td>из</td><td>?</td><td>???</td>";
      tbody.append(tr);
    } else {
      tr.innerHTML = '<th>' +
        await nextEpisode(id) +        
        "<th>[???]</th><td><a href='https://shikimori.one/"+ data[i].anime.url +"'>" +
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