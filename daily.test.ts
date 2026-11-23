import assert from "node:assert/strict";
import { test } from "node:test";
import { fill, insert } from "./daily.ts";

const tpl = "## Jottings\n- \n\n## Tasks\n- [ ] \n\n## Habits\n{{#friday}}\n## Weekly Review\n{{/friday}}";

test("テンプレートの空の項目を置き換え、2 回目からは末尾に足す", () => {
  let t = insert(tpl, "Jottings", ["- a"]);
  t = insert(t, "Jottings", ["- b", "- c"]);
  t = insert(t, "Tasks", ["- [ ] x"]);
  assert.equal(t.split("## Habits")[0], "## Jottings\n- a\n- b\n- c\n\n## Tasks\n- [ ] x\n\n");
});

test("見出しがなければ末尾に作る", () => {
  assert.equal(insert("# x\n", "Tasks", ["- [ ] y"]), "# x\n\n## Tasks\n- [ ] y\n");
});

test("金曜だけ Weekly Review を残す", () => {
  assert.match(fill(tpl, new Date(2026, 10, 27)), /Weekly Review/);
  assert.doesNotMatch(fill(tpl, new Date(2026, 10, 23)), /Weekly Review/);
});
