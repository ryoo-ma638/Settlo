import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? 'Settlo' : './',
  plugins: [
    vue(),
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
    // 🌟 バンドル分割：巨大な firebase を機能ごとの別チャンクに分け、初回読み込みを軽くする
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // ⚠️ firebase は内部で相互参照しているため「1つのチャンク」にまとめること。
            //    firestore/auth などに細分割すると初期化順序が壊れて
            //    実行時に ReferenceError でアプリ全体が起動しなくなる（実際に起きた）。
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('vue')) return 'vue';
            return 'vendor';
          }
        },
      },
    },
  },
})