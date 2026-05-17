import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface UiCtx {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  friendsRailOpen: boolean;
  toggleFriendsRail: () => void;
  bigPicture: boolean;
  toggleBigPicture: () => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const Ctx = createContext<UiCtx>({
  sidebarCollapsed: false,
  toggleSidebar: () => {},
  friendsRailOpen: false,
  toggleFriendsRail: () => {},
  bigPicture: false,
  toggleBigPicture: () => {},
  cartOpen: false,
  openCart: () => {},
  closeCart: () => {},
  toggleCart: () => {}
});

export function UiProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem('dreitz.ui.sidebar') === 'collapsed');
  const [friendsRailOpen, setRail] = useState<boolean>(() => localStorage.getItem('dreitz.ui.friendsRail') === '1');
  const [bigPicture, setBig] = useState<boolean>(false);
  const [cartOpen, setCartOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('dreitz.ui.sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');
  }, [sidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem('dreitz.ui.friendsRail', friendsRailOpen ? '1' : '0');
  }, [friendsRailOpen]);

  // Big Picture: also tell main to fullscreen the window + add CSS class to root
  useEffect(() => {
    document.documentElement.classList.toggle('big-picture', bigPicture);
    try { window.api.windowFullscreen?.(bigPicture); } catch {}
  }, [bigPicture]);

  // F11 to toggle big picture
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F11' || (e.key === 'Escape' && bigPicture)) {
        e.preventDefault();
        setBig((v) => e.key === 'Escape' ? false : !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bigPicture]);

  return (
    <Ctx.Provider value={{
      sidebarCollapsed,
      toggleSidebar: () => setCollapsed((v) => !v),
      friendsRailOpen,
      toggleFriendsRail: () => setRail((v) => !v),
      bigPicture,
      toggleBigPicture: () => setBig((v) => !v),
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      toggleCart: () => setCartOpen((v) => !v)
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUi() { return useContext(Ctx); }
