import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { hasCyrillic, translit } from './translit';
import { cx } from './cx';

export type Lang = 'cyr' | 'lat';
const KEY = 'qumash_lang';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const Ctx = createContext<LangCtx>({ lang: 'cyr', setLang: () => {} });

export function useLang(): LangCtx {
  return useContext(Ctx);
}

// Original (Cyrillic) text per node, so switching back to Cyrillic restores exactly.
const ORIG = new WeakMap<Text, string>();

function transliterateNode(node: Text): void {
  const text = node.data;
  if (!hasCyrillic(text)) return; // Latin / number / our own output → skip (no loop)
  ORIG.set(node, text);
  node.data = translit(text);
}
function restoreNode(node: Text): void {
  const o = ORIG.get(node);
  if (o !== undefined) {
    node.data = o;
    ORIG.delete(node);
  }
}
function eachText(root: Node, fn: (t: Text) => void): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) list.push(n as Text);
  list.forEach(fn);
}

/**
 * Provides the active script and applies a transliteration overlay.
 *
 * When `lang === 'lat'` every Cyrillic text node under #root is transliterated
 * in place, and a MutationObserver keeps newly-rendered/updated text in Latin.
 * Because only text-node content changes (never structure), React's reconciler
 * is unaffected. Switching back to `cyr` restores the stored originals.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem(KEY) === 'lat' ? 'lat' : 'cyr';
    } catch {
      return 'cyr';
    }
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore quota errors */
    }
  }, []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (lang !== 'lat') {
      eachText(root, restoreNode);
      return;
    }
    eachText(root, transliterateNode);
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          transliterateNode(m.target as Text);
        }
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) transliterateNode(node as Text);
          else if (node.nodeType === Node.ELEMENT_NODE) eachText(node, transliterateNode);
        });
      }
    });
    obs.observe(root, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

/** Кирил / Lotin script switcher. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/[0.09] bg-white/[0.04] p-[3px]">
      {(['cyr', 'lat'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={l === 'cyr' ? 'Кирилл' : 'Lotin'}
          className={cx(
            'rounded px-2 py-[3px] text-[11px] font-bold tracking-[1px] transition',
            lang === l ? 'bg-cyan/[0.13] text-cyan' : 'text-dim hover:text-text2',
          )}
        >
          {l === 'cyr' ? 'КИР' : 'LOT'}
        </button>
      ))}
    </div>
  );
}
