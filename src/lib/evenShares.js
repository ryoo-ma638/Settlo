/** 全員均等。余りはUIDで指定された立替者にまとめる。入力は変更しない。 */
export function evenShares(participants, total, payerUid) {
  if (!Array.isArray(participants) || participants.length === 0) throw new Error('no-participants')
  const ids = new Set()
  for (const p of participants) {
    if (!p || typeof p.id !== 'string' || !p.id.trim() || typeof p.name !== 'string' || ids.has(p.id)) {
      throw new Error('invalid-participant')
    }
    ids.add(p.id)
  }
  if (!ids.has(payerUid)) throw new Error('invalid-payer')
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0 || total > 99999999) {
    throw new Error('invalid-amount')
  }
  const base = Math.floor(total / participants.length)
  const remainder = total - base * participants.length
  return participants.map(p => ({ uid: p.id, name: p.name, amount: base + (p.id === payerUid ? remainder : 0) }))
}
