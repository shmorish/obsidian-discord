// #jottings に送ったメッセージは今日の Daily の Jottings に、#tasks は Tasks に足す。言葉は Claude（claude -p）に整えてもらい、「調べて」とあれば調べた結果を入れ込んでもらう。
// 画像は 99_Assets に保存して埋め込む。考えている間は 👀、書けたら ✅、Claude が失敗して原文のまま書いたら ⚠️、書けなかったら ❌
import { Client, Events, GatewayIntentBits } from "discord.js";
import { execFile } from "node:child_process";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { tidy } from "./claude.ts";
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
    let items: string[] = [];
    let ok = true;
    if (text) {
      try {
        items = await tidy(kind, text, names.map((n) => join(assets, n)), assets);
      } catch (e) {
        // メモが消えないように、原文を 1 行ずつ書く
        console.error(e);
        ok = false;
        items = text.split("\n").map((l) => l.trim()).filter(Boolean);
      }
    }
    // 画像は最後の項目に付ける（本文がなければ画像だけの項目にする）
    if (names.length) items.push([items.pop(), ...names.map((n) => `![[${n}]]`)].filter(Boolean).join(" "));
    if (!items.length) return;
    if (kind === "tasks") await append(VAULT, "Tasks", items.map((t) => `- [ ] ${t}`), now);
    else await append(VAULT, "Jottings", items.map((l) => `- ${l}`), now);
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
