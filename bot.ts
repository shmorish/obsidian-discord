// #jottings に送ったメッセージは今日の Daily の Jottings に、#tasks は Tasks に足す。言葉は Claude（claude -p）に整えてもらい、「調べて」とあれば調べた結果を入れ込んでもらう。
// 画像は 99_Assets に保存して埋め込む。考えている間は 👀、書けたら ✅、Claude が失敗して原文のまま書いたら ⚠️、書けなかったら ❌
import { Client, Events, GatewayIntentBits } from "discord.js";
import { execFile } from "node:child_process";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { type Item, tidy } from "./claude.ts";
import { append, hms, saveAsset, ymd } from "./daily.ts";

const { DISCORD_TOKEN, OWNER_ID, VAULT } = process.env;
if (!DISCORD_TOKEN || !OWNER_ID || !VAULT) throw new Error(".env に DISCORD_TOKEN, OWNER_ID, VAULT を書く");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.id !== OWNER_ID || !("name" in msg.channel)) return;
  const kind = msg.channel.name;
  if (kind !== "jottings" && kind !== "tasks") return;
  const seen = await msg.react("👀").catch(() => null);
  try {
    const now = new Date();
    const assets = join(VAULT, "99_Assets");
    const names: string[] = [];
    for (const [i, a] of [...msg.attachments.values()].entries()) {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(`添付を取れなかった: ${res.status}`);
      const name = `${ymd(now)}-${hms(now)}-${i}${extname(a.name).toLowerCase() || ".png"}`;
      await saveAsset(VAULT, name, await res.arrayBuffer());
      // 写真は長辺 1600px・JPEG 品質 70 に縮める（macOS の sips。拡張子を変えないので PNG は縮めるだけ、GIF は動きが消えるので触らない）
      if (/\.(jpe?g|png|heic)$/.test(name)) await promisify(execFile)("/usr/bin/sips", ["-Z", "1600", "-s", "formatOptions", "70", join(assets, name)]);
      names.push(name);
    }
    const text = msg.content.trim();
    let items: Item[] = [];
    let ok = true;
    if (text) {
      try {
        items = await tidy(kind, text, names.map((n) => join(assets, n)), assets, ymd(now));
      } catch (e) {
        // メモが消えないように、原文を 1 行ずつ書く
        console.error(e);
        ok = false;
        items = text.split("\n").map((l) => l.trim()).filter(Boolean).map((t) => ({ text: t, date: ymd(now), photo: false }));
      }
    }
    // 画像は Claude が photo を付けた項目に付ける（なければ最後の項目、本文がなければ画像だけの項目）
    if (names.length) {
      if (!items.length) items.push({ text: "", date: ymd(now), photo: true });
      const target = items.find((i) => i.photo) ?? items[items.length - 1];
      target.text = [target.text, ...names.map((n) => `![[${n}]]`)].filter(Boolean).join(" ");
    }
    if (!items.length) return;
    // その日の Daily に書く。変な日付や未来の日付なら今日にする
    const today = ymd(now);
    for (const i of items) if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date) || i.date > today) i.date = today;
    for (const date of new Set(items.map((i) => i.date))) {
      const lines = items.filter((i) => i.date === date).map((i) => (kind === "tasks" ? `- [ ] ${i.text}` : `- ${i.text}`));
      const [y, m, d] = date.split("-").map(Number);
      await append(VAULT, kind === "tasks" ? "Tasks" : "Jottings", lines, new Date(y, m - 1, d));
    }
    await msg.react(ok ? "✅" : "⚠️");
  } catch (e) {
    console.error(e);
    await msg.react("❌").catch(() => {});
  } finally {
    await seen?.users.remove(client.user!.id).catch(() => {});
  }
});

client.once(Events.ClientReady, (c) => console.log(`ready: ${c.user.tag}`));
await client.login(DISCORD_TOKEN);
