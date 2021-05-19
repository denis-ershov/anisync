//https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100

var i = 0;
for (let key in data) {
  let tbody = document.querySelector(".data");
  let tr = document.createElement("tr");
  //console.log(data[i]);
  if (data[i].anime.episodes == 0) {
    tr.innerHTML =
      "<th>???</th><th>[???]</th><td>" +
      data[i].anime.name +
      "</td><td>" +
      data[i].episodes +
      "</td><td>из</td><td>?</td><td>???</td>";
    tbody.append(tr);
    i++;
  } else {
    tr.innerHTML =
      "<th>???</th><th>[???]</th><td>" +
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