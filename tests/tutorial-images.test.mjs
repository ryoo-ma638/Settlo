import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const files = ['src/views/HelpView.vue', 'src/components/OnboardingModal.vue'];

test('使い方の画面で指している写真が、実際に置いてある', () => {
  // 写真を足さずに説明だけ増やすと、枠だけ空いた画面になる
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const names = new Set([
      ...[...source.matchAll(/tutorialImage\('([^']+)'\)/g)].map((m) => m[1]),
      ...[...source.matchAll(/img:\s*'([^']+)'/g)].map((m) => `${m[1]}.jpg`),
    ]);
    assert.ok(names.size > 0, `${path} が写真を1枚も指していない`);
    for (const name of names) {
      assert.ok(existsSync(`public/tutorial/${name}`), `${path} が指す ${name} が無い`);
    }
  }
});

test('同じ写真を別の説明に使い回していない', () => {
  // 中身と合わない写真が付くと、読んだ人が混乱する
  const source = readFileSync('src/views/HelpView.vue', 'utf8');
  const used = [...source.matchAll(/img:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(used.length, new Set(used).size, `同じ写真が2か所で使われている: ${used.join(', ')}`);
});

// JPEG の先頭から縦横を読む（画像ライブラリを足さずに済ませる）
function jpegSize(path) {
  const buf = readFileSync(path);
  let i = 2; // 先頭の FFD8 を飛ばす
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error(`縦横を読めない: ${path}`);
}

test('はじめてガイドの写真が、スマホの枠と同じ形になっている', () => {
  // 枠は縦長で固定してある。形の違う写真を入れると下が白く空いて、
  // 画面が崩れているように見える（2026-09-19 に実際に出た）。
  const source = readFileSync('src/components/OnboardingModal.vue', 'utf8');
  const frame = /aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/.exec(source);
  assert.ok(frame, '枠の形が決まっていない');
  const want = Number(frame[2]) / Number(frame[1]);
  const names = [...source.matchAll(/tutorialImage\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(names.length > 0, '写真を1枚も指していない');
  for (const name of names) {
    const { width, height } = jpegSize(`public/tutorial/${name}`);
    const ratio = height / width;
    assert.ok(
      Math.abs(ratio - want) / want < 0.02,
      `${name} は ${width}x${height}。枠は ${frame[1]}x${frame[2]} の形なので、余白が出る`
    );
  }
});

test('はじめてガイドは、低い窓でも下のボタンまで入る', () => {
  // 写真の高さを決め打ちにすると、窓が低いとき写真だけで埋まり
  // 「スキップ」が見えなくなる（カードはスクロールできるが気づけない）。
  const source = readFileSync('src/components/OnboardingModal.vue', 'utf8');
  const shot = /\n\.ob-shot \{([^}]*)\}/.exec(source);
  assert.ok(shot, '写真の枠の指定が無い');
  assert.match(shot[1], /100dvh/, '写真の高さが画面の高さに合わせて縮まない');
  assert.match(shot[1], /clamp\(/, '縮みすぎ・伸びすぎの歯止めが無い');
  assert.match(source, /max-height:\s*calc\(100dvh - \d+px\)/, 'カードの高さに上限が無い');
  assert.match(source, /overflow-y:\s*auto/, '最後の手段のスクロールが無い');
});
