// Uzbek Cyrillic → Latin transliteration.
//
// The UI is one language (Uzbek) in two scripts, so switching is a deterministic
// transliteration rather than translation. Non-Cyrillic characters (Latin words,
// numbers, punctuation, emoji, HTML tags) pass through unchanged.

const MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: 'ʼ',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: 'oʻ',
  қ: 'q',
  ғ: 'gʻ',
  ҳ: 'h',
};

const CYRILLIC = /[Ѐ-ӿ]/;
const UPPER_CYR = /[А-ЯЁЎҒҚҲ]/;
const LOWER_CYR = /[а-яёўғқҳ]/;

/** True if the string contains any Cyrillic letter. */
export function hasCyrillic(s: string): boolean {
  return CYRILLIC.test(s);
}

/** Transliterate Uzbek Cyrillic text to Latin. Leaves non-Cyrillic intact. */
export function translit(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const lower = ch.toLowerCase();
    const mapped = MAP[lower];
    if (mapped === undefined) {
      out += ch; // not Cyrillic — keep as-is
      continue;
    }
    if (ch === lower || mapped === '') {
      out += mapped; // lowercase, or soft-sign (dropped)
      continue;
    }
    if (mapped.length === 1) {
      out += mapped.toUpperCase();
      continue;
    }
    // Uppercase letter that maps to a digraph (Ш→Sh/SH, Ў→Oʻ/Oʻ…).
    // Use an all-caps digraph when the surrounding context is uppercase
    // (e.g. "ШАМ" → "SHAM"), otherwise title-case ("Шам" → "Sham").
    const allCaps =
      UPPER_CYR.test(s[i + 1] ?? '') ||
      UPPER_CYR.test(s[i - 1] ?? '') ||
      !LOWER_CYR.test(s[i + 1] ?? '');
    out += allCaps ? mapped.toUpperCase() : mapped[0].toUpperCase() + mapped.slice(1);
  }
  return out;
}
