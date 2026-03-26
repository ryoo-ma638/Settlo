<template>
    <div class="event-container">
        
        <main class="content">
            <div class="flex-between">
                <span class="list-title">進行中のイベント</span>
                <button class="link-button" @click="$router.push('/payment')">精算を確認する</button>
            </div>
            <div class="event-card" v-for="i in 5" :key="i">
            <div class="event-tag" :class="{ gray: i > 1 }">イベント{{ i }}</div>
            <div class="event-info">
              <h3 class="event-name">イベント名 {{ i }}</h3>
              <div class="member-icons">
                <span class="circle c1"></span><span class="circle c2"></span><span class="circle c3"></span>
              </div>
           </div>
            <div class="event-amount">合計金額</div>
            <!-- <div 
            class="event-card" 
            v-for="(color, index) in ['#ff9980', '#ffee10', '#ff0000', '#889900', '#776666']" 
            :key="index"
            >
            <div class="event-avatar" :style="{ backgroundColor: color }"></div>
            <span class="event-name-text">イベント名</span>
            </div> -->
        </div>
        </main>
    </div>
</template>

<style>
.event-container {
    display: flex;
    justify-content: center;
    padding:  20px;
}
.content {
    width: 100%;
}
.flex-between{
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.list-title {
    font-size: 24px;
    margin-bottom: 20px;
}
.link-button {
    display: inline-block;
    margin-bottom: 20px;
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}.link-button:hover {
    background-color: #0056b3;
}
.event-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    background-color: #f9f9f9;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 20px;
    width: 100%;
}
.event-tag {
    padding: 5px 10px;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    font-size: 14px;
}
.event-tag.gray {
    background-color: #6c757d;
}
.event-info {
    display: flex;
    flex-direction: column;
    margin-left: 15px;
    flex: 1;
}
.event-name {
    font-size: 18px;
    margin: 0;
}
.member-icons {
    margin-top: 5px;
}
.circle {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    margin-right: 5px;
}
.c1 { background-color: #ff9980; }
.c2 { background-color: #ffee10; }
.c3 { background-color: #ff0000; }
.event-amount {
    font-size: 16px;
    font-weight: bold;
}

/* .event-container {
    padding: 30px 20px;
    text-align: center;
    background-color: #f0f4f8; 
    min-height: calc(100vh - 175px);
    font-family: 'Noto Sans JP', sans-serif;
}
.add-event-main-button {
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    font-size: 16px;
    cursor: pointer;
    margin-bottom: 30px;
}
.add-event-main-button:hover {
    background-color: #45a049;
}
.list-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 20px;
}
.event-list {    
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
}
.event-card {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    width: 150px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s;
}
.event-card:hover {
    transform: translateY(-5px);
}
.event-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin-bottom: 15px;
}
.event-name-text {
    font-size: 16px;
    font-weight: bold;
}
.event-list-container { background-color: #dcdcdc; padding: 15px; border-radius: 10px; }
.event-item { background-color: white; border-radius: 15px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; }
.event-tag { background-color: #3b82f6; color: white; font-size: 10px; padding: 8px 4px; border-radius: 8px; width: 50px; text-align: center; margin-right: 12px; }
.event-tag.gray { background-color: #999; }
.event-info { flex: 1; }
.event-name { font-size: 16px; margin: 0 0 4px 0; }
.member-icons { display: flex; gap: 4px; }
.circle { width: 18px; height: 18px; border-radius: 50%; }
.c1 { background-color: #fca5a5; } .c2 { background-color: #93c5fd; } .c3 { background-color: #86efac; }
.event-amount { font-size: 13px; font-weight: bold; } */
</style>