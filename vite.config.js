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