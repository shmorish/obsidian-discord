// claude -p に Daily に書く文章を整えてもらう
import { execFile } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// launchd の PATH には nix のものが入らないので、場所を決め打ちする
const CLAUDE = process.env.CLAUDE ?? join(homedir(), ".nix-profile/bin/claude");

const SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, date: { type: "string" }, photo: { type: "boolean" } },
        required: ["text", "date", "photo"],
      },
    },
  },
  required: ["items"],
});
const KIND = {
  jottings: "メモ・気づき・出来事",
  tasks: "やること（タスク）。1 項目 1 つの行動にする",
};
export type Kind = keyof typeof KIND;
export type Item = { text: string; date: string; photo: boolean };

const prompt = (kind: Kind, text: string, images: string[], today: string) => `Discord から Obsidian の Daily に放り込まれた${KIND[kind]}を整えて items に入れる。今日は ${today}。
- 1 つの話は 1 項目にまとめ、別の話は分ける。言葉は意味を変えずに短く自然な日本語に整える。行頭の記号は付けない
- 「調べて」のように頼まれていることがあれば WebSearch で調べ、その結果を元の文章に入れ込む（例: 「オムライスのデミグラスハンバーグを食べた。正式名調べて」→「オムデミチーズバーグディッシュを食べた」）。分からなければ元の言葉のままにする
- date はその出来事があった日（YYYY-MM-DD）。「一昨日」「先週の金曜」のように過去の日のことなら、その日付にして、文からその言い回しは消す（その日の Daily に入るので）。それ以外は今日の日付
- 頼んだ文そのもの、括弧書きの補足、出典、経緯、確認できなかったことは書かない。頼まれていないことは調べない
${images.length ? `- 写真が付いている。必要なら Read で見て参考にする。写真がどの項目の話かを photo: true で示す（写真が付いていなければ全部 false）: ${images.join(" ")}\n` : ""}メッセージ:
${text}`;

// 使えるツールは Web 検索と、付いた写真を読むことだけ。設定・MCP・プロジェクトの CLAUDE.md を読まないように空の設定と tmpdir で動かす
export async function tidy(kind: Kind, text: string, images: string[], assets: string, today: string): Promise<Item[]> {
  const tools = ["WebSearch", "WebFetch", "Read"];
  const run = promisify(execFile)(
    CLAUDE,
    ["-p", "--model", "sonnet", "--tools", tools.join(","), "--allowedTools", "WebSearch", "WebFetch", `Read(/${assets}/**)`,
      "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence",
      "--output-format", "json", "--json-schema", SCHEMA, "--", prompt(kind, text, images, today)],
    { cwd: tmpdir(), timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
  );
  run.child.stdin?.end(); // 閉じないと標準入力を 3 秒待つ
  const { stdout } = await run;
  const out = JSON.parse(stdout);
  if (out.is_error || !out.structured_output) throw new Error(`claude: ${out.result ?? stdout}`);
  return out.structured_output.items;
}
