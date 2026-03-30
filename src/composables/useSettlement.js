// src/composables/useSettlement.js
import { computed } from 'vue';

// 割り勘の計算を行う専用の関数（ツール）
export function useSettlement(eventData, myName) {
  
  const calculatedSummary = computed(() => {
    const rawDebts = [];
    
    // 1. まず全ての「誰から誰へ、いくら」の生の借金データを洗い出す
    eventData.value.history.forEach(history => {
      let creditor = history.payer;
      
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
        
        const fromColor = eventData.value.participants.find(p => p.name === finalFrom)?.color || '#ccc';
        const toColor = eventData.value.participants.find(p => p.name === finalTo)?.color || '#ccc';
        
        aggregated.push({
          id: `${status}-${key}`,
          from: finalFrom, fromColor,
          to: finalTo, toColor,
          amount: finalAmount,
          status: status,
          isMePayer: (finalTo === myName), 
          involvesMe: (finalFrom === myName || finalTo === myName),
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