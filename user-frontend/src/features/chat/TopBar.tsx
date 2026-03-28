import { useAuthStore } from '@/features/auth/authStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { useState, useRef, useEffect } from 'react';

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openModal = useUIStore((s) => s.openModal);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="top-bar">
      <button
        className="hamburger-btn"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
      <h1 className="top-bar-title">PhiloGPT</h1>
      <div className="user-menu" ref={menuRef}>
        <button
          className="user-menu-trigger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          {user?.email ?? 'User'}
        </button>
        {menuOpen && (
          <div className="user-menu-dropdown" role="menu">
            <button
              role="menuitem"
              onClick={() => { openModal('profile'); setMenuOpen(false); }}
            >
              Profile
            </button>
            <button
              role="menuitem"
              onClick={() => { openModal('memory'); setMenuOpen(false); }}
            >
              My Memory
            </button>
            <hr />
            <button
              role="menuitem"
              onClick={() => { logout(); }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
