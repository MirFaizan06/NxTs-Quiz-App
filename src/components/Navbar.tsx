'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogoutButton } from './LogoutButton';
import { Logo } from './Logo';

export function Navbar({ signedIn, isAdmin, appName }: { signedIn: boolean; isAdmin: boolean; appName: string }) {
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <motion.header initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={'nav ' + (scrolled ? 'scrolled' : '')}>
      <div className="container navin">
        <Link href="/" className="brand"><span className="brand-mark"><Logo /></span>{appName}</Link>
        <nav className="row" style={{ gap: 6 }}>
          {signedIn ? (
            <>
              <Link className={'navlink ' + (path === '/lobbies' ? 'active' : '')} href="/lobbies">Lobbies</Link><Link className={'navlink ' + (path === '/join' ? 'active' : '')} href="/join">Join</Link><Link className={'navlink ' + (path === '/dashboard' ? 'active' : '')} href="/dashboard">Dashboard</Link>
              {isAdmin && <Link className={'navlink ' + (path.startsWith('/admin') ? 'active' : '')} href="/admin">Admin</Link>}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link className="navlink hide-sm" href="/#features">Features</Link>
              <Link className="navlink hide-sm" href="/#how">How it works</Link>
              <Link className="btn sm" href="/login">Sign in</Link>
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
