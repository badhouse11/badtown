// A zero-dependency stand-in for `wrangler dev`, for machines that can't install Wrangler.
// It runs the SAME Worker routing and Room Durable Object code, with in-memory storage,
// timer-based alarms and a minimal WebSocket server. Use `npm run dev` (Wrangler) for the
// real Cloudflare runtime; use this for quick local play and automated browser tests.
//
//   node scripts/local-server.ts [port]

import { createServer, type IncomingMessage } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type { Duplex } from "node:stream";
import { Room } from "../src/room.ts";

const PORT = Number(process.argv[2] ?? 8787);
const PUBLIC = join(import.meta.dirname, "..", "public");
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

// ---------------------------------------------------------------------------------------
// Minimal WebSocket (RFC 6455) for text messages.

class LocalSocket {
  att: unknown = null;
  open = true;
  buf = Buffer.alloc(0);
  sock: Duplex;
  onText: (t: string) => void;
  onClose: () => void;
  constructor(sock: Duplex, onText: (t: string) => void, onClose: () => void) {
    this.sock = sock;
    this.onText = onText;
    this.onClose = onClose;
    sock.on("data", (d: Buffer) => this.feed(d));
    sock.on("close", () => this.gone());
    sock.on("error", () => this.gone());
  }
  gone() {
    if (!this.open) return;
    this.open = false;
    this.onClose();
  }
  feed(d: Buffer) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const op = this.buf[0] & 0x0f;
      let len = this.buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const masked = (this.buf[1] & 0x80) !== 0;
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      const mask = masked ? this.buf.subarray(off, off + 4) : null;
      const payload = Buffer.from(this.buf.subarray(off + (masked ? 4 : 0), need));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      this.buf = this.buf.subarray(need);
      if (op === 0x1) this.onText(payload.toString("utf8"));
      else if (op === 0x8) { this.close(1000); return; }
      else if (op === 0x9) this.frame(0xa, payload);
    }
  }
  frame(op: number, payload: Buffer) {
    if (!this.open) return;
    const len = payload.length;
    const head = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h; })();
    this.sock.write(Buffer.concat([head, payload]));
  }
  send(text: string) { this.frame(0x1, Buffer.from(text, "utf8")); }
  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(2); b.writeUInt16BE(code);
    this.frame(0x8, b);
    this.sock.end();
    this.gone();
  }
  serializeAttachment(v: unknown) { this.att = structuredClone(v); }
  deserializeAttachment() { return structuredClone(this.att); }
}

// ---------------------------------------------------------------------------------------
// Fake Durable Object runtime: one Room per code, in-memory storage, setTimeout alarms.

interface Hosted { room: Room; sockets: LocalSocket[]; timer: NodeJS.Timeout | null; queue: Promise<unknown> }
const rooms = new Map<string, Hosted>();

function host(code: string): Hosted {
  let h = rooms.get(code);
  if (h) return h;
  const store = new Map<string, unknown>();
  const hosted: Hosted = { room: null as unknown as Room, sockets: [], timer: null, queue: Promise.resolve() };
  const ctx = {
    storage: {
      get: async (k: string) => structuredClone(store.get(k)),
      put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
      setAlarm: async (t: number) => {
        if (hosted.timer) clearTimeout(hosted.timer);
        hosted.timer = setTimeout(() => serial(hosted, () => hosted.room.alarm()), Math.max(0, t - Date.now()));
      },
      deleteAlarm: async () => {
        if (hosted.timer) clearTimeout(hosted.timer);
        hosted.timer = null;
      },
    },
    acceptWebSocket: (ws: LocalSocket) => void hosted.sockets.push(ws),
    getWebSockets: () => hosted.sockets.filter((s) => s.open),
  };
  hosted.room = new Room(ctx as any, {});
  rooms.set(code, hosted);
  return hosted;
}

/** Durable Objects run one event at a time; mimic that so tests see the same ordering. */
function serial<T>(h: Hosted, fn: () => Promise<T>): Promise<T> {
  const run = h.queue.then(fn, fn);
  h.queue = run.catch(() => {});
  return run;
}

async function body(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const send = async (r: Response) => {
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    };
    if (url.pathname === "/api/rooms" && req.method === "POST") {
      for (let i = 0; i < 6; i++) {
        const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
        const h = host(code);
        const r = await serial(h, () => h.room.fetch(new Request("https://room/init", { method: "POST", body: JSON.stringify({ code }) })));
        if (r.status === 201) return send(new Response(JSON.stringify({ code }), { status: 201, headers: { "content-type": "application/json" } }));
      }
      return send(new Response(JSON.stringify({ error: "no code" }), { status: 503 }));
    }
    const m = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/(join|info)$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!rooms.has(code)) return send(new Response(JSON.stringify({ error: "No room with that code." }), { status: 404, headers: { "content-type": "application/json" } }));
      const h = host(code);
      const text = req.method === "POST" ? await body(req) : undefined;
      return send(await serial(h, () => h.room.fetch(new Request(`https://room/${m[2]}`, { method: req.method, body: text, headers: { "content-type": "application/json" } }))));
    }
    // Static files
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path === "/" || path === "") path = "/index.html";
    const file = join(PUBLIC, path);
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
    const data = await readFile(file).catch(() => null);
    if (!data) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end("error");
  }
});

server.on("upgrade", (req, sock) => {
  const m = (req.url ?? "").match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/ws$/);
  const code = m?.[1].toUpperCase();
  if (!code || !rooms.has(code) || req.headers.upgrade?.toLowerCase() !== "websocket") { sock.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const h = host(code);
  const ws: LocalSocket = new LocalSocket(
    sock,
    (t) => void serial(h, () => h.room.webSocketMessage(ws as any, t)).catch((e) => console.error(e)),
    () => void serial(h, () => h.room.webSocketClose(ws as any)).catch((e) => console.error(e)),
  );
  h.sockets.push(ws);
  ws.serializeAttachment({ pid: null, fails: 0 });
});

server.listen(PORT, () => console.log(`Good Neighbours local server: http://localhost:${PORT}`));
