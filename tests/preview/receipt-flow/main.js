import { createApp } from 'vue';
import App from './App.vue';
import '../../../src/assets/main.css';
const width = new URLSearchParams(location.search).get('width');
document.documentElement.style.setProperty('--pane-width', ['320','390','600'].includes(width) ? width+'px' : '390px');
createApp(App).mount('#app');
