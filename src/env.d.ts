/// <reference types="vite/client" />

// Vite の import.meta.env に含めたい環境変数をここで宣言してください。
// 例: VITE_API_BASE_URL
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // 他の VITE_... 環境変数があればここに追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
