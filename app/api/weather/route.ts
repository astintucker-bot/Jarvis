import { NextRequest, NextResponse } from "next/server";
import { requireJarvisAccess } from "../../../lib/safetyPolicy";

export const runtime = "nodejs";

const weatherText: Record<number, string> = { 0: "clear skies", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "heavy rain showers", 95: "thunderstorms" };

export async function GET(request: NextRequest) {
  const denied = requireJarvisAccess(request);
  if (denied) return denied;
  const location = request.nextUrl.searchParams.get("location")?.trim();
  if (!location || location.length > 120) return NextResponse.json({ error: "Enter a city or location for the weather." }, { status: 400 });
  try {
    const places = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`, { cache: "no-store" });
    const place = (await places.json() as { results?: Array<{ name: string; latitude: number; longitude: number; admin1?: string; country?: string }> }).results?.[0];
    if (!places.ok || !place) return NextResponse.json({ error: `I could not find ${location}.` }, { status: 404 });
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m", temperature_unit: "fahrenheit", wind_speed_unit: "mph" }).toString();
    const forecast = await fetch(weatherUrl, { cache: "no-store" });
    const current = (await forecast.json() as { current?: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number } }).current;
    if (!forecast.ok || !current) throw new Error("Weather lookup failed.");
    return NextResponse.json({ location: [place.name, place.admin1, place.country].filter(Boolean).join(", "), temperature_f: current.temperature_2m, feels_like_f: current.apparent_temperature, conditions: weatherText[current.weather_code] || "mixed conditions", wind_mph: current.wind_speed_10m }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Live weather is temporarily unavailable." }, { status: 503 }); }
}
