'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { User } from '@/lib/api-types';

// Shows who is signed in, with a sign-out button.
export function AccountBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<User>) : null))
      .then((loaded) => {
        if (loaded && !controller.signal.aborted) setUser(loaded);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function signOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {user && <span className="font-mono text-sm">{user.email}</span>}
      <Button variant="outline" size="sm" onClick={signOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
