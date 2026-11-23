// #jottings か #tasks に送ったメッセージを Claude（claude -p）に振り分けて整えてもらい、今日の Daily の Jottings / Tasks に足す。
// 画像は 99_Assets に保存して Jottings に埋め込む。書けたら ✅、Claude が失敗して原文のまま Jottings に書いたら ⚠️、書けなかったら ❌
import { Client, Events, GatewayIntentBits } from "discord.js";
import { execFile } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { append, hms, saveAsset, ymd } from "./daily.ts";

const { DISCORD_TOKEN, OWNER_ID, VAULT } = process.env;
if (!DISCORD_TOKEN || !OWNER_ID || !VAULT) throw new Error(".env に DISCORD_TOKEN, OWNER_ID, VAULT を書く");
// launchd の PATH には nix のものが入らないので、場所を決め打ちする
const CLAUDE = process.env.CLAUDE ?? join(homedir(), ".nix-profile/bin/claude");

type Sorted = { jottings: string[]; tasks: string[] };
const SCHEMA = JSON.stringify({
  type: "object",
  properties: { jottings: { type: "array", items: { type: "string" } }, tasks: { type: "array", items: { type: "string" } } },
  required: ["jottings", "tasks"],
});
const PROMPT = `Discord から Obsidian の Daily に放り込まれたメモを振り分けて整える。
やること（これから自分がする行動）は tasks、それ以外のメモ・気づき・出来事は jottings に入れる。
1 つの話は 1 項目にまとめ、別の話は分ける。言葉は意味を変えずに短く自然な日本語に整える。行頭の記号は付けない。
メッセージ:
`;

// ツールは使わせず、振り分けと整形だけさせる。設定・MCP・プロジェクトの CLAUDE.md を読まないように空の設定と tmpdir で動かす
async function sort(text: string): Promise<Sorted> {
  const run = promisify(execFile)(
    CLAUDE,
    ["-p", "--model", "haiku", "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence",
      "--output-format", "json", "--json-schema", SCHEMA, PROMPT + text],
    { cwd: tmpdir(), timeout: 60_000 },
  );
  run.child.stdin?.end(); // 閉じないと標準入力を 3 秒待つ
  const { stdout } = await run;
  const out = JSON.parse(stdout);
  if (out.is_error || !out.structured_output) throw new Error(`claude: ${out.result ?? stdout}`);
  return out.structured_output;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.id !== OWNER_ID || !("name" in msg.channel)) return;
  if (msg.channel.name !== "jottings" && msg.channel.name !== "tasks") return;
  try {
    const now = new Date();
    const text = msg.content.trim();
    let sorted: Sorted = { jottings: [], tasks: [] };
    let ok = true;
    if (text) {
      try {
        sorted = await sort(text);
      } catch (e) {
        // メモが消えないように、原文を 1 行ずつ Jottings に書く
        console.error(e);
        ok = false;
        sorted = { jottings: text.split("\n").map((l) => l.trim()).filter(Boolean), tasks: [] };
      }
    }
    const embeds: string[] = [];
    for (const [i, a] of [...msg.attachments.values()].entries()) {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(`添付を取れなかった: ${res.status}`);
      const name = `${ymd(now)}-${hms(now)}-${i}${extname(a.name).toLowerCase() || ".png"}`;
      embeds.push(`![[${await saveAsset(VAULT, name, await res.arrayBuffer())}]]`);
    }
    // 画像は最後の Jottings の行に付ける（Jottings がなければ画像だけの行にする）
    const jottings = [...sorted.jottings];
    if (embeds.length) jottings.push([jottings.pop(), ...embeds].filter(Boolean).join(" "));
    if (jottings.length) await append(VAULT, "Jottings", jottings.map((l) => `- ${l}`), now);
    if (sorted.tasks.length) await append(VAULT, "Tasks", sorted.tasks.map((t) => `- [ ] ${t}`), now);
    await msg.react(ok ? "✅" : "⚠️");
  } catch (e) {
    console.error(e);
    await msg.react("❌").catch(() => {});
  }
});

client.once(Events.ClientReady, (c) => console.log(`ready: ${c.user.tag}`));
await client.login(DISCORD_TOKEN);
