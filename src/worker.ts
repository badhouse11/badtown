// Entry point. Serves the web app (from /public) and routes /api/* to the right room.

export { Room } from "./room.ts";

interface Env {
  ROOMS: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(req: Request): Promise<Response> };
  };
  ASSETS: { fetch(req: Request): Promise<Response> };
}

// No 0/O, 1/I/L, to avoid misreading codes aloud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/rooms" && req.method === "POST") {
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = makeCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch(
          new Request("https://room/init", { method: "POST", body: JSON.stringify({ code }), headers: { "content-type": "application/json" } }),
        );
        if (res.status === 201) return json({ code }, 201);
        if (res.status !== 409) return json({ error: "Couldn't create a room." }, 500);
      }
      return json({ error: "Couldn't find a free room code. Try again." }, 503);
    }

    const m = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/(join|ws|info)$/);
    if (m) {
      const code = m[1].toUpperCase();
      if ([...code].some((ch) => !ALPHABET.includes(ch))) return json({ error: "No room with that code." }, 404);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request(`https://room/${m[2]}`, req));
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    return env.ASSETS.fetch(req);
  },
};
