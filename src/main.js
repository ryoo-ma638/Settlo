import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

// 🌟 CSSが当たってから画面を描く。
//    CSSは描画を止めない形で読み込んでいる（vite.config.js の nonBlockingCss）。
//    当たる前に描くと、色や背景が無い状態が一瞬見えるので、ここで待つ。
//    実測ではCSSのほうが firebase より約0.9秒早く届くので、待ち時間はほぼ0。
//    万一遅れても、2秒で見切りをつけて描く（何も出ないほうが困るため）。
function stylesReady() {
  if (typeof document === 'undefined') return Promise.resolve();
  const links = [...document.querySelectorAll('link[rel="preload"][as="style"], link[rel="stylesheet"]')];
  const pending = links.filter((l) => !l.sheet);
  if (pending.length === 0) return Promise.resolve();
  const 当たるまで = Promise.all(pending.map((l) => new Promise((done) => {
    if (l.sheet) return done();
    l.addEventListener('load', () => done(), { once: true });
    l.addEventListener('error', () => done(), { once: true });
  })));
  const 見切り = new Promise((done) => setTimeout(done, 2000));
  return Promise.race([当たるまで, 見切り]);
}

const app = createApp(App)

app.use(router)

stylesReady().then(() => app.mount('#app'))
