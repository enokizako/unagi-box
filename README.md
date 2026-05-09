# Unagi Box

Cosense をデータベース代わりに使う、`unagi-tasks` 風のタスク管理 + ポモドーロ用ユーザースクリプトです。`Focus / Inbox / Archive` は同一ページ内のセクションとして扱います。

## 謝辞

このプロジェクトは [h-kono-it/unagi-tasks](https://github.com/h-kono-it/unagi-tasks/) を参考にしています。タスク管理とポモドーロを組み合わせるコンセプト、優先度・エネルギー・作業量を使ったタスク選択の発想に感謝します。

## 方針

- 実行場所は Cosense の UserScript
- 実装は `TypeScript`
- `esbuild` で `dist/script.js` に bundle
- データ保存先は Cosense ページ本文

## 想定データ形式

1 行 1 タスクで持ちます。

```text
Focus
 Energy: Mid
 👑 タスク名 | score:32.0 | p:3 | e:2 | v:1
Inbox
 未完了のタスク | p:1 | e:1 | v:4 | c:2026-04-27
 👣取組中のタスク | p:1 | e:1 | v:4 | c:2026-04-27
Archive
 ✅完了したタスク | p:1 | e:1 | v:4 | c:2026-04-27
```

- `p`: priority
- `e`: energy
- `v`: volume
- `c`: 作成日
- `d`: 期限
- 状態記号なし: 未完了
- `👣`: 取組中
- `✅`: 完了

## 開発

```bash
npm install
npm run check
npm run build
```

生成されるファイル:

- `dist/script.js`

Cosense の自分のページに `code:script.js` ブロックを作り、生成された `dist/script.js` の内容を貼り付けてください。

```text
code:script.js
  // dist/script.js の内容をここに貼り付ける
```

## 現状できること

- 右側 `Page Menu` に `Unagi Box` ボタンを追加
- `Create board` は `Add Task` を開いた中から実行
- `Add Task` は折りたたみを開いた時だけ表示
- `Due` はテキスト直接入力とカレンダー選択の両方に対応
- `Inbox` と `Archive` 配下のタスクをインデント付きで保持
- `Focus` セクションにトップタスク要約を同期
- `Low / Mid / High` は Cosense 本文にも同期
- 現在の energy (`Low / Mid / High`) に応じて open task を score 順で評価
- `👑` は次に着手する候補だけを表示
- `doing` にした task は `Inbox` 内で `👣` 表示に更新
- `Pick Any Task` は折りたたみを開いた時だけ表示
- `Timer Settings` は折りたたみを開いた時だけ表示
- `Work / Break` 分数を設定してからポモドーロを開始
- `Start pomodoro` で `👑 Next` が自動で `doing` に入る
- 最上部に大きいタイマー表示
- `Work / Break` は文字ではなく色とメッセージで判別
- タイマー操作はアイコン表示
- `Pause` で残り時間を保持、一方 `Stop` は作業タイマーへリセット
- タイマー終了時にアラーム音と画面フラッシュで通知
- デフォルトは `25` 分作業後に `5` 分休憩へ自動遷移
- `doing` 状態のタスクを `Archive` セクションへ移動しつつ `done` に更新

## スコア

現状の簡易スコアは次です。

```text
score = priority * (10 + urgencyBonus) + ageDays - abs(userEnergy - taskEnergy) * 5 - (volume - 1) * 2
```

- `urgencyBonus`
- 期限超過: `60 + overdueDays * 15`
- 当日: `60`
- 7 日以内: `(7 - daysLeft) / 6 * 30`
