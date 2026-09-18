// 立て替えた人の名前をどう出すか。
//
// 参加者の名前は読み込みが終わるまで仮の「メンバー」になる。
// そのまま出すと、精算を確定した直後などに一瞬「メンバー が立替」と表示されてしまう。
// 記録に残っている名前（立て替えを保存したときの名前）の方が確かなので、そちらへ落とす。
// 参加者側の名前が本物に変わったら、改名にも追従できるようそちらを優先する。
export const NAME_PLACEHOLDER = 'メンバー';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

export function payerNameOf(history, participants = []) {
  const uid = history && history.payerUid;
  if (uid) {
    const found = (Array.isArray(participants) ? participants : []).find((p) => p && p.id === uid);
    const live = text(found && found.name);
    if (live && live !== NAME_PLACEHOLDER) return live;
  }
  return text(history && history.payer) || NAME_PLACEHOLDER;
}
