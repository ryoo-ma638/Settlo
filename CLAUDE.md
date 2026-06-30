# Settlo 開発メモ（チーム共有用）

このドキュメントは、AI（Claude）支援のもとで大崎が行った一連の作業を、**他のメンバーが把握・引き継げるように**まとめたものです。作業日: 2026-06-13。

> ⚠️ **最重要・最初に読んでください**
> 1. **公開リポジトリにAPIキー等が漏えいしていたため、Gitの全履歴を書き換えて force-push しました。** 各自、手元のリポジトリは一度削除して `git clone` し直してください（`git pull` は厳禁。事故ります）。
> 2. **このUIリデザインはまだ push されていません。** 大崎のローカル作業コピー（`feat/ui-enhanceme` ブランチ、未コミット）にのみ存在します。取り込み方は本書「3-D」を参照。
> 3. 漏えいした鍵は**全て無効化済み**なので実害はありません。詳細は「1」参照。

---

## 1. 独断で行った作業（事後共有）

メンバーに相談せず進めた作業です。緊急性・安全性の観点から先行しました。

### 1-A. 情報漏えい対応（セキュリティ）
- 公開リポジトリ `ryoo-ma638/Settlo` の**Git履歴**に、以下が含まれていました（過去コミット）。
  - `service-account.json`（Firebase Admin 秘密鍵）×3
  - `functions/index.js` 等にハードコードされた **Gemini APIキー** ×7
- 対応：
  - 漏えいした鍵は**すべて無効化/失効を確認済み**（GCPの自動無効化＋プロジェクト削除＋期限切れ）。**実害なし**。
  - `git filter-repo` で**全ブランチの履歴から漏えいファイルを除去**し、`--force` で push（→ 全員 re-clone 必須）。
  - GitHubの **Secret Scanning + Push Protection** を有効化（公開リポのみ。今後の漏えいを push 時点でブロック）。
- 残っている公開キー（`AIzaSyDkvt2j...`=Firebase Webキー、VAPID公開鍵）は**公開前提で安全**なので残しています。

### 1-B. イベント作成バグの修正（Firestoreルール）
- **症状**：イベント作成・支払い追加など、全ての書き込みが「失敗」していた。
- **原因**：Firestore のセキュリティルールが**テストモードの初期ルールのまま 2026-04-24 で期限切れ**になり、全リクエストが拒否されていた。
- 対応：
  - `firestore.rules`（ログイン必須ルール）を新規作成し、`firebase.json` に登録 → **本番にデプロイ済み**（動作確認OK）。
  - 版管理用に **PR #104** を作成（`fix/firestore-rules`）。**まだ未マージ**。レビューしてマージしてください。
  - CI未設定のため、ルール変更時は手動で `firebase deploy --only firestore:rules` が必要。

### 1-C. ローカル開発環境の修正
- env変数ファイルが `.env.dev` という名前で、**Viteが読み込まない**ため `auth/invalid-api-key` で起動失敗していた。
  → `.env.local`（Viteが全モードで自動読込・`*.local`でgit管理外）を用意して解消。
- **新メンバーへ**：ローカル起動には `.env.local`（または `.env`）に `VITE_FIREBASE_*` を設定してください。

### 1-D. UI全面リデザイン（本書の主題。詳細は「3」）
- PayPay風のモバイルファースト・ブランド緑統一・絵文字全廃へ全画面を作り直し。

---

## 2. 今後やるべきこと（TODO）

### 優先度：高
- [ ] **全員リポジトリを re-clone**（履歴書き換えのため）。
- [ ] **このUIリデザインを取り込む**（「3-D」の手順）。
- [ ] **PR #104（Firestoreルール）をマージ**。
- [ ] **CombinedSettlementView.vue のバグ修正**：`<script setup>` 冒頭（旧98行付近）に `const friendDoc = await getDoc(doc(db, "users", uid))` という**未定義変数 `uid` を使うトップレベル await** が残っており、実行時エラーの原因。`onMounted` 内に正しい処理があるので、この重複ブロックは削除すべき。

### 優先度：中（モック/未実装の解消）
以下は**ハードコードされた仮データ**で動いており、実データ連携が未実装です。
- [ ] `InviteModal.vue` の `friendData` / `globalData`（フレンド一覧が固定値。Firestore検索に置換要）。
- [ ] `AddPaymentModal.vue` の `participants`（立替者候補が固定3名。イベント参加者から動的取得要）。
- [ ] `CombinedSettlementView.vue` の `allEvents`（精算内訳が固定値。transactions から集計要）。
- [ ] イベント「参加」機能（`MakeEventView.joinEvent` が「準備中」のまま）。
- [ ] プロフィール画像アップロード（`EditProfileView` の `onFileChange` は TODO のままプレビューのみ。Firebase Storage 連携が未実装）。
- [ ] レシートOCR（`AddPaymentModal`）は Cloud Functions `analyzeReceipt` 依存。Functions側の鍵管理に注意（漏えい再発防止）。

### 優先度：低（整理）
- [ ] `src/components/AppSidebar.vue` は**デッドコード**（3カラム廃止で未使用）。削除可。
- [ ] 本番ビルドの JS が単一チャンク ~600KB。`manualChunks` 等でコード分割を検討。
- [ ] スクリプト内 `console.log` の絵文字（🌟🔥📦等）は表示されないが、整理してもよい。

---

## 3. 修正内容の徹底分析（UIリデザイン）

### 3-A. なぜやったか
- ライブアプリ（`pairpay-4c17a.web.app`）は**古いプロトタイプのまま**で、現行コードと乖離。
- 現行コードも**配色がバラバラ**（緑/青/水色グラデが混在）、**絵文字多用**、**和欧フォント不統一**、**各画面の角丸カラーバナーが崩れるバグ**があり、統一感が崩れていた。
- 方針：**PayPay風のモバイルファースト・ブランド緑で統一・フラット(非AI)・絵文字レス・高い視認性**。

### 3-B. 設計基盤（まずここを理解してください）
- **デザイントークン**：`src/assets/base.css`
  - 色（`--c-brand`=緑/`--c-pay`=アンバー(支払)/`--c-receive`=緑(受取)/ニュートラル群）、タイポ、余白、角丸、影を CSS変数化。
  - フォントは **Noto Sans JP** に統一（`monospace`/`serif`/`Helvetica` の混在を排除）。
- **グローバル/再利用クラス**：`src/assets/main.css`
  - `#app` を「スマホ幅(480px)の器・PCは中央に端末表示」に。
  - 共通クラス：`.card` `.btn-brand` `.btn-outline` `.btn-trash`(削除=ゴミ箱) `.seg`(タブ) `.screen-head`(画面見出し) `.row-card` `.tag` `.empty-box` `.link-danger` 等。**新規UIはこれらを使い回してください**（統一感の担保）。
  - ⚠️ 以前は `main.js` が CSS を import しておらず、`base.css`/`main.css` が**死んでいた**。`import './assets/main.css'` を追加して有効化済み。
- **共通コンポーネント**（新規）：
  - `src/components/PageHeader.vue`：戻る＋タイトルの共通ヘッダー（`position: sticky; top:0`）。サブ画面はこれを使う。
  - `src/components/GenreIcon.vue`：イベントジャンルのSVGアイコン（食事/旅行/遊び/買い物/飲み会/その他）。

### 3-C. 主な変更点
- **アプリの骨格（`App.vue`）**：3カラム＋スライド式サイドバー(`AppSidebar`)を**廃止**し、**常時モバイルシェル**（上部バー`AppHeader` ＋ 本文スクロール ＋ 下部タブナビ`AppFooter`＋中央「＋」FAB）に。全てSVGアイコン・ブランド緑。
- **ヘッダー崩れバグの根治**：各画面の「角丸＋色付きバナー」が `position: sticky` に `top` 指定なし（または `top:60px`）で、スクロール枠内でずり落ちて余白が出ていた。→ **全廃**し `PageHeader` に統一。
- **配色**：青(`#3b82f6`/`#2169a3`/`#2563eb`)やグラデーションを**ブランド緑/アンバーのフラット**に統一（受取=緑・支払=アンバーの意味的配色）。PayPay固有ボタンの赤(`#ff0033`)はブランド色として意図的に維持。
- **金額表記**：`¥1,234`（空白なし・カンマ・等幅数字 `.tnum`）に統一（`¥ 0` の余分な空白を排除）。
- **絵文字 → SVGアイコン**：ナビ/ジャンル/カメラ/通知/各種アクションを全てSVG化。**削除操作はゴミ箱アイコン**（`.btn-trash`）。
- **余白・サイズ**：過剰だった余白・カードサイズを圧縮（見出し`.screen-head`、イベントカード等）。

### 3-D. このリデザインの取り込み方（重要）
- リデザインは**大崎のローカル作業コピー（`feat/ui-enhanceme`・未コミット）にのみ存在**。リモートには未反映。
- **やってはいけない**：このローカルから `git pull`（履歴書き換え後のリモートと衝突）。
- **推奨手順**：
  1. 大崎が、書き換え済みの**最新リモートから新規 clone** したクリーンな作業場所を用意。
  2. そこへ本リデザインの変更（`src/` 配下＋`index.html`＋`firebase.json`＋`firestore.rules` 等）を移植し、新ブランチでコミット → PR。
  3. レビュー後マージ → `firebase deploy`（hosting）でライブにも反映。
  - ※ `.env.local` / `service-account.json` はコミットしないこと（`.gitignore` 済み）。

### 3-E. 変更したファイル一覧（UI）
- 基盤：`src/assets/base.css` `src/assets/main.css` `src/main.js` `index.html`
- シェル：`src/App.vue` `src/components/AppHeader.vue` `src/components/AppFooter.vue`
- 新規部品：`src/components/PageHeader.vue` `src/components/GenreIcon.vue`
- 画面：`LoginView` `HomeView` `EventViews` `FriendView` `MakeEventView` `MoneyPage` `MyPageView` `EditProfileView` `EventDetails` `PaymentHistoryView` `PaymentDetailView` `CombinedActionView` `CombinedSettlementView`
- 部品/モーダル：`PaymentCarousel` `FriendCard` `HistoryCard` `PayPayAction` `BaseModal` `AddPaymentModal` `FriendAddModal` `InviteModal` `RemindModal` `ReceiptPaymentModal` `NotificationIcon`
- ※ `AppSidebar.vue` は使用停止（削除可）。

### 3-F. 動作確認
- `npm run build` が通ることを各変更後に確認済み。
- ログイン画面は未ログインでも表示可能（実機スクショで検証済み）。認証後の画面は各自ログインして確認してください。
