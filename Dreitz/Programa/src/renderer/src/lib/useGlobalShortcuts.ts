import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGlobalShortcuts({
  onPalette,
  onShortcuts
}: {
  onPalette: () => void;
  onShortcuts: () => void;
}) {
  const nav = useNavigate();

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    }

    function onKey(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K → command palette (allowed even while typing)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onPalette();
        return;
      }
      if (isTyping(e.target)) return;

      // ? → shortcuts overlay
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onShortcuts();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); nav('/store'); break;
          case 'l': e.preventDefault(); nav('/library'); break;
          case 'b': e.preventDefault(); nav('/cart'); break;
          case ',': e.preventDefault(); (window.api as any).settingsOpen?.(); break;
          case 'p': e.preventDefault(); nav('/profile'); break;
          case 'f': e.preventDefault(); nav('/friends'); break;
          case 'm': e.preventDefault(); nav('/missions'); break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, onPalette, onShortcuts]);
}
