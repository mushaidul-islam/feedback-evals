import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  failed: 'Could not sign you in. Please try again.',
  config:
    'Sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in frontend/.env.local and restart the dev server.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const message = typeof error === 'string' ? (ERRORS[error] ?? ERRORS.failed) : '';

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
      <p className="font-head text-sm tracking-widest uppercase">Truth Be Told</p>
      <h1 className="font-head mt-4 text-5xl uppercase sm:text-6xl">Sign in</h1>
      <p className="mt-4 text-lg">
        Sign in to create campaigns and read the feedback they collect. People giving feedback
        never need an account.
      </p>
      {/* A plain link, not next/link: prefetching it would start a sign-in. */}
      <a href="/api/auth/google/start" className={buttonVariants({ size: 'lg', className: 'mt-10 self-start' })}>
        Sign in with Google
      </a>
      {message && (
        <Alert status="error" className="mt-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </main>
  );
}
