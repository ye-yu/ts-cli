async function getTime() {
    const response = await fetch('https://aisenseapi.com/services/v1/datetime');
    const data = await response.json();
    return data as { datetime: string };
}

export default async function () {
    const timeData = await getTime();
    console.log(`Current datetime from API: ${timeData.datetime}`);
}