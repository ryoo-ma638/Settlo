<template>
  <nav class="bottom-nav">
    <div class="nav-item" :class="{ active: $route.path === '/' }" @click="$router.push('/')">
      <span class="icon">🏠</span>
      <span class="text">ホーム</span>
    </div>
    <div class="nav-item" :class="{ active: $route.path === '/payment' }" @click="$router.push('/payment')">
      <span class="icon">💳</span>
      <span class="text">支払い</span>
    </div>
    <div class="nav-item" :class="{ active: $route.path === '/friend' }" @click="$router.push('/friend')">
      <span class="icon">👥</span>
      <span class="text">フレンド＆精算</span>
    </div>
  </nav>
</template>

<style scoped>
.bottom-nav { 
  position: fixed; 
  bottom: 0; 
  width: 100%; 
  max-width: inherit; /* 🌟 PC版の時にカラムからはみ出さないようにする */
  height: 85px; 
  background-color: white; 
  display: flex; /* 🌟 space-around は削除 */
  align-items: center; 
  border-top: 1px solid #e2e8f0; 
  border-radius: 25px 25px 0 0; 
  z-index: 100; 
}

.nav-item { 
  flex: 1; /* 🌟 ここが一番重要！画面を完全に3等分します */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center; 
  color: #94a3b8; /* 非アクティブ時は少し薄い色に */
  cursor: pointer; 
  font-weight: bold; 
  gap: 4px; /* アイコンと文字の隙間 */
}

.icon {
  font-size: 24px;
}

.text {
  font-size: 10px; /* 長い文字でも改行されないように少し小さく */
}

.nav-item.active { 
  color: #2169a3; /* Settloのテーマカラーに変更 */
}
</style>