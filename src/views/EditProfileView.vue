<template>
    <div class="edit-profile-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        <h1 class="title">プロフィール編集</h1>
        <div class="spacer"></div>
      </header>
  
      <main class="content">
        <div class="avatar-edit-section">
          <img :src="previewPhoto || userPhoto" class="user-circle-large" />
          
          <button class="upload-btn" @click="showPhotoOptions = true">
            📷 画像を変更する
          </button>
        </div>
  
        <div class="input-group">
          <label class="input-label">名前</label>
          <input type="text" v-model="newName" class="custom-input" placeholder="新しい名前を入力" />
        </div>
  
        <button class="save-btn" @click="saveProfile">保存する</button>
      </main>
  
      <Teleport to="body">
        <div v-if="showPhotoOptions" class="overlay" @click.self="showPhotoOptions = false">
          <div class="action-sheet">
            <button class="sheet-btn" @click="triggerCamera">📷 カメラで写真を撮る</button>
            <button class="sheet-btn" @click="triggerLibrary">🖼 アルバムから選ぶ</button>
            <button class="sheet-btn cancel" @click="showPhotoOptions = false">キャンセル</button>
          </div>
        </div>
      </Teleport>
  
      <input ref="fileInputLibrary" type="file" accept="image/*" style="display: none;" @change="onFileChange" />
      <input ref="fileInputCamera" type="file" accept="image/*" capture="environment" style="display: none;" @change="onFileChange" />
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import { auth } from "../firebase";
  
  const newName = ref("");
  const userPhoto = ref("");
  const previewPhoto = ref(null);
  
  // UI制御用の変数
  const showPhotoOptions = ref(false);
  const fileInputLibrary = ref(null);
  const fileInputCamera = ref(null);
  
  onMounted(() => {
    const user = auth.currentUser;
    if (user) {
      newName.value = user.displayName || "";
      // 初期アイコンがない場合のダミー画像
      userPhoto.value = user.photoURL || "https://via.placeholder.com/150/e2e8f0/808080?text=No+Image";
    }
  });
  
  // 🌟 アルバムを開く処理
  const triggerLibrary = () => {
    showPhotoOptions.value = false;
    fileInputLibrary.value.click();
  };
  
  // 🌟 カメラを起動する処理（許可ダイアログ付き）
  const triggerCamera = () => {
    showPhotoOptions.value = false;
    // 擬似的な許可ダイアログを出して確認する
    if (confirm("Settlo がカメラへのアクセスを求めています。\n許可しますか？")) {
      fileInputCamera.value.click();
    }
  };
  
  // 画像が選択された時にプレビューを表示する処理
  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      previewPhoto.value = URL.createObjectURL(file);
      // TODO: 後でここにFirebaseへのアップロード処理を書く
    }
  };
  
  const saveProfile = async () => {
    alert(`${newName.value} さんとして保存します！\n(※実際の保存処理は準備中です)`);
  };
  </script>
  
  <style scoped>
  /* 🌟 全体のコンテナ */
  .edit-profile-container { 
    background: #f8fafc; 


    box-sizing: border-box; 
    display: flex;
    flex-direction: column;
  }
  
  /* ヘッダー */
  .detail-header { display: flex; align-items: center; padding: 10px 15px; background: white; }
  .back-btn { background: none; border: none; font-size: 32px; color: #64748b; cursor: pointer; }
  .title { flex: 1; text-align: center; font-size: 18px; font-weight: bold; margin: 0; padding-right: 32px; }
  .spacer { display: none; }
  
  /* 🌟 コンテンツの中央配置の要 */
  .content { 
    flex: 1; 
    padding: 30px 20px 5px 20px; /* 下部にフッター分の余白（100px）を空ける */
    width: 100%;
    max-width: 500px; /* PC画面でも横に広がりすぎないように制限 */
    margin: 0 auto; /* 左右の余白を均等にして中央揃え */
    box-sizing: border-box; 
    display: flex; 
    flex-direction: column; 
    align-items: center; /* 中身の要素を中央に揃える */
  }
  
  /* アバター部分 */
  .avatar-edit-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 5px; }
  .user-circle-large { width: 120px; height: 120px; background-color: #e2e8f0; border-radius: 50%; object-fit: cover; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
  .upload-btn { background: white; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; color: #1e293b; cursor: pointer; transition: 0.2s; }
  
  /* 🌟 入力フォーム（幅100%にして、親要素のmax-widthに従わせる） */
  .input-group { width: 100%; margin-bottom: 15px; }
  .input-label { display: block; font-size: 14px; font-weight: bold; color: #64748b; margin-bottom: 8px; text-align: left; }
  .custom-input { width: 100%; padding: 15px; border-radius: 12px; border: 1px solid #cbd5e1; font-size: 16px; box-sizing: border-box; }
  .custom-input:focus { outline: none; border-color: #2169a3; box-shadow: 0 0 0 2px rgba(33, 105, 163, 0.2); }
  
  /* 🌟 保存ボタン（幅100%） */
  .save-btn { width: 100%; padding: 16px; border-radius: 16px; border: none; background: #2169a3; color: white; font-size: 16px; font-weight: bold; cursor: pointer; }
  
  /* 🌟 アクションシート（画面下から出てくるメニュー） */
  .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 3000; }
  .action-sheet { background: #f8fafc; width: 100%; padding: 20px; border-radius: 20px 20px 0 0; box-sizing: border-box; }
  .sheet-btn { width: 100%; padding: 18px; background: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; margin-bottom: 10px; cursor: pointer; color: #1e293b; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
  .sheet-btn.cancel { background: #e2e8f0; color: #64748b; margin-top: 10px; }
  </style>