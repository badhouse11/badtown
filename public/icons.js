// Good Neighbours icon set. Original, solid geometric symbols on a 48-unit grid.
// Black on colour discs. Stroke-built icons use a 6-unit weight to match the solid ones.

const S = (d, extra = "") => `<path ${extra} d="${d}"/>`;
const STROKE = (d, w = 6) => `<path fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;

function star(points, outer, inner, cx = 24, cy = 24) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
}

const RAW = {
  // Core
  house: S("M24 5 3 22h6v21h12V32h6v11h12V22h6z"),
  help: `<rect x="18" y="3" width="12" height="42" rx="6"/><rect x="3" y="18" width="42" height="12" rx="6"/>`,
  harm: `<rect x="18" y="3" width="12" height="42" rx="6" transform="rotate(45 24 24)"/><rect x="18" y="3" width="12" height="42" rx="6" transform="rotate(-45 24 24)"/>`,
  coin: S("M24 4a20 20 0 1 1 0 40 20 20 0 0 1 0-40zm0 7a13 13 0 1 0 0 26 13 13 0 0 0 0-26z", 'fill-rule="evenodd"') + `<circle cx="24" cy="24" r="7"/>`,
  eye: S("M2 24C8 13 15 8 24 8s16 5 22 16c-6 11-13 16-22 16S8 35 2 24zm22-9a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", 'fill-rule="evenodd"') + `<circle cx="24" cy="24" r="4"/>`,
  bribe: S("M3 12h42v24H3zM24 17a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM8 17v4h4v-4zm28 10v4h4v-4z", 'fill-rule="evenodd"'),
  point: S("M19 3h10v17h9L24 36 10 20h9z") + `<circle cx="24" cy="42" r="5"/>`,
  rumour: S("M8 7h32a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H23l-11 9v-9H8a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4zm8 13a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8 0a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8 0a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", 'fill-rule="evenodd"'),
  stocks: S("M3 13h42v15H3zm9 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm12 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm12 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", 'fill-rule="evenodd"') + `<rect x="9" y="28" width="6" height="17"/><rect x="33" y="28" width="6" height="17"/>`,
  crown: S("M4 14l10 9 10-15 10 15 10-9-4 24H8zM8 40h32v5H8z"),
  ruin: S("M3 44h42v-4H36V26l-5 4-3-9-5 7-4-12-4 10-4-5v19H3z"),
  // Event cards
  flame: S("M24 3c3 9 15 14 15 27a15 15 0 0 1-30 0c0-6 3-11 7-14 0 6 2 9 5 10-2-8 0-16 3-23z"),
  wave: STROKE("M4 13c5-5 10-5 15 0s10 5 15 0 7-4 10-2M4 24c5-5 10-5 15 0s10 5 15 0 7-4 10-2M4 35c5-5 10-5 15 0s10 5 15 0 7-4 10-2", 5),
  bolt: S("M29 2 8 28h13l-3 18 22-28H27z"),
  coins: `<rect x="7" y="7" width="32" height="10" rx="5"/><rect x="12" y="19" width="32" height="10" rx="5"/><rect x="4" y="31" width="32" height="10" rx="5"/>`,
  cross: `<g transform="rotate(45 24 24)">${S("M15 22V11a9 9 0 0 1 18 0v11z")}${S("M15 26h18v11a9 9 0 0 1-18 0z")}</g>`,
  bridge: S("M2 16h44v7h-4v20h-8v-7a10 10 0 0 0-20 0v7H6V23H2z"),
  burst: S(star(12, 22, 13)),
  mask: S("M3 15c7-4 14-4 21 1 7-5 14-5 21-1v9c0 9-6 13-12 13-4 0-7-3-9-6-2 3-5 6-9 6-6 0-12-4-12-13zm10 6a5 5 0 1 0 10 0 5 5 0 0 0-10 0zm15 0a5 5 0 1 0 10 0 5 5 0 0 0-10 0z", 'fill-rule="evenodd"'),
  food: S("M24 15c-4-3-15-3-17 7-2 10 5 22 11 22 3 0 4-2 6-2s3 2 6 2c6 0 13-12 11-22-2-10-13-10-17-7z") + STROKE("M24 15c0-5 3-9 8-11", 4),
  cloud: S("M13 30a9 9 0 0 1 1-18 12 12 0 0 1 23 3 7.5 7.5 0 0 1-1 15z") + STROKE("M16 36l-3 7M25 36l-3 7M34 36l-3 7", 4),
  warning: S("M24 3 46 43H2zm-3.5 14v14h7V17zm0 17v6h7v-6z", 'fill-rule="evenodd"'),
  build: S("M3 7h20v10H3zM25 7h20v10H25zM3 19h9v10H3zM14 19h20v10H14zM36 19h9v10h-9zM3 31h20v10H3zM25 31h20v10H25z"),
  book: S("M3 9c8-3 15-1 20 4v29c-5-5-12-6-20-4zM45 9c-8-3-15-1-20 4v29c5-5 12-6 20-4z"),
  // Agendas
  pillar: S("M6 4h36v7H6zM11 13h6v26h-6zM21 13h6v26h-6zM31 13h6v26h-6zM4 41h40v5H4z"),
  developer: S("M3 45V22h11v23zM16 45V5h14v40zM32 45V15h13v30zM20 10v4h6v-4zm0 8v4h6v-4zm0 8v4h6v-4zm16-6v4h5v-4zm0 8v4h5v-4z", 'fill-rule="evenodd"'),
  gossip: S("M3 4h26v18H15l-7 6v-6H3zM19 24h26v17h-5v6l-8-6H19z"),
  chameleon: S("M24 3a21 21 0 1 0 0 42 21 21 0 0 0 0-42zm0 7v28a14 14 0 0 0 0-28z", 'fill-rule="evenodd"'),
  martyr: `<ellipse cx="24" cy="8" rx="14" ry="4.5" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="24" cy="23" r="8"/>` + S("M8 46a16 13 0 0 1 32 0z"),
  fixer: `<g fill="none" stroke="currentColor" stroke-width="6"><circle cx="17" cy="24" r="11"/><circle cx="31" cy="24" r="11"/></g>`,
  snake: STROKE("M35 9C27 4 12 6 12 15s24 8 24 18-15 12-25 7", 7) + `<circle cx="38" cy="9" r="4"/>`,
  neighbour: S("M24 3 3 21h5v24h32V21h5zm0 20c-2-3-8-3-8 2 0 4 8 9 8 9s8-5 8-9c0-5-6-5-8-2z", 'fill-rule="evenodd"'),
};

export function icon(name, label = "") {
  const body = RAW[name] ?? RAW.burst;
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  return `<svg class="ic" viewBox="0 0 48 48" fill="currentColor" ${a11y}>${body}</svg>`;
}

export const ICON_NAMES = Object.keys(RAW);
