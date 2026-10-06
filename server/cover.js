// Auto-generated per-match cover art. Deterministic: same match → same art.
// Each match gets a unique gradient (hue from match id), sport pattern and the two team names.

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

const SPORT_HUE = {
  football: 168, basketball: 22, tennis: 95, ice_hockey: 210, table_tennis: 280,
  volleyball: 320, handball: 190, baseball: 12, cricket: 100, rugby: 150,
  futsal: 170, motorsport: 0, horse_racing: 28, badminton: 260, bandy: 205,
  darts: 120, formula_1: 5, boxing: 350, golf: 130, snooker: 40,
};
const DEFAULT_HUE = 170;

export function generateCover(e) {
  const key = String(e.stream_id || e._ || '');
  const home = (e.home || 'Home').slice(0, 40);
  const away = (e.away || 'Away').slice(0, 40);
  const league = (e.league || '').slice(0, 60);
  const hue = SPORT_HUE[e.sport_key] !== undefined ? SPORT_HUE[e.sport_key] : (hash(key) % 360);
  const hue2 = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},45%,14%)"/>
      <stop offset="1" stop-color="hsl(${hue2},50%,8%)"/>
    </linearGradient>
    <radialGradient id="r" cx="0.25" cy="0.2" r="0.9">
      <stop offset="0" stop-color="hsl(${hue},70%,30%)" stop-opacity="0.5"/>
      <stop offset="1" stop-color="hsl(${hue},70%,30%)" stop-opacity="0"/>
    </radialGradient>
    <pattern id="p" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="36" height="36" fill="url(#g)"/>
      <rect width="18" height="36" fill="hsl(${hue},60%,22%)" opacity="0.35"/>
    </pattern>
  </defs>
  <rect width="640" height="360" fill="url(#p)"/>
  <rect width="640" height="360" fill="url(#r)"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
