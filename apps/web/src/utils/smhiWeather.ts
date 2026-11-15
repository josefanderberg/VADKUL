/**
 * SHIM (15/11 2026, #237): vädret i stadsplattan bor numera i
 * @vadkul/kontrakt (packages/kontrakt/src/smhiWeather.ts) - webben och appen
 * visar samma väder med SAMMA kod. Där står hela bakgrunden (#202, #221) och
 * testerna flyttade med. Hämtningen ligger kvar i hooks/useCityWeather.
 */
export {
    cityWeatherFor,
    createSmhiLoader,
    formatTemp,
    parseSmhiForecast,
    pickWeatherForDay,
    SMHI_RETRY_MS,
    SMHI_TTL_MS,
    smhiPointUrl,
    WEATHER_PENDING,
    weatherEmoji,
    weatherText,
    weatherToShow,
} from '@vadkul/kontrakt';
export type { CityWeather, WeatherShown, WeatherStep } from '@vadkul/kontrakt';
