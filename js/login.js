const code = location.search.substring(6);
const url = 'https://shikimori.one/oauth/token';
function accessToken (code) {
    return fetch(url, {  
        method: 'post',  
        headers: {  
          "User-Agent": "AniSync"  
        },  
        body: 'grant_type="authorization_code"&client_id="VR54LgcFVBy7f7skFdXd7y7pIC4XZKpkncJ2av38_Ic"&client_secret="EtGBP7rD5cLX35BajNvxbfry-2z43EXKsZXR-c0QxZg"&code='+code+'redirect_uri="https://denis-ershov.github.io/anisync/"'  
      })
      .then(json)  
      .then(function (data) {  
        console.log('Request succeeded with JSON response', data);  
      })  
      .catch(function (error) {  
        console.log('Request failed', error);  
      })
}

if (code != null) {
    accessToken(code);
}