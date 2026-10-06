// MultiSportsHD brand logo — inline SVG (crisp at any size, brand colors match the theme).
// Streaked italic "M" mark + wordmark: MULTI (silver) SPORTS (gray) HD (blue).

export function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 64" role="img" aria-label="MultiSportsHD">
  <defs>
    <linearGradient id="mgrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8f1fa"/>
      <stop offset="0.45" stop-color="#8fb8dd"/>
      <stop offset="1" stop-color="#1d6fd6"/>
    </linearGradient>
    <linearGradient id="hdgrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5aa9f0"/>
      <stop offset="1" stop-color="#1d6fd6"/>
    </linearGradient>
  </defs>
  <g transform="skewX(-8)">
    <!-- streaked M mark -->
    <g fill="url(#mgrad)">
      <polygon points="8,52 8,12 15,12 15,52"/>
      <polygon points="19,52 19,12 26,12 26,52" opacity="0.85"/>
      <polygon points="30,52 30,12 37,12 37,52" opacity="0.7"/>
      <polygon points="41,52 41,12 48,12 48,52" opacity="0.85"/>
      <polygon points="52,52 52,12 59,12 59,52"/>
      <!-- M diagonals -->
      <polygon points="8,12 19,34 19,44 8,22" opacity="0.9"/>
      <polygon points="19,34 30,12 37,12 26,44 19,44" opacity="0.75"/>
      <polygon points="41,34 52,12 59,12 48,44 41,44" opacity="0.9"/>
      <polygon points="52,12 59,34 59,44 52,22"/>
    </g>
    <!-- wordmark -->
    <text x="70" y="44" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" font-style="italic" letter-spacing="0.5">
      <tspan fill="#e8eef4">MULTI</tspan><tspan fill="#aebfcd">SPORTS</tspan><tspan fill="url(#hdgrad)">HD</tspan>
    </text>
    <text x="71" y="56" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="600" fill="#5f7385" letter-spacing="3.2">LIVE SPORTS STREAMING</text>
  </g>
</svg>`;
}
