// 精算の保存（サーバー側で確定済み）のあとにだけ使う付随処理の待ち方。
// チャットへの経緯の投稿や解決済みの片付けが遅れても失敗しても、お金の更新は再送しない。
// 戻り値：付随処理に失敗や時間切れがあれば true（表示の参考にするだけで、保存の成否ではない）。
export async function settlementFollowUps(jobs, timeoutMs = 5000) {
  let timer;
  try {
    return await Promise.race([
      Promise.allSettled(jobs).then((results) => results.some((r) => r.status === 'rejected' || r.value === false)),
      new Promise((resolve) => { timer = setTimeout(() => resolve(true), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
