import { addPlayer, applyCommand, newRoom } from "../src/badtown/engine.ts";
import { TABLES } from "../src/badtown/config.ts";
import { BOT, botMove } from "../src/badtown/bots.ts";
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function rate(n: number, wall: number, games: number) {
  TABLES[n].wall = wall;
  let esc = 0;
  for (let g = 0; g < games; g++) {
    const s = newRoom("CAL001", 0, { seed: g * 131 + n * 7 + wall, untimed: true });
    for (let i = 0; i < n; i++) addPlayer(s, `b${i}`, `B${i}`, "", true);
    applyCommand(s, "b0", undefined, { type: "START" }, 0);
    let k = 0;
    while (s.phase !== "END" && k++ < 3000) for (const p of s.players) { const m = botMove(s, p.id, rand); if (m) applyCommand(s, p.id, undefined, m, 0); }
    if (s.outcome?.winner === "inmates") esc++;
  }
  return esc / games;
}
const base = { ...BOT };
const digs = [0.85, 0.95, 1.0];
const searches = [0.1, 0.4, 0.7, 1.0];
for (const n of [4, 5, 6, 7, 8]) {
  const rows: string[] = [];
  let best: [number, number] | null = null;
  for (let wall = 2; wall <= 12; wall++) {
    // Inmates pick the dig rate that does best against the guards' best reply.
    let mm = -1;
    for (const d of digs) {
      let worst = 2;
      for (const q of searches) {
        Object.assign(BOT, base, { dig: d, digAfterHole: d, search: q, followWhisper: Math.min(1, q + 0.2) });
        worst = Math.min(worst, rate(n, wall, 250));
      }
      mm = Math.max(mm, worst);
    }
    rows.push(`w${wall}:${(mm * 100).toFixed(0)}%`);
    if (!best || Math.abs(mm - 0.47) < Math.abs(best[1] - 0.47)) best = [wall, mm];
    if (mm < 0.15) break;
  }
  console.log(`${n}p ${TABLES[n].guards}G/${TABLES[n].inmates}I: best wall ${best![0]} (${(best![1] * 100).toFixed(0)}%) | ${rows.join(" ")}`);
}
