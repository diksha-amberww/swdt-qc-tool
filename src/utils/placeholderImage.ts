/** Local SVG thumbnail — avoids network + image decode of remote photos. */
export function placeholderImage(label: string, seed: number): string {
  const hue = seed % 360;
  const bg = `hsl(${hue}, 28%, 86%)`;
  const fg = `hsl(${hue}, 32%, 32%)`;
  const safe = label.replace(/[<>&]/g, '').slice(0, 14);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="${bg}"/><text x="80" y="84" text-anchor="middle" font-size="11" font-family="Segoe UI,sans-serif" fill="${fg}">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
