'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn ghost sm" disabled={busy} onClick={async () => {
      setBusy(true);
      await createSupabaseBrowser().auth.signOut();
      location.href = '/';
    }}>{busy ? 'Signing out…' : 'Sign out'}</button>
  );
}
