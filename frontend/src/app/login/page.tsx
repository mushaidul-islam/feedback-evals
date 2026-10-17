import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  failed: 'Could not sign you in. Please try again.',
  config: 'Sign-in is unavailable right now. Please try again later.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const message = typeof error === 'string' ? (ERRORS[error] ?? ERRORS.failed) : '';

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <p className="font-head text-sm tracking-widest uppercase">Truth Be Told / Welcome</p>
      <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h1 className="font-head text-4xl leading-[1.08] tracking-tight break-words sm:text-6xl lg:text-7xl">
            <span className="bg-primary box-decoration-clone px-1">Hear what people think.</span>
          </h1>
          <p className="mt-8 max-w-lg text-xl leading-relaxed">
            Share a question or something you’re working on. People can leave feedback without
            giving their name.
          </p>
        </div>
        <section
          aria-label="Sign in"
          className="min-w-0 border-2 border-black bg-white p-6 shadow-xl sm:p-10"
        >
          <h2 className="font-head text-3xl sm:text-4xl">Sign in</h2>
          <p className="mt-5 text-lg">
            Sign in to ask for feedback and read the replies. Anyone with your link can respond
            without an account.
          </p>
          {/* A plain link prevents prefetch from starting sign-in. */}
          {/* oxlint-disable-next-line nextjs/no-html-link-for-pages */}
          <a
            href="/api/auth/google/start"
            className={buttonVariants({
              size: 'lg',
              className: 'mt-8 whitespace-normal text-center',
            })}
          >
            Sign in with Google →
          </a>
          {message && (
            <Alert status="error" className="mt-6">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </section>
      </div>
    </main>
  );
}
