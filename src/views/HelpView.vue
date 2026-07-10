<template>
  <div class="help">
    <PageHeader title="ヘルプ・使い方" fallback="/" />

    <main class="help__body">
      <p class="help__lead">Settlo（セトロ）は、旅行や飲み会の立て替えをかんたんに記録して、まとめて精算できる割り勘アプリです。</p>

      <!-- 1. イベント -->
      <section class="hcard">
        <img class="hcard__img" src="/tutorial/event.jpg" alt="イベントの画面" />
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg></div>
          <h2>1. イベントをつくる・参加する</h2>
        </div>
        <ul>
          <li>下の「<b>＋</b>」からイベント（旅行・飲み会など）を作成できます。</li>
          <li>メンバーは「<b>招待</b>」ボタンから招待するか、<b>招待コード</b>を共有して参加してもらいます。</li>
          <li>招待は<b>承認制</b>。相手が「参加する」を選ぶまで勝手に追加されません。</li>
        </ul>
      </section>

      <!-- 2. 支払いの記録 -->
      <section class="hcard">
        <img class="hcard__img" src="/tutorial/payment.jpg" alt="支払いを追加する画面" />
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg></div>
          <h2>2. 支払いを記録する（レシート読み取り）</h2>
        </div>
        <ul>
          <li>イベント内の「<b>＋ 支払いを追加</b>」から立て替えを記録します。</li>
          <li><b>レシートを撮影すると、AIが店名・金額・商品・消費税まで自動入力</b>します（税込/税抜・8%/10%も自動判定）。</li>
          <li>割り勘の方法は「全員で均等」「金額を指定」「商品ごとに指定」の3種類。</li>
          <li>1円単位のずれ（不明な残金）が出たら、<b>誰が負担するかを選んで理由も残せます</b>。</li>
        </ul>
      </section>

      <!-- 3. 精算 -->
      <section class="hcard">
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><path d="M7 10l-3 3 3 3M17 4l3 3-3 3"/><path d="M4 13h13M20 7H7"/></svg></div>
          <h2>3. まとめて精算する</h2>
        </div>
        <ul>
          <li>「<b>精算サマリー</b>」が貸し借りを自動で相殺し、<b>最小回数の送金</b>にまとめます。</li>
          <li>支払いは <b>PayPayリンク</b>（相手が登録していれば）か<b>現金</b>で。</li>
          <li>現金で払ったら「支払った」→ 相手が承認すると<b>完了</b>。双方に通知が届きます。</li>
          <li>旅行の終わりは「<b>イベントを終了する</b>」→ 残りをまとめて精算して締められます。</li>
        </ul>
      </section>

      <!-- 4. 通知と承認 -->
      <section class="hcard">
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <h2>4. 通知と「正しい／正しくない」</h2>
        </div>
        <ul>
          <li>申請・催促・変更はすべて<b>お知らせ（ベルのアイコン）</b>に届きます。</li>
          <li>誰かが取引を削除・復元すると「<b>これは正しいですか？</b>」の確認が届きます。<b>どちらかが認めるまで交互に確認</b>が続くので、勝手な変更でデータが食い違いません。</li>
          <li>アプリを閉じていても、スマホに<b>プッシュ通知</b>が届きます（通知を許可した場合）。</li>
        </ul>
      </section>

      <!-- 5. チャット・承認待ち -->
      <section class="hcard">
        <img class="hcard__img" src="/tutorial/notify.jpg" alt="お知らせの画面" />
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/></svg></div>
          <h2>5. チャット・承認待ち・催促</h2>
        </div>
        <ul>
          <li>お知らせの「<b>返信</b>」から、その件（〇〇の支払いの件 など）について<b>チャット</b>で相談できます。ヘッダーの吹き出しアイコンで一覧を開け、<b>未読の数がバッジ</b>で出ます。承認・完了で解決すると、そのチャットは自動で片付きます。</li>
          <li>ヘッダーの<b>時計アイコン＝承認待ち</b>。あなたが承認する分・相手の承認待ち・<b>承認/拒否の履歴</b>（消えずに残る）をまとめて確認でき、<b>催促されている支払いは一番上に赤く強調</b>されます。</li>
          <li>まだ払っていない相手には「<b>催促する</b>」で通知を送れます（ひとことメッセージも添えられます）。</li>
        </ul>
      </section>

      <!-- 6. ゴミ箱 -->
      <section class="hcard">
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></div>
          <h2>6. 間違えても大丈夫（ゴミ箱）</h2>
        </div>
        <ul>
          <li>削除した支払い・完了した決済・削除したイベントは<b>ゴミ箱（マイページ内）</b>に入ります。</li>
          <li><b>7日以内なら元に戻せます</b>（7日をすぎると自動で消えます）。</li>
          <li>取引のゴミ箱は<b>相手からも見える</b>ので、勝手に消されても気づけます。</li>
        </ul>
      </section>

      <!-- 6. その他 -->
      <section class="hcard">
        <div class="hcard__head">
          <div class="hcard__icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v.01M12 13a2.5 2.5 0 1 0-2.5-2.5"/></svg></div>
          <h2>7. よくある質問</h2>
        </div>
        <ul>
          <li><b>Q. スマホのアプリみたいに使いたい</b><br>A. ブラウザの共有メニューから「ホーム画面に追加」すると、アプリとして起動できます。</li>
          <li><b>Q. フレンドはどう追加する？</b><br>A. フレンド画面の「＋」から名前で検索（同じイベントのメンバーは候補に出ます）。イベントの参加者一覧からも申請できます。</li>
          <li><b>Q. プロフィールを変えたい</b><br>A. マイページ →「プロフィールを変更」で名前と写真を変更できます。</li>
          <li><b>Q. お試しで触ってみたい</b><br>A. ログイン画面の「ゲストとして試す（デモ）」で、登録なしにデモデータつきで体験できます。</li>
        </ul>
      </section>

      <button class="btn-brand help__tour" @click="replayTour">はじめてガイドをもう一度見る</button>
      <button class="btn-outline help__tour" @click="startButtonTour">画面のボタンの説明を見る</button>
    </main>
  </div>
</template>

<script setup>
import PageHeader from '../components/PageHeader.vue';

import { useRouter } from 'vue-router';
const router = useRouter();

// 初回チュートリアル（オンボーディング）をもう一度表示する
const replayTour = () => {
  localStorage.removeItem('settlo_onboarding_done');
  window.dispatchEvent(new CustomEvent('settlo:show-onboarding'));
};

// 画面のボタン1つ1つを強調して説明するツアーを開始する
// （ヘッダー・下部ナビが見えるホームに戻ってから起動）
const startButtonTour = async () => {
  if (router.currentRoute.value.path !== '/') await router.push('/');
  setTimeout(() => window.dispatchEvent(new CustomEvent('settlo:show-button-tour')), 250);
};
</script>

<style scoped>
.help__body { padding: 12px var(--pad) 32px; }
.help__lead { font-size: 14px; color: var(--c-text-sub); line-height: 1.7; margin: 4px 0 18px; }

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
.hcard__head h2 { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink); margin: 0; }
.hcard ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; }
.hcard li { font-size: 13.5px; line-height: 1.7; color: var(--c-text-sub); }
.hcard li b { color: var(--c-ink); }

.help__tour { width: 100%; margin-top: 6px; }
</style>
