// Gemini TTS は1回の生成が1分を超えたあたりで台本の位置を見失い、
// 台本にない文を読み上げることがあるため、段落単位の短いチャンクに分けて呼び出す。

/** これより短い段落は次の段落とまとめる（タイトル行や「それでは〜」の一文など） */
export const MIN_CHUNK_CHARS = 120;
/** 1チャンクの上限。日本語の読み上げで1分弱に相当 */
export const MAX_CHUNK_CHARS = 350;

/** 文末（。！？）で文に分割する。区切り文字は前の文に残す */
function splitSentences(paragraph: string): string[] {
  return paragraph.match(/[^。！？!?]+[。！？!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

/** 上限を超える段落を、文の境界で上限以内のかたまりに分ける */
function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const sentence of splitSentences(paragraph)) {
    if (current && current.length + sentence.length > maxChars) {
      pieces.push(current);
      current = '';
    }
    current += sentence;
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * テキストを TTS 用のチャンクに分割する。
 * 段落（空行区切り）を単位とし、短い段落は次とまとめ、長い段落は文で分割する。
 * まとめた段落同士は改行で区切ったまま残す。
 */
export function splitIntoChunks(
  text: string,
  minChars: number = MIN_CHUNK_CHARS,
  maxChars: number = MAX_CHUNK_CHARS,
): string[] {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\r?\n/g, '').trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > maxChars ? splitLongParagraph(p, maxChars) : [p]));

  const chunks: string[] = [];
  let pending = '';
  for (const paragraph of paragraphs) {
    const merged = pending ? `${pending}\n\n${paragraph}` : paragraph;
    if (pending && merged.length > maxChars) {
      chunks.push(pending);
      pending = paragraph;
    } else {
      pending = merged;
    }
    if (pending.length >= minChars) {
      chunks.push(pending);
      pending = '';
    }
  }
  if (pending) {
    // 末尾の短い段落は直前のチャンクに寄せる（上限を超えない場合のみ）
    const last = chunks[chunks.length - 1];
    if (last && last.length + pending.length + 2 <= maxChars) {
      chunks[chunks.length - 1] = `${last}\n\n${pending}`;
    } else {
      chunks.push(pending);
    }
  }
  return chunks;
}
