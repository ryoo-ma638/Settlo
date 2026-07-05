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
            if (id.includes('@firebase/firestore')) return 'firebase-firestore';
            if (id.includes('@firebase/auth')) return 'firebase-auth';
            if (id.includes('@firebase/') || id.includes('/firebase/')) return 'firebase-core';
            if (id.includes('vue')) return 'vue';
            return 'vendor';
          }
        },
      },
    },
  },
})