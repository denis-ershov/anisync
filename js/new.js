const url1 = "https://shikimori.one/api/users/109874/anime_rates?status=watching&limit=100";
const url2 = "https://shikimori.one/api/animes?ids="+myList(url1)+"&limit=20";

function myList(ul) {
fetch(ul)
      .then((response) => {
        return response.json();
      })
      .then((result) => {
          //console.log(result);
        let ids = [];
        let i = 0;
        for (key in data) {
            ids.push(data[i].anime.id);
            i++;
        }
        //console.log(ids);
        return ids;
      })
      .catch((err) => {
        console.log(err);
      });
    }

      /* function aniInfo (ai) {
            fetch(ai)
      .then((response) => {
        return response.json();
      })
      .then((result) => {
          //console.log(result);
        let ids = [];
        let i = 0;
        for (key in data) {
            ids.push(data[i].anime.id);
            i++;
        }
        //console.log(ids);
        return ids;
      })
      .catch((err) => {
        console.log(err);
      });
      } */