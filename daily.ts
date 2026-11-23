// Vault の今日の Daily に 1 行ずつ足す。Discord には依存しないのでテストしやすい形にしてある
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hms = (d: Date) => `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// toolkit の fill() と同じ置き換え（{{date}} {{title}} {{time}} と金曜だけ残す {{#friday}}）。書式つきの {{date:…}} は Daily では使っていないので見ない
export function fill(tpl: string, d: Date): string {
  return tpl
    .replace(/{{#friday}}\n?([\s\S]*?){{\/friday}}\n?/g, (_, inner: string) => (d.getDay() === 5 ? inner : ""))
    .replace(/{{\s*(date|title)\s*}}/gi, ymd(d))
    .replace(/{{\s*time\s*}}/gi, `${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

// 「## heading」の節の末尾に lines を足す。テンプレートのままの空の項目（「- 」「- [ ] 」）があれば最初の 1 つをそれで置き換える
export function insert(text: string, heading: string, lines: string[]): string {
  const rows = text.split("\n");
  const start = rows.findIndex((r) => r.trim() === `## ${heading}`);
  if (start < 0) return `${text.replace(/\n*$/, "")}\n\n## ${heading}\n${lines.join("\n")}\n`;
  let end = rows.findIndex((r, i) => i > start && r.startsWith("## "));
  if (end < 0) end = rows.length;
  const blank = rows.findIndex((r, i) => i > start && i < end && /^- (\[ \] ?)?$/.test(r.trimEnd() + " "));
  if (blank >= 0) {
    rows.splice(blank, 1, ...lines);
    return rows.join("\n");
  }
  let last = end - 1;
  while (last > start && rows[last].trim() === "") last--;
  rows.splice(last + 1, 0, ...lines);
  return rows.join("\n");
}

// 今日の Daily に足す。なければテンプレートから作る（Obsidian が閉じていても書けるように）
export async function append(vault: string, heading: string, lines: string[], now = new Date()) {
  const path = join(vault, "01_Daily", `${ymd(now)}.md`);
  const text = existsSync(path) ? await readFile(path, "utf8") : fill(await readFile(join(vault, "90_Templates/Daily.md"), "utf8"), now);
  await writeFile(path, insert(text, heading, lines));
}

// 添付を 99_Assets に保存して、埋め込み用のファイル名を返す
export async function saveAsset(vault: string, name: string, data: ArrayBuffer) {
  await mkdir(join(vault, "99_Assets"), { recursive: true });
  await writeFile(join(vault, "99_Assets", name), Buffer.from(data));
  return name;
}
