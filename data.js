export const DATA_URL = 'https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0002-001.json';
export const REFRESH_MS = 10 * 60 * 1000;
export const STALE_MS = 30 * 60 * 1000;
export const ALERT_MM = 40;

// Never count missing/negative sentinel values as measured zero rain.
export function rainValue(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
export function normalize(payload) {
  const root = payload?.cwaopendata;
  const rows = root?.dataset?.Station ?? payload?.records?.Station;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('資料格式不符或無測站');
  const stations = rows.map(row => ({
    id: String(row.StationId ?? ''), name: String(row.StationName ?? '未命名測站'),
    county: String(row.GeoInfo?.CountyName ?? '未提供縣市'), town: String(row.GeoInfo?.TownName ?? ''),
    time: String(row.ObsTime?.DateTime ?? ''),
    rain: rainValue(row.RainfallElement?.Past1hr?.Precipitation),
    ten: rainValue(row.RainfallElement?.Past10Min?.Precipitation),
    day: rainValue(row.RainfallElement?.Past24hr?.Precipitation),
  }));
  const latest = Math.max(...stations.map(s => Date.parse(s.time)).filter(Number.isFinite));
  if (!Number.isFinite(latest)) throw new Error('資料缺少有效觀測時間');
  return { stations, latest, issued: root?.sent ?? '' };
}
export function summarize(stations) {
  const valid = stations.filter(s => s.rain !== null);
  const sorted = [...valid].sort((a,b) => b.rain - a.rain || a.id.localeCompare(b.id));
  return { valid: valid.length, wet: valid.filter(s => s.rain > 0).length,
    alerts: valid.filter(s => s.rain >= ALERT_MM).length, max: sorted[0] ?? null };
}
export function filterStations(stations, {query='', county='', rain='all'}={}) {
  const q = query.trim().toLocaleLowerCase();
  return stations.filter(s => (!county || s.county === county)
    && (!q || `${s.name} ${s.county} ${s.town} ${s.id}`.toLocaleLowerCase().includes(q))
    && (rain === 'all' || (rain === 'wet' && s.rain > 0)
      || (rain === 'alert' && s.rain !== null && s.rain >= ALERT_MM)
      || (rain === 'missing' && s.rain === null)))
    .sort((a,b) => (b.rain ?? -Infinity) - (a.rain ?? -Infinity) || a.id.localeCompare(b.id));
}
export function isStale(latest, unchangedSince, now=Date.now()) {
  return !Number.isFinite(latest) || now-latest > STALE_MS || now-unchangedSince > STALE_MS;
}
