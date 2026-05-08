async function fetchLakersApi() {
    try {
        const response = await fetch('https://openapi.shl.se/seasons/2024/games?teamIds=VLH');
        console.log('SHL API status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log(data);
        } else {
            console.log(await response.text());
        }
    } catch (e) {
        console.error(e);
    }
}
fetchLakersApi();
