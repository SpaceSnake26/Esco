#!/usr/bin/env node
// Checks Pablito's Kimi account (free balance endpoint, no paid call) and tells the
// owner through the Hermes Telegram bot when it needs attention, then once when fixed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const parse = (p) => Object.fromEntries(readFileSync(p, "utf8").split("\n")
  .filter((l) => /^[A-Z_0-9]+=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const app = parse("/opt/esco/.env");
const tg = parse("/root/.hermes/.env");
const STATE = "/opt/esco/server/data/ai-watch.state";
const LOW_USD = 3;
const FIX = "To refresh him: top up at https://platform.kimi.ai/console/account , or create a new key there and paste it to Claude/Hermes to replace AI_API_KEY and AI_FALLBACK_API_KEY in /opt/esco/.env, then run: systemctl restart esco-api";

async function check() {
  try {
    const res = await fetch(`${app.AI_BASE_URL}/users/me/balance`, {
      headers: { authorization: `Bearer ${app.AI_API_KEY}` }, signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) return { state: "bad-key", text: "the API key was rejected (401)" };
    if (!res.ok) return { state: "unknown", text: `Kimi answered HTTP ${res.status}` };
    const bal = (await res.json()).data?.available_balance ?? 0;
    if (bal <= 0) return { state: "empty", text: "the Kimi balance is $0" };
    if (bal < LOW_USD) return { state: "low", text: `the Kimi balance is low: $${bal.toFixed(2)}` };
    return { state: "ok", text: `balance $${bal.toFixed(2)}` };
  } catch (e) {
    return { state: "unknown", text: `Kimi unreachable (${e.message})` };
  }
}

async function notify(text) {
  const res = await fetch(`https://api.telegram.org/bot${tg.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: tg.TELEGRAM_HOME_CHANNEL, text,
      ...(tg.TELEGRAM_HOME_CHANNEL_THREAD_ID ? { message_thread_id: Number(tg.TELEGRAM_HOME_CHANNEL_THREAD_ID) } : {}),
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

const now = await check();
const prev = existsSync(STATE) ? readFileSync(STATE, "utf8").trim() : "new";
console.log(`esco-ai-watch: ${now.state} — ${now.text}`);
// A blip must not page anyone: "unknown" only alerts on the second check in a row.
const confirmed = now.state !== "unknown" || prev === "unknown-1" || prev === "unknown";
const stored = now.state === "unknown" && !confirmed ? "unknown-1" : now.state;
if (process.argv.includes("--test")) {
  await notify(`🦜 Esco: Pablito monitoring is on. Now: ${now.text}. I message you here if he needs a refresh.`);
} else if (confirmed && now.state !== prev) {
  if (now.state === "ok") {
    if (prev !== "new" && prev !== "unknown-1") await notify(`🦜 Esco: Pablito is healthy again (${now.text}).`);
  } else {
    await notify(`🦜 Esco: Pablito needs you: ${now.text}. ${FIX}`);
  }
}
writeFileSync(STATE, stored);
