# Feedback Evals frontend

A Next.js App Router frontend using Bun, TypeScript, Tailwind CSS, Oxlint, and Oxfmt.

## Development

```bash
bun dev
```

Open http://localhost:3000.

```bash
bun run check
bun run build
```

## API and authentication

The frontend should treat a Go service as the API authority. Keep application secrets and database access in Go; the frontend only receives an authenticated session or short-lived access token.

When the Go backend is added, configure its public URL as `NEXT_PUBLIC_API_URL` in `.env.local`. Do not place private signing keys or provider secrets in `NEXT_PUBLIC_*` variables.
