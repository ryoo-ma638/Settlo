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
        </div>
        </main>
    </div>
</template>

<style>
.event-container {
    display: flex;
    justify-content: center;
    padding: 20px;
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
    width: 95%;
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
</style>