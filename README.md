# obsidian-discord

Discord に送ったメッセージを、Obsidian の Daily ノートに書き足す bot です。スマホから思いついたことや写真を放り込む用途を想定しています。Vault のファイルを直接書き換えるので、Obsidian が起動していなくても動きます。

## できること

- `#jottings` に送ると `## Jottings` に `- …`、`#tasks` に送ると `## Tasks` に `- [ ] …` を足す
- 「金曜までに経費精算する」のように期限があるタスクは、[Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) プラグインの書式で `- [ ] 経費精算する 📅 2026-11-27` と書く
- 文章は Claude Code（`claude -p`）が短く自然な日本語に整える
- 「正式名調べて」のように頼むと、Claude が Web で調べて結果を文章に入れ込む（頼んだ文や出典は残さない）
- 「一昨日」「先週の金曜」のような過去の日の話は、その日の Daily に書く。Daily がまだなければテンプレートから作る
- 画像を付けると `99_Assets/` に保存し（長辺 1600px の JPEG 品質 70 に縮める）、Claude が選んだ項目に `![[…]]` で埋め込む
- 処理中は 👀、書けたら ✅、Claude が失敗して原文のまま書いたら ⚠️、書けなかったら ❌ のリアクションが付く
- `OWNER_ID` に書いたユーザーのメッセージだけ扱う

Claude に使わせるツールは Web 検索と `99_Assets/` の読み取りだけです。Claude Code の設定と MCP は読ませず、プロジェクトの CLAUDE.md を拾わないように一時ディレクトリで動かします。

## 前提

- macOS（画像の縮小に `sips` を使う）
- Node.js 24 以降（TypeScript をそのまま実行するのでビルドはない）
- [Claude Code](https://code.claude.com/) をインストールしてログイン済み。サブスクリプションの範囲で動く
- Vault が次の形になっていること（フォルダ名は `daily.ts` で決め打ち）

```
<Vault>/
├── 01_Daily/YYYY-MM-DD.md     # Daily。## Jottings と ## Tasks の見出しがある
├── 90_Templates/Daily.md      # Daily がないときに使うテンプレート
└── 99_Assets/                 # 画像の保存先
```

テンプレートでは `{{date}}` `{{title}}` `{{time}}` を埋め、`{{#friday}}…{{/friday}}` の中身は金曜にだけ残します。見出しがないノートには、末尾に見出しを作って書きます。テンプレートのままの空の項目（`- ` や `- [ ] `）があれば、最初の 1 つを置き換えます。

## セットアップ

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリを作る。Bot 画面の Reset Token でトークンを控え、Privileged Gateway Intents の **Message Content Intent** をオンにする
2. OAuth2 → URL Generator で scope に `bot`、権限に `View Channels` `Read Message History` `Add Reactions` を選び、出た URL で自分用のサーバーに招待する
3. そのサーバーに `jottings` と `tasks` のテキストチャンネルを作る
4. `.env` を作る

   ```sh
   cp .env.example .env
   ```

   | 変数 | 中身 |
   |---|---|
   | `DISCORD_TOKEN` | 1 で控えたトークン |
   | `OWNER_ID` | 自分の Discord ユーザー ID（開発者モードで自分を右クリック →「ID をコピー」） |
   | `VAULT` | Vault の絶対パス（`~` は展開されない） |
   | `NODE_EXTRA_CA_CERTS` | `claude` が証明書の検証に使う CA バンドル。普通の環境なら消してよい |
   | `CLAUDE` | 省略可。`claude` の場所（既定は `~/.nix-profile/bin/claude`） |

5. 起動する

   ```sh
   npm install
   npm start
   ```

## 常駐させる

launchd に登録すると、ログイン時に起動し、落ちても起こし直します。launchd は PATH を引き継がないので、`node` は絶対パスで指定し、`claude` の場所が既定と違うなら `.env` の `CLAUDE` に書きます。

```xml
<!-- ~/Library/LaunchAgents/obsidian-discord.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>obsidian-discord</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/node</string>
    <string>--env-file=.env</string>
    <string>bot.ts</string>
  </array>
  <key>WorkingDirectory</key><string>/path/to/obsidian-discord</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>/tmp/obsidian-discord.log</string>
  <key>StandardErrorPath</key><string>/tmp/obsidian-discord.log</string>
</dict>
</plist>
```

```sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/obsidian-discord.plist
```

## 開発

```sh
npm test
```

| ファイル | 役割 |
|---|---|
| `bot.ts` | Discord から受け取り、画像を保存して Daily に書く |
| `claude.ts` | `claude -p` を呼んで文章を整え、日付と写真の付け先を決める |
| `daily.ts` | Daily の見出しの下に行を足す。テンプレートから Daily を作る |
