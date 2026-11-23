// #jottings と #tasks に送ったメッセージを、今日の Daily の Jottings / Tasks に 1 行ずつ足す。
// 画像は 99_Assets に保存して Jottings に埋め込む。書けたら ✅、失敗したら ❌ を付ける
import { Client, Events, GatewayIntentBits } from "discord.js";
import { extname } from "node:path";
import { append, hms, saveAsset, ymd } from "./daily.ts";

const { DISCORD_TOKEN, OWNER_ID, VAULT } = process.env;
if (!DISCORD_TOKEN || !OWNER_ID || !VAULT) throw new Error(".env に DISCORD_TOKEN, OWNER_ID, VAULT を書く");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.id !== OWNER_ID || !("name" in msg.channel)) return;
  const channel = msg.channel.name;
  if (channel !== "jottings" && channel !== "tasks") return;
  try {
    const now = new Date();
    const texts = msg.content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (channel === "tasks") {
      if (!texts.length) return;
      await append(VAULT, "Tasks", texts.map((t) => `- [ ] ${t}`), now);
    } else {
      const embeds: string[] = [];
      for (const [i, a] of [...msg.attachments.values()].entries()) {
        const res = await fetch(a.url);
        if (!res.ok) throw new Error(`添付を取れなかった: ${res.status}`);
        const name = `${ymd(now)}-${hms(now)}-${i}${extname(a.name).toLowerCase() || ".png"}`;
        embeds.push(`![[${await saveAsset(VAULT, name, await res.arrayBuffer())}]]`);
      }
      // 本文と画像は 1 行にまとめる（本文が複数行なら最後の行に画像を付ける）
      const lines = texts.length ? texts : [""];
      lines[lines.length - 1] = [lines.at(-1), ...embeds].filter(Boolean).join(" ");
      if (!lines[0]) return;
      await append(VAULT, "Jottings", lines.map((l) => `- ${l}`), now);
    }
    await msg.react("✅");
  } catch (e) {
    console.error(e);
    await msg.react("❌").catch(() => {});
  }
});

client.once(Events.ClientReady, (c) => console.log(`ready: ${c.user.tag}`));
await client.login(DISCORD_TOKEN);
