import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(project, 'tests/preview/paypay');
const mock = path.join(root, 'mock.js');
const server = await createServer({
  configFile: false,
  envFile: false,
  root,
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@/firebase', replacement: mock },
      { find: 'firebase/firestore', replacement: mock },
      { find: 'firebase/auth', replacement: mock },
      { find: '@', replacement: path.join(project, 'src') },
    ],
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [project] } },
});
await server.listen();
console.log('PayPay部品の確認画面です。Firebaseには接続せず、保存はメモリ内で行います。');
server.printUrls();
