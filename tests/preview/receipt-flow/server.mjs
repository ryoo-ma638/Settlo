import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = fileURLToPath(new URL('./',import.meta.url));
const project = fileURLToPath(new URL('../../../',import.meta.url));
const mock = root + 'mock.js';
const baselineCommit = '9e8dc568074bf4a6791d35ffdd31cb30b6d2f060';
const baselineSource = execFileSync('git', ['show', `${baselineCommit}:src/components/AddPaymentModal.vue`], {cwd:project,encoding:'utf8'});
const baselineHash = createHash('sha256').update(baselineSource).digest('hex');
if (baselineHash !== 'abe06c6495cf7858eb118213a20fb6d0e6504f31c3ae134246cd33510c79d84f') throw new Error('比較元の版が一致しません');
// 元ファイルを上書きせず、gitの内容そのままを仮想モジュールとして読み込む。
const beforeId = project + 'src/components/__receipt_before__.vue';
const baselinePlugin = {
  name:'receipt-comparison-baseline', enforce:'pre',
  resolveId(id) { if (id === 'virtual:receipt-before') return beforeId; },
  load(id) { if (id === beforeId) return baselineSource; },
};
const server = await createServer({
  configFile:false, envFile:false, root,
  cacheDir:path.join(root,'.vite-cache'),
  plugins:[baselinePlugin,vue()],
  optimizeDeps:{noDiscovery:true,include:['vue'],entries:[]},
  resolve:{alias:[{find:'@/firebase',replacement:mock},{find:'../firebase',replacement:mock},{find:'firebase/functions',replacement:mock},{find:'@',replacement:project+'src'}]},
  server:{host:'127.0.0.1',port:5207,strictPort:true,fs:{allow:[project]}},
});
await server.listen();
console.log(`比較元: ${baselineCommit} / SHA256: ${baselineHash}`);
server.printUrls();
