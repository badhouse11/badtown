import type { Template } from "./types.ts";

// The 20 resolution patterns from the v1.0 brief. p = primary target, s = secondary target.
// All personal effects stay within -2..+2 coins.
const t = (id: string, name: string, hp: number, hs: number, xp: number, xs: number): Template => ({
  id,
  name,
  help: { p: hp, s: hs },
  harm: { p: xp, s: xs },
});

export const TEMPLATES: Record<string, Template> = Object.fromEntries(
  [
    t("T01", "Primary threatened", 1, 0, -2, -1),
    t("T02", "Primary business threatened", 1, 0, -1, -1),
    t("T03", "Shared infrastructure", 1, 1, -1, -1),
    t("T04", "Funding opportunity", 2, 0, -1, 1),
    t("T05", "Public prize", 1, 1, 2, -1),
    t("T06", "Disputed grant", 2, 0, -1, 1),
    t("T07", "Corruption scandal", -1, 1, 1, -1),
    t("T08", "Public cover-up", -1, 1, 1, -1),
    t("T09", "Workforce issue", 1, 1, -2, 0),
    t("T10", "Personal rescue", 2, 1, -2, 0),
    t("T11", "Rival opportunity", 1, 1, -1, 2),
    t("T12", "Town reputation", 1, 0, -1, -1),
    t("T13", "Windfall redistribution", 1, 1, 2, -1),
    t("T14", "Hidden hazard", 1, 0, -2, -1),
    t("T15", "Resource shortage", 1, 1, -1, -1),
    t("T16", "Good fortune with trade-off", 1, 1, 2, 0),
    t("T17", "Legal dispute", 1, 1, -2, 0),
    t("T18", "Short-term profit vs stability", 1, 0, 2, -1),
    t("T19", "Personal embarrassment", 1, 0, -1, 1),
    t("T20", "Sacrificial town decision", -1, 2, 1, -1),
  ].map((x) => [x.id, x]),
);
