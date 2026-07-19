<template>
  <div class="help">
    <PageHeader title="ヘルプ・使い方" fallback="/" />

    <main class="help__body">
      <p class="help__lead">Settlo（セトロ）は、旅行や飲み会の立て替えをかんたんに記録して、まとめて精算できる割り勘アプリです。実際のデモ画面で、使い方を順番に見ていきましょう。</p>

      <!-- ============ 実際の画面で使い方（図解ステップ） ============ -->
      <h2 class="help__h2">実際の画面で、使い方</h2>
      <p class="help__note">よく使う流れを、実際のデモ画面で1手ずつ説明します。（画面の名前や金額はデモ用のサンプルです）</p>

      <section v-for="(st, i) in steps" :key="i" class="step">
        <img class="step__img" :src="`/tutorial/${st.img}.jpg`" :alt="st.title" loading="lazy" />
        <div class="step__body">
          <h3 class="step__title">{{ st.title }}</h3>
          <p class="step__text" v-html="st.body"></p>
          <ul v-if="st.points" class="step__points">
            <li v-for="(p, j) in st.points" :key="j" v-html="p"></li>
          </ul>
        </div>
      </section>

      <!-- ============ 画面ごとの詳しい説明 ============ -->
      <h2 class="help__h2">画面ごとの詳しい説明</h2>
      <p class="help__note">各カードをタップすると、その画面の目的と、ボタン1つ1つ・押すとどこへ行くか（画面遷移）がすべて開きます。</p>

      <div v-for="group in screenGroups" :key="group.title" class="sgroup">
        <p class="sgroup__title">{{ group.title }}</p>
        <details v-for="s in group.screens" :key="s.name" class="hacc">
          <summary class="hacc__sum">
            <span class="hacc__ic"><svg viewBox="0 0 24 24"><path v-for="(d, i) in icons[s.icon]" :key="i" :d="d" /></svg></span>
            <span class="hacc__title">
              {{ s.name }}
              <span v-if="s.route" class="hacc__route">{{ s.route }}</span>
            </span>
            <svg class="hacc__chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
          </summary>
          <div class="hacc__body">
            <p class="hacc__purpose">{{ s.purpose }}</p>
            <ul class="hacc__items">
              <li v-for="(it, i) in s.items" :key="i">
                <b>{{ it.b }}</b>
                <span v-if="it.act" class="hacc__act">{{ it.act }}</span>
              </li>
            </ul>
            <p v-if="s.tip" class="hacc__tip">{{ s.tip }}</p>
          </div>
        </details>
      </div>

      <!-- ============ 画面遷移マップ ============ -->
      <h2 class="help__h2">画面遷移マップ</h2>
      <p class="help__note">どこからどこへ行けるか、大きな地図です。ヘッダーと下の5つのボタンが、いつでもの入口になります。</p>
      <div class="map">
        <div class="map__row"><span class="map__from">下のナビ</span><span class="map__to">ホーム ／ イベント ／ ＋（作成・支払い追加） ／ 支払い ／ フレンド</span></div>
        <div class="map__row"><span class="map__from">ヘッダー</span><span class="map__to">ロゴ→ホーム ／ 顔→マイページ ／ 時計→承認待ち ／ 吹き出し→チャット ／ ベル→お知らせ ／ ロボット→アシスタント</span></div>
        <div class="map__row"><span class="map__from">ホーム</span><span class="map__to">→ 支払い ／ 各支払いの詳細 ／ イベント一覧 ／ イベント詳細</span></div>
        <div class="map__row"><span class="map__from">支払い</span><span class="map__to">→ 支払い/催促の詳細 ／ 相手ごとのトータル精算 ／ お支払い履歴</span></div>
        <div class="map__row"><span class="map__from">イベント詳細</span><span class="map__to">→ 支払いを追加 ／ 招待 ／ 精算サマリー ／ 立て替え履歴 ／ 終了・削除</span></div>
        <div class="map__row"><span class="map__from">フレンド</span><span class="map__to">→ フレンド詳細 → トータル精算 → まとめて精算の実行</span></div>
        <div class="map__row"><span class="map__from">マイページ</span><span class="map__to">→ プロフィール編集 ／ 承認待ち ／ チャット ／ お支払い履歴 ／ ゴミ箱 ／ このヘルプ</span></div>
        <div class="map__row"><span class="map__from">チャット</span><span class="map__to">→ スレッド（会話）→ その件の支払い画面</span></div>
      </div>

      <!-- ============ FAQ ============ -->
      <h2 class="help__h2">よくある質問</h2>
      <section class="hcard">
        <ul class="faq">
          <li><b>Q. スマホのアプリみたいに使いたい</b><br>A. ブラウザの共有メニューから「ホーム画面に追加」すると、アプリとして起動できます。</li>
          <li><b>Q. フレンドはどう追加する？</b><br>A. フレンド画面の「友達を追加する」から名前かIDで検索（同じイベントのメンバーは候補に出ます）。イベントの参加者一覧からも申請できます。</li>
          <li><b>Q. プロフィールを変えたい</b><br>A. マイページ →「プロフィールを変更」で名前・ニックネーム・写真を変更できます。</li>
          <li><b>Q. お試しで触ってみたい</b><br>A. ログイン画面の「ゲストとして試す（デモ）」で、登録なしにデモデータつきで体験できます。</li>
        </ul>
      </section>

      <!-- ============ ガイド再生 ============ -->
      <button class="btn-brand help__tour" @click="replayTour">はじめてガイドをもう一度見る</button>
      <button class="btn-outline help__tour" @click="startButtonTour">使い方ツアーを始める（ボタンを順番にご案内）</button>
    </main>
  </div>
</template>

<script setup>
import PageHeader from '../components/PageHeader.vue';
import { useRouter } from 'vue-router';
const router = useRouter();

// 使い方ツアー：ホームに戻ってから起動。スポットライトでボタンを1つずつ順番に案内する
const startButtonTour = async () => {
  if (router.currentRoute.value.path !== '/') await router.push('/');
  setTimeout(() => window.dispatchEvent(new CustomEvent('settlo:show-button-tour')), 250);
};
// 初回オンボーディングをもう一度表示する
const replayTour = () => {
  localStorage.removeItem('settlo_onboarding_done');
  window.dispatchEvent(new CustomEvent('settlo:show-onboarding'));
};

// 実際の画面つきの使い方ステップ（画像は public/tutorial/g-*.jpg）
const steps = [
  { img: 'g-home', title: '① ホームで貸し借りがひと目', body: '受け取る額・支払う額・今月の収支がひと目でわかります。進行中のイベントもここから開けます。' },
  { img: 'g-event', title: '② イベントで立て替えを管理', body: '旅行や飲み会ごとにイベントを作り、<b>「＋ 招待」</b>か<b>招待コード</b>で仲間を集めます。未精算の残り・参加者・精算の進み具合がまとまります。' },
  { img: 'g-addpay', title: '③ お支払いを追加する', body: 'イベント内の<b>「＋ 支払いを追加」</b>から立て替えを記録します。', points: [
    '<b>レシートを撮ると、AIが店名・金額・消費税まで自動入力</b>（手入力もOK）',
    '<b>立替えた人</b>を選ぶ（自分／デモ太郎 など）',
    '<b>割り勘の方法</b>：全員で均等／金額を指定／商品ごとに指定',
    '最後に<b>「この内容で追加する」</b>で登録',
  ] },
  { img: 'g-settle', title: '④ まとめて精算する', body: '<b>「支払い」→「まとめて」</b>タブ。相手ごとに全イベントの貸し借りを相殺し、受け取る／支払う額を最小回数にまとめます。タップで精算へ。' },
  { img: 'g-remind', title: '⑤ 催促・受け取り・承認', body: 'PayPayリンクで請求、または<b>「支払いを催促する」</b>で通知。現金でやり取りしたら<b>「受け取った／支払った」</b>→ 相手の承認で完了。双方に通知が届きます。' },
  { img: 'g-assistant', title: '⑥ アシスタントが次の一手を教える', body: 'ヘッダー右のロボットから。いま<b>支払う・催促する・承認する</b>相手を金額つきで表示。どの画面からでも開けます。' },
  { img: 'g-friend', title: '⑦ フレンドを追加・承認', body: '<b>「友達を追加する」</b>から名前かIDで検索して申請。届いた<b>友達申請</b>は「確認」から承認。友達ごとの貸し借りもまとまります。' },
];

// アイコン（1〜2本のパスで表現。svg は viewBox 0 0 24 24）
const icons = {
  home: ['M4 11l8-6 8 6', 'M6 10v9h12v-9'],
  wallet: ['M4 7h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z', 'M16 12h3', 'M4 7l11-3 1 3'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16M9 3v4M15 3v4'],
  calCheck: ['M4 6h16v14H4z', 'M4 10h16M9 3v4M15 3v4', 'M9 15l2 2 4-4'],
  people: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 20a6 6 0 0 1 12 0', 'M16 6a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5'],
  person: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 21a7 7 0 0 1 14 0'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'],
  coins: ['M12 8a6 3 0 1 0 0-6 6 3 0 0 0 0 6z', 'M6 5v6c0 1.7 2.7 3 6 3s6-1.3 6-3V5', 'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'],
  swap: ['M7 8h11l-3-3', 'M17 16H6l3 3'],
  history: ['M12 21a9 9 0 1 0-9-9', 'M3 12l-2 2m2-2l2 2', 'M12 8v4l3 2'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  bot: ['M4 8h16v11H4z', 'M12 8V4M8 3h8', 'M9 13h.01M15 13h.01'],
  bubble: ['M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z'],
  layout: ['M3 5h18v14H3z', 'M3 9h18'],
  nav: ['M3 5h18v14H3z', 'M3 15h18'],
  trash: ['M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'],
  pencil: ['M4 20h4L20 8l-4-4L4 16z', 'M14 6l4 4'],
  door: ['M14 3H6v18h8', 'M10 12h11l-3-3m3 3l-3 3'],
};

// 画面ごとの説明。ラベル・遷移先は実装どおり。
const screenGroups = [
  {
    title: 'まず使う画面',
    screens: [
      { name: 'ヘッダー（画面の上）', route: '', icon: 'layout',
        purpose: 'どの画面でも上に出る共通の操作バー。中央のロゴでホームに戻れます。',
        items: [
          { b: 'Settlo（ロゴ・中央）', act: '→ ホームへ' },
          { b: '顔アイコン（左）', act: '→ マイページへ' },
          { b: '時計アイコン', act: '→ 承認待ちへ（承認する件数のバッジ付き）' },
          { b: '吹き出しアイコン', act: '→ チャット一覧へ（未読数バッジ）' },
          { b: 'ベルアイコン', act: 'お知らせを開く（届いた申請・催促・確認）' },
          { b: 'ロボットアイコン（右端）', act: 'お支払いアシスタントを開閉（下記）' },
        ] },
      { name: '下のナビ（画面の下）', route: '', icon: 'nav',
        purpose: 'どの画面でも下に出る5つの入口。',
        items: [
          { b: 'ホーム', act: '→ ホーム' },
          { b: 'イベント', act: '→ イベント一覧' },
          { b: '＋（中央の緑）', act: '選択が開く：「イベントを作成」→作成画面／「お支払いを追加」→イベントを選ぶ' },
          { b: '支払い', act: '→ 支払い・精算' },
          { b: 'フレンド', act: '→ フレンド' },
        ] },
      { name: 'ホーム', route: '/', icon: 'home',
        purpose: '受け取る額・支払う額と、進行中のイベントがひと目でわかる起点。',
        items: [
          { b: 'お支払い状況カード（左右で切替）', act: 'タップ → 支払い（受け取り／未払いのタブ）' },
          { b: '直近の未受け取り・お支払いの行', act: '→ その支払いの詳細' },
          { b: '他 N 件をすべて見る', act: '→ 支払い（該当タブ）' },
          { b: 'すべて見る（進行中のイベント）', act: '→ イベント一覧' },
          { b: 'イベントカード', act: '→ そのイベント詳細' },
        ] },
      { name: '支払い・精算', route: '/payment', icon: 'wallet',
        purpose: '受け取り待ち・未払い・相手ごとのまとめ精算をあつかう精算ハブ。3つのタブ。',
        items: [
          { b: 'タブ「お支払い待ち」', act: '受け取る側の一覧（あなたの承認が必要な分も）' },
          { b: 'タブ「未払い」', act: '支払う側の一覧（相手の承認待ちも）' },
          { b: 'タブ「まとめて」', act: '相手ごとに相殺した差し引き。タップでまとめて精算' },
          { b: '受け取りの行', act: '→ 催促／受け取りの詳細' },
          { b: '未払いの行', act: '→ お支払いの詳細' },
          { b: '相手ごとのカード', act: '→ トータル精算（相殺プレビュー）' },
          { b: 'すべての履歴を見る', act: '→ お支払い履歴' },
        ] },
      { name: 'イベント一覧', route: '/event', icon: 'calendar',
        purpose: '参加中のイベントの一覧。支払いを追加するイベントを選ぶ画面にもなります。',
        items: [
          { b: '精算を確認（右上）', act: '→ 支払い・精算' },
          { b: 'イベントカード', act: '→ そのイベント詳細（支払い追加から来たときは追加画面つき）' },
        ] },
      { name: 'イベント詳細', route: '/event/:id', icon: 'calCheck',
        purpose: '1つのイベントの立て替え履歴・精算サマリー・参加者を管理する中心画面。',
        items: [
          { b: '編集（イベント名の横）', act: 'イベント名・ジャンルを変更' },
          { b: '参加者 (N名) ›', act: '参加者一覧（フレンド申請・外す）' },
          { b: '＋ 招待', act: '招待画面（相手を検索して招待）' },
          { b: 'コピー（招待コード）', act: 'コードをコピーして共有' },
          { b: '＋ 支払いを追加', act: 'レシート撮影・割り勘の追加画面' },
          { b: '精算サマリーの送金カード', act: 'まとめて支払う／受け取る・催促へ' },
          { b: '立て替え履歴のカード', act: 'その取引の詳細（編集・削除・未精算に戻す）' },
          { b: 'イベントを終了する', act: '精算済みとして締める（記録は残る）' },
          { b: 'イベントを削除する', act: 'ゴミ箱へ（相手にも通知）' },
        ] },
      { name: 'フレンド', route: '/friend', icon: 'people',
        purpose: '友達の一覧・追加・申請の承認。相手ごとの貸し借りも反映されます。',
        items: [
          { b: '友達を追加する', act: '名前検索／ID検索で申請を送る' },
          { b: '届いた申請の「確認」', act: '承認する／心当たりがない' },
          { b: '絞り込み・並べ替え', act: 'すべて／フレンドのみ／取引中 など' },
          { b: 'フレンドカード', act: '→ フレンド詳細' },
        ] },
      { name: 'マイページ', route: '/mypage', icon: 'person',
        purpose: '自分のプロフィールと、各機能への入口をまとめたハブ。',
        items: [
          { b: 'IDピル', act: '自分のIDをコピー（フレンド検索に使える）' },
          { b: 'プロフィールを変更', act: '→ プロフィール編集' },
          { b: 'フレンド管理', act: '→ フレンド' },
          { b: 'お支払い履歴', act: '→ お支払い履歴' },
          { b: '承認待ち', act: '→ 承認待ち' },
          { b: 'チャット', act: '→ チャット一覧' },
          { b: 'アプリの使い方', act: '→ このヘルプ' },
          { b: 'ゴミ箱', act: '→ ゴミ箱' },
          { b: 'ログアウト', act: '→ ログイン画面へ' },
        ] },
    ],
  },
  {
    title: '記録と精算',
    screens: [
      { name: 'イベント作成・参加', route: '/make-event', icon: 'calendar',
        purpose: '新しいイベントを作る、または招待コードで既存イベントに参加する。',
        items: [
          { b: '上のトグル「作る／参加する」', act: 'モード切替' },
          { b: 'ジャンル（食事・旅行など6種）', act: 'イベントの種類を選ぶ' },
          { b: 'コピー（招待コード）', act: 'コードをコピー' },
          { b: '作成する', act: '→ 作成してホームへ' },
          { b: '参加する', act: '→ 参加してそのイベント詳細へ' },
        ] },
      { name: '支払いを追加（レシート）', route: '', icon: 'receipt',
        purpose: 'イベント内で立て替えを記録する画面。レシートをAIが読み取ります。',
        items: [
          { b: 'カメラで撮影／アルバムから', act: 'レシートを読み取って自動入力' },
          { b: '割り勘の方法', act: '全員で均等／金額を指定／商品ごとに指定' },
          { b: '税の扱い', act: '税込／税抜→合計に課税／商品ごと課税・8%/10%' },
          { b: 'この内容で追加する', act: '立て替えを登録（編集時は保存）' },
        ] },
      { name: 'お支払い・催促の詳細', route: '/payment-detail/:id', icon: 'coins',
        purpose: '1件（またはまとめ）の取引を、決済・催促・承認/拒否する画面。',
        items: [
          { b: '受け取った（完了にする）', act: '受け取る側：現金受け取りを記録' },
          { b: '支払った（承認リクエスト）', act: '支払う側：支払いを申請（相手が承認で完了）' },
          { b: '支払いを催促する（通知を送る）', act: '至急／日数／日付＋ひとことで催促' },
          { b: '承認して完了にする／拒否する', act: '相手の申請を承認・拒否' },
          { b: 'PayPayで支払う／請求リンク', act: 'PayPayリンクで受け渡し（登録時）' },
        ] },
      { name: 'トータル精算', route: '/combined-settlement/:name', icon: 'swap',
        purpose: '特定の相手との全イベントの貸し借りを相殺し、対象を選んでまとめて精算。',
        items: [
          { b: 'お支払い待ち／未払いのボックス', act: '対象を絞り込む' },
          { b: '各取引の丸トグル', act: '今回の精算に含める／除外する' },
          { b: '¥N をまとめて催促する／支払う', act: '→ まとめて精算の実行画面' },
        ] },
      { name: 'まとめて精算の実行', route: '/combined-action/:name', icon: 'swap',
        purpose: '相殺した金額を、アプリ決済か現金でまとめて精算する最終画面。',
        items: [
          { b: 'PayPayで支払う／請求リンク', act: 'アプリ決済で受け渡し' },
          { b: '現金で受け取った／支払った', act: '→ 確認して精算を完了' },
        ] },
      { name: 'お支払い履歴', route: '/payment-history', icon: 'history',
        purpose: '自分に関わる全取引を時系列で確認。支払い・受け取り・精算済みで絞れます。',
        items: [
          { b: 'タブ（すべて／支払い／受け取り／精算済み）', act: '絞り込み' },
          { b: '履歴カード', act: '→ その取引の詳細' },
        ] },
    ],
  },
  {
    title: '通知・承認・会話',
    screens: [
      { name: 'お知らせ（ベル）', route: '', icon: 'bell',
        purpose: 'ヘッダーのベルから開くお知らせ。申請・催促・確認がここに集まります。',
        items: [
          { b: '参加する／心当たりがない', act: 'イベント招待への返事' },
          { b: '承認する／拒否する', act: '支払い・戻し依頼への返事' },
          { b: '正しい／正しくない', act: '削除・復元の「これで合っていますか」確認' },
          { b: '返信／会話を開く', act: '→ その件のチャット（スレッド）' },
        ] },
      { name: '承認待ち', route: '/approvals', icon: 'clock',
        purpose: 'あなたが承認する分・相手待ち・催促・承認/拒否の履歴を一括で確認。',
        items: [
          { b: '催促されています（赤・最上部）', act: '→ 早く払うべき支払いの詳細' },
          { b: 'あなたの承認待ちの行', act: '→ 受け取り／承認の詳細' },
          { b: '相手の承認待ちの行', act: '→ 申請中の支払いの詳細' },
          { b: '承認・拒否の履歴', act: '記録として残る（消えません）' },
        ] },
      { name: 'お支払いアシスタント（ロボット）', route: '', icon: 'bot',
        purpose: 'ヘッダーのロボットから開閉。いま何をすべきかを金額つきで教えてくれます。どの画面からでも開けます。',
        items: [
          { b: '各アクション（承認する／支払う／催促する）', act: '→ その手続きの画面へ' },
          { b: '×', act: 'パネルを閉じる' },
        ],
        tip: 'やることが無いときは「すべて精算できています」と表示されます。' },
      { name: 'チャット一覧', route: '/chats', icon: 'bubble',
        purpose: '支払い・案件ごとの会話（スレッド）の一覧。イベントごと／人ごとで切替。',
        items: [
          { b: 'トグル（イベントごと／人ごと）', act: '並びを切替' },
          { b: 'スレッドの行', act: '→ その会話（スレッド）' },
        ] },
      { name: 'スレッド（会話）', route: '/thread/:id', icon: 'bubble',
        purpose: '1件についてのLINE風チャット。承認や支払い画面への近道もあります。',
        items: [
          { b: 'この件の支払い画面へ ›', act: '→ 該当の支払い詳細' },
          { b: '承認する／拒否する（承認バー）', act: 'その場で承認・拒否' },
          { b: 'クイック返信（ありがとう！ など）', act: 'タップで即送信' },
          { b: '入力欄＋送信', act: 'メッセージを送る' },
        ] },
    ],
  },
  {
    title: '安心・その他',
    screens: [
      { name: 'ゴミ箱', route: '/trash', icon: 'trash',
        purpose: '削除したイベント・取引・完了決済を、7日以内なら元に戻せます。',
        items: [
          { b: 'タブ（イベント／取引／保留）', act: '種類で切替' },
          { b: '元に戻す／未精算に戻す', act: '削除前の状態へ復元' },
          { b: '完全に削除', act: 'いますぐ消す' },
          { b: '依頼を取り消す（保留）', act: '相手の承認待ちを取り下げ' },
        ],
        tip: 'ここに入って7日たつと自動で消えます。取引のゴミ箱は相手からも見えるので、勝手に消されても気づけます。' },
      { name: 'プロフィール編集', route: '/edit-profile', icon: 'pencil',
        purpose: '名前・ニックネーム・プロフィール画像を変更します。',
        items: [
          { b: '画像を変更', act: 'カメラ／アルバムから選ぶ' },
          { b: '名前・ニックネーム', act: 'ニックネームでもフレンド検索で見つけてもらえます' },
          { b: '保存する', act: '→ 保存してマイページへ' },
        ] },
      { name: 'ログイン・デモ', route: '/login', icon: 'door',
        purpose: 'Googleでログイン、または登録なしのデモ（ゲスト）で試せます。',
        items: [
          { b: 'Google でログイン', act: '→ ホームへ' },
          { b: 'ゲストとして試す（デモ）', act: '→ デモデータつきで体験' },
        ] },
    ],
  },
];
</script>

<style scoped>
.help__body { padding: 12px var(--pad) 32px; }
.help__lead { font-size: 14px; color: var(--c-text-sub); line-height: 1.7; margin: 4px 0 18px; }
.help__h2 { font-size: 15px; font-weight: var(--fw-black); color: var(--c-ink); margin: 26px 2px 10px; }
.help__note { font-size: 12.5px; color: var(--c-text-faint); line-height: 1.6; margin: 0 2px 12px; }

/* 図解ステップ（画像＋説明） */
.step {
  display: flex; gap: 13px;
  background: var(--c-surface);
  border-radius: 14px;
  padding: 13px;
  margin-bottom: 11px;
  box-shadow: var(--shadow-sm);
}
.step__img {
  width: 124px; flex-shrink: 0; align-self: flex-start;
  border-radius: 12px; border: 1px solid var(--c-line);
  display: block;
}
.step__body { flex: 1; min-width: 0; }
.step__title { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); margin: 2px 0 7px; line-height: 1.4; }
.step__text { font-size: 12.5px; color: var(--c-text-sub); line-height: 1.65; margin: 0; }
.step__text b, .step__points b { color: var(--c-ink); font-weight: var(--fw-bold); }
.step__points { margin: 8px 0 0; padding-left: 15px; display: flex; flex-direction: column; gap: 5px; }
.step__points li { font-size: 12px; color: var(--c-text-sub); line-height: 1.55; }

/* 大きな流れカード */
.hcard {
  background: var(--c-surface);
  border-radius: var(--r-lg, 16px);
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-sm);
}
.hcard__img { display: block; width: 100%; max-width: 168px; margin: 0 auto 14px; border-radius: 14px; border: 1px solid var(--c-line); }
.hcard__head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.hcard__icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--c-brand-weak);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.hcard__icon svg { width: 20px; height: 20px; fill: none; stroke: var(--c-brand); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.hcard__head h3 { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink); margin: 0; }
.hcard ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; }
.hcard li { font-size: 13.5px; line-height: 1.7; color: var(--c-text-sub); }
.hcard li b { color: var(--c-ink); }
.faq { padding-left: 0 !important; list-style: none; }
.faq li { line-height: 1.75; }

/* 画面ごとアコーディオン */
.sgroup { margin-bottom: 16px; }
.sgroup__title { font-size: 12px; font-weight: var(--fw-black); color: var(--c-brand-strong); letter-spacing: .04em; margin: 0 2px 8px; }
.hacc {
  background: var(--c-surface);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 8px;
  overflow: hidden;
}
.hacc__sum {
  list-style: none;
  display: flex; align-items: center; gap: 11px;
  padding: 13px 14px;
  cursor: pointer;
  user-select: none;
}
.hacc__sum::-webkit-details-marker { display: none; }
.hacc__ic {
  width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
  background: var(--c-brand-weak);
  display: flex; align-items: center; justify-content: center;
}
.hacc__ic svg { width: 19px; height: 19px; fill: none; stroke: var(--c-brand); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.hacc__title { flex: 1; min-width: 0; font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; overflow-wrap: anywhere; }
.hacc__route { font-size: 11px; font-weight: var(--fw-bold); color: var(--c-text-faint); font-family: ui-monospace, monospace; }
.hacc__chev { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: var(--c-text-faint); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; transition: transform .18s ease; }
.hacc[open] .hacc__chev { transform: rotate(90deg); }
.hacc__body { padding: 0 14px 15px; }
.hacc__purpose { font-size: 13px; color: var(--c-text-sub); line-height: 1.65; margin: 0 0 11px; padding-top: 3px; }
.hacc__items { margin: 0; padding: 11px 0 0; list-style: none; display: flex; flex-direction: column; gap: 9px; border-top: 1px solid var(--c-line); }
.hacc__items li { font-size: 13px; line-height: 1.55; }
.hacc__items b { display: block; color: var(--c-ink); font-weight: var(--fw-bold); }
.hacc__act { display: block; color: var(--c-text-sub); font-size: 12.5px; margin-top: 1px; }
.hacc__tip { font-size: 12px; color: var(--c-text-faint); line-height: 1.6; margin: 11px 0 0; padding: 9px 11px; background: var(--c-surface-2); border-radius: 9px; }

/* 画面遷移マップ */
.map { display: flex; flex-direction: column; gap: 8px; margin-bottom: 6px; }
.map__row {
  background: var(--c-surface); border-radius: 12px; padding: 11px 13px;
  box-shadow: var(--shadow-sm);
}
.map__from { display: inline-block; font-size: 12px; font-weight: var(--fw-black); color: var(--c-brand-strong); margin-bottom: 3px; }
.map__to { display: block; font-size: 12.5px; color: var(--c-text-sub); line-height: 1.6; }

.help__tour { width: 100%; margin-top: 10px; }
</style>
