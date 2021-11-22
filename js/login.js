const code = location.search.substring(6);
console.log(code);
const url = 'https://shikimori.one/oauth/token?grant_type=authorization_code&client_id=VR54LgcFVBy7f7skFdXd7y7pIC4XZKpkncJ2av38_Ic&client_secret=EtGBP7rD5cLX35BajNvxbfry-2z43EXKsZXR-c0QxZg&code='+code+'redirect_uri=https://denis-ershov.github.io/anisync/';
const options = {  
    method: 'post',  
    headers: {  
      "User-Agent": "AniSync"  
    } 
  }
function accessToken (code) {
    return fetch(url, options)
      .then((response) => response.json())
    .then((result) => {
        console.log(result);
    });
}

if (code !== '') {
    accessToken(code);
}