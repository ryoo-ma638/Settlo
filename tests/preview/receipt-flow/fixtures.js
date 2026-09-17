export const fixtures = [
  { name: '1枚目：金額1000円・日付あり', response: { storeName: '検証食堂・お弁当とお茶をまとめて購入したレシート', totalAmount: 1000, date: '2026-09-17', time: '12:34', currency: 'JPY', taxIncluded: true, registrationNumber: 'T1234567890123', pointsUsed: 100, items: [{name:'お弁当2個',lineTotal:1200,quantity:2,taxRate:8},{name:'値引',lineTotal:-200,quantity:1,taxRate:8}] } },
  { name: '2枚目：金額301円・日付不明', response: { storeName: '検証カフェ', totalAmount: 301, date: '', time: null, currency: 'JPY', taxIncluded: true, pointsUsed: null, registrationNumber: null, items: [{name:'コーヒー',lineTotal:301,quantity:1,taxRate:10}] } },
  { name: '3枚目：読み取り失敗', error: true },
  { name: '4枚目：金額780円・日付あり', response: { storeName: '検証スーパー', totalAmount: 780, date: '2026-09-16', time: '18:05', currency: 'JPY', taxIncluded: true, pointsUsed: null, registrationNumber: null, items: [{name:'食材',lineTotal:780,quantity:1,taxRate:8}] } },
  { name: '5枚目：金額450円・日付あり', response: { storeName: '検証パン店', totalAmount: 450, date: '2026-09-15', time: '08:10', currency: 'JPY', taxIncluded: true, pointsUsed: null, registrationNumber: null, items: [{name:'パン',lineTotal:450,quantity:1,taxRate:8}] } },
];
export function fixtureFile(index) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420"><rect width="320" height="420" fill="white"/><text x="20" y="40" fill="black">fixture-${index + 1}</text><text x="20" y="80" fill="black">LOCAL TEST RECEIPT</text></svg>`;
  return new File([svg], `receipt-${index+1}.svg`, {type:'image/svg+xml'});
}
export function fixtureResponse(image) {
  const encoded = String(image).split(',')[1] || '';
  const match = atob(encoded).match(/fixture-([1-5])/);
  if (!match) throw new Error('検証用画像だけを読み取れます');
  const fixture = fixtures[Number(match[1]) - 1];
  if (fixture.error) throw new Error('mock-read-failed');
  return { data: structuredClone(fixture.response) };
}
