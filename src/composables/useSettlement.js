// src/composables/useSettlement.js
import { computed, unref } from 'vue';

// 名前から安定した淡い色を作る（写真URLしか持たない参加者の小アバター用フォールバック）
function colorFromName(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 70%)`;
}

// 割り勘の計算を行う専用の関数（ツール）
// myName は文字列でも ref でもOK（実データ取得後に反応できるよう unref で読む）
export function useSettlement(eventData, myName) {

  const calculatedSummary = computed(() => {
    const me = unref(myName);
    const rawDebts = [];

    // 小アバターは背景色で描くため、写真URL(http)を持つ人は名前ベースの色に置き換える
    const colorByName = (nm) => {
      const c = eventData.value.participants.find(p => p.name === nm)?.color;
      return (c && !String(c).startsWith('http')) ? c : colorFromName(nm);
    };
    // その人の写真URL（あれば実アイコンを表示するため）
    const photoByName = (nm) => {
      const c = eventData.value.participants.find(p => p.name === nm)?.color;
      return (c && String(c).startsWith('http')) ? c : '';
    };
    
    // 1. まず全ての「誰から誰へ、いくら」の生の借金データを洗い出す
    eventData.value.history.forEach(history => {
      let creditor = history.payer;

      // 🌟 shares（各メンバーの負担額）があれば、それを正として債務を作る（all/custom/item 全対応）
      if (Array.isArray(history.shares) && history.shares.length > 0) {
        history.shares.forEach(s => {
          if (s && s.name && s.name !== creditor && Number(s.amount) > 0) {
            rawDebts.push({
              from: s.name, to: creditor,
              amount: Number(s.amount), itemName: history.itemName, status: history.status
            });
          }
        });
        return; // この履歴は shares で処理済み
      }

      // 後方互換：shares が無い古い履歴は従来ロジック
      if (history.splitType === 'all' || history.splitType === '全員で割勘') {
        const amountPerPerson = Math.floor(history.amount / eventData.value.participants.length);
        eventData.value.participants.forEach(p => {
          if (p.name !== creditor) {
            rawDebts.push({
              from: p.name, to: creditor,
              amount: amountPerPerson, itemName: history.itemName, status: history.status
            });
          }
        });
      } 
      else if (history.splitType === 'item' && history.items) {
        history.items.forEach(item => {
          if (item.assignees && item.assignees.length > 0) {
            const itemAmount = Math.floor(item.price / item.assignees.length);
            item.assignees.forEach(assignee => {
              if (assignee !== creditor) {
                rawDebts.push({
                  from: assignee, to: creditor,
                  amount: itemAmount, itemName: item.name, status: history.status
                });
              }
            });
          }
        });
      }
    });

    // 2. 洗い出した借金データを「ステータス」と「2人のペア」ごとにグループ化して相殺（ネット）する
    const aggregated = [];
    const statuses = ['unpaid', 'completed'];
    
    statuses.forEach(status => {
      const debtsForStatus = rawDebts.filter(d => d.status === status);
      const pairs = {}; 
      
      debtsForStatus.forEach(debt => {
        const personA = debt.from < debt.to ? debt.from : debt.to;
        const personB = debt.from < debt.to ? debt.to : debt.from;
        const key = `${personA}|${personB}`;
        
        if (!pairs[key]) pairs[key] = { netA: 0, details: [] };
        
        if (debt.from === personA) {
          pairs[key].netA -= debt.amount;
        } else {
          pairs[key].netA += debt.amount; 
        }
        pairs[key].details.push(debt); 
      });

      // 3. 相殺された結果から、最終的な「サマリーカード」を生成
      Object.keys(pairs).forEach(key => {
        const [personA, personB] = key.split('|');
        const netA = pairs[key].netA;
        const details = pairs[key].details;
        
        if (netA === 0) return; 
        
        let finalFrom, finalTo, finalAmount;
        if (netA < 0) {
          finalFrom = personA; finalTo = personB; finalAmount = Math.abs(netA);
        } else {
          finalFrom = personB; finalTo = personA; finalAmount = netA;
        }
        
        const fromColor = colorByName(finalFrom);
        const toColor = colorByName(finalTo);
        
        aggregated.push({
          id: `${status}-${key}`,
          from: finalFrom, fromColor, fromPhoto: photoByName(finalFrom),
          to: finalTo, toColor, toPhoto: photoByName(finalTo),
          amount: finalAmount,
          status: status,
          isMePayer: (finalTo === me),
          involvesMe: (finalFrom === me || finalTo === me),
          details: details
        });
      });
    });
    
    return aggregated;
  });

  // 計算結果を外に渡す
  return {
    calculatedSummary
  };
}