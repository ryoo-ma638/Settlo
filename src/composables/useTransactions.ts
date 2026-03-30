// 送信するデータの形を定義
interface TransactionData {
  amount: number;
  description: string;
  eventId: number;
  payerUid: string;
}

export function useTransactions() {
  // 引数 'data' に型 'TransactionData' を指定
  const addTransaction = async (data: TransactionData) => {
    try {
  const response = await fetch('http://localhost:3000/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('ネットワークエラーが発生しました');
      }

      return await response.json();
    } catch (error) {
      console.error('エラーの詳細:', error);
      throw error;
    }
  };

  return {
    addTransaction,
  };
}