import {createApp} from 'vue';
import App from './App.vue';
import {testState} from './mock.js';
import '@/assets/main.css';
// 確認画面では外部アプリやリンクを開かない。
window.open = url => { testState.openedUrl = String(url); return null; };
createApp(App).mount('#app');
