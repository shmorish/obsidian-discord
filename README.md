# obsidian-discord

Discord に送ったメッセージを、Obsidian Vault の今日の Daily（`01_Daily/YYYY-MM-DD.md`）に足す bot。Mac で常駐させる。

- `#jottings` か `#tasks` に送ると、Claude（`claude -p` の Haiku、ツールなし）がやることは `## Tasks` に `- [ ] …`、それ以外は `## Jottings` に `- …` と振り分け、言葉を整える
- 画像を付けると `99_Assets/` に保存して Jottings に `![[…]]` で埋め込む
- 書けたら ✅、Claude が失敗して原文のまま Jottings に書いたら ⚠️、書けなかったら ❌ が付く
- 今日の Daily がなければ `90_Templates/Daily.md` から作る（Obsidian が閉じていても書ける）。push は Vault の autogit に任せる
- `OWNER_ID` の人のメッセージだけ扱う

## セットアップ

1. https://discord.com/developers/applications で New Application → Bot で Reset Token してトークンを控える。同じ画面の Privileged Gateway Intents で **Message Content Intent** をオンにする
2. OAuth2 → URL Generator で scope `bot`、権限 `View Channels` `Read Message History` `Add Reactions` を選び、出た URL で自分用のサーバーに招待する
3. そのサーバーに `jottings` と `tasks` チャンネルを作る
4. `cp .env.example .env` してトークンと自分のユーザー ID（Discord の開発者モードでユーザーを右クリック → ID をコピー）を書く
5. `npm install && npm start`

テストは `npm test`。Node 24 以降なら TypeScript をそのまま動かせるのでビルドはない。
