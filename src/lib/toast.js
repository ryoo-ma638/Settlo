import { ref } from 'vue';

// アプリ全体で使う軽量トースト（ネイティブ alert の置き換え・非ブロッキング）
export const toastMsg = ref('');
let timer = null;

export function showToast(msg, ms = 2200) {
  toastMsg.value = msg;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { toastMsg.value = ''; }, ms);
}
