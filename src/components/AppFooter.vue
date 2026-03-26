<template>
    <nav class="bottom-nav">
      <div class="nav-item" :class="{ active: $route.path === '/' }" @click="$router.push('/')">🏠<br>ホーム</div>
      <div class="nav-item" :class="{ active: $route.path === '/payment' }" @click="$router.push('/payment')">💳<br>支払い</div>
      <div class="nav-item" :class="{ active: $route.path === '/friend' }" @click="$router.push('/friend')">👥<br>フレンド＆精算</div>
    </nav>
  </template>
  
  <style scoped>
  /* 松岡さんのフッターCSS */
  .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 85px; background-color: white; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #ddd; border-radius: 25px 25px 0 0; z-index: 100; }
  .nav-item { text-align: center; font-size: 12px; color: #333; cursor: pointer; font-weight: bold; }
  .nav-item.active { color: #3b82f6; }

  
  </style>