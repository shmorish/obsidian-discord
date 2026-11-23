# obsidian-discord

Discord に送ったメッセージを、Obsidian Vault の今日の Daily（`01_Daily/YYYY-MM-DD.md`）に足す bot。Mac で常駐させる。

- `#jottings` に送ると `## Jottings` に `- …`、`#tasks` に送ると `## Tasks` に `- [ ] …` を足す。言葉は Claude（`claude -p` の Sonnet）が整える。「調べて」と書けば Web で調べて結果を文章に入れ込む。写真も見る（使えるのは Web 検索と 99_Assets の読み取りだけ）
- 画像を付けると `99_Assets/` に保存して Jottings に `![[…]]` で埋め込む
- 考えている間は 👀、書けたら ✅、Claude が失敗して原文のまま書いたら ⚠️、書けなかったら ❌ が付く
- 今日の Daily がなければ `90_Templates/Daily.md` から作る（Obsidian が閉じていても書ける）。push は Vault の autogit に任せる
- `OWNER_ID` の人のメッセージだけ扱う

## セットアップ

1. https://discord.com/developers/applications で New Application → Bot で Reset Token してトークンを控える。同じ画面の Privileged Gateway Intents で **Message Content Intent** をオンにする
2. OAuth2 → URL Generator で scope `bot`、権限 `View Channels` `Read Message History` `Add Reactions` を選び、出た URL で自分用のサーバーに招待する
3. そのサーバーに `jottings` と `tasks` チャンネルを作る
4. `cp .env.example .env` してトークンと自分のユーザー ID（Discord の開発者モードでユーザーを右クリック → ID をコピー）を書く
5. `npm install && npm start`

テストは `npm test`。Node 24 以降なら TypeScript をそのまま動かせるのでビルドはない。
