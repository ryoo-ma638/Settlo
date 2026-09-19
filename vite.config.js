import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
// 🌟 CSSの読み込みで描画を止めない。
//    <link rel="stylesheet"> は届くまで画面が出ない。このアプリは
//    firebase（139KB）が届くまで中身を描けないので、CSSを待つ必要が無い。
//    先に読み込み画面を出したいので、preload にして当たり次第 stylesheet へ変える。
//    ⚠️ 画面を描く前にCSSが当たっていることは main.js 側で待って担保している。
function nonBlockingCss() {
  return {
    name: 'non-blocking-css',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/g,
        (_m, a, href, b) =>
          `<link rel="preload" as="style"${a}href="${href}"${b} onload="this.rel='stylesheet'">` +
          `<noscript><link rel="stylesheet"${a}href="${href}"${b}></noscript>`,
      );
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? 'Settlo' : './',
  plugins: [
    vue(),
    nonBlockingCss(),
    //vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // 🌟 ローカルの開発サーバーは必ず 5173 番で動かす（strictPort）。
  //    Cloud Functions の callable は CORS で許可したオリジンしか受け付けず、
  //    ローカルは http://localhost:5173 だけを許可している（functions/index.js）。
  //    既定のままだと 5173 が埋まっている時に vite が黙って 5174・5175 …へ
  //    ずれてしまい、そのオリジンは許可されていないため preflight が弾かれ、
  //    ゲストログイン（setupGuestDemo）が FirebaseError: internal で失敗する。
  //    strictPort: true なら「ポートが使用中」とその場で止まるので原因がすぐ分かる。
  server: {
    port: 5173,
    strictPort: true,
  },
  // 本番ビルドの確認（npm run preview）も既定の 4173 ではなく 5173 に合わせる。
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // 🌟 CSSは1本にまとめる。
    //    画面ごとに分けると、その画面へ移った瞬間にCSSを取りに行くことになり、
    //    先に文字だけ出て、あとから背景や色が付く（実測で最大0.4秒ずれた）。
    //    まとめると最初に少し増えるが、画面移動のたびのずれが無くなる。
    cssCodeSplit: false,
    // 🌟 バンドル分割：巨大な firebase を機能ごとの別チャンクに分け、初回読み込みを軽くする
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // ⚠️ firebase は内部で相互参照しているため「1つのチャンク」にまとめること。
            //    firestore/auth などに細分割すると初期化順序が壊れて
            //    実行時に ReferenceError でアプリ全体が起動しなくなる（実際に起きた）。
            if (id.includes('firebase')) {
              // 通知と画像アップロードは、起動時には使わない。
              // どちらも読み込みのきっかけが1か所しかなく、初期化の順番にも関わらない
              // （壊れたのは firestore/auth を細かく割ったときで、この2つは別）。
              if (id.includes('/messaging')) return 'firebase-messaging';
              if (id.includes('/storage')) return 'firebase-storage';
              return 'firebase';
            }
            if (id.includes('vue')) return 'vue';
            return 'vendor';
          }
        },
      },
    },
  },
})