// TTS に渡す前に、読み上げが不自然に途切れる原因になる表記を整える。
// Gemini 3.x TTS は "4,000" のような桁区切りカンマや全角カッコの補足で
// 読みの流れがリセットされ、言いかけて途切れることがあるため。

const PUNCTUATION = /[、。，．,.！？!?：:；;「」『』\s]/;

/** 数字の桁区切りカンマを除去する（例: "4,000" → "4000", "１，２００" → "１２００"） */
export function removeDigitGroupSeparators(text: string): string {
  return text.replace(/([0-9０-９])[,，](?=[0-9０-９]{3}(?![0-9０-９]))/g, '$1');
}

/**
 * カッコ書きの補足を読点で区切った挿入句にする
 * （例: "承認（自動レビュー）が" → "承認、自動レビュー、が"）。
 * 前後がすでに句読点なら読点を重ねない。
 */
export function flattenParentheses(text: string): string {
  return text.replace(/[（(]([^（）()\r\n]*)[）)]/g, (match, inner: string, offset: number) => {
    const body = inner.trim();
    if (!body) return '';
    const before = offset > 0 ? text[offset - 1] : '';
    const after = text[offset + match.length] ?? '';
    const lead = before && !PUNCTUATION.test(before) ? '、' : '';
    const tail = after && !PUNCTUATION.test(after) ? '、' : '';
    return `${lead}${body}${tail}`;
  });
}

export function normalizeForTts(text: string): string {
  return flattenParentheses(removeDigitGroupSeparators(text));
}
