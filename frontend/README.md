# Feedback Evals frontend

A Next.js App Router frontend using Bun, TypeScript, Tailwind CSS, Oxlint, and Oxfmt.

## UI components

This project uses [NeoBrutalism](https://neobrutalism.com/docs/installation)
exclusively through its Base UI variant. Its registry is configured in
`components.json`. Before adding UI, check the
[component list](https://neobrutalism.com/docs/components) and run:

```bash
bunx --bun shadcn@latest list @neobrutalism-base
bunx --bun shadcn@latest search @neobrutalism-base
bunx --bun shadcn@latest add https://neobrutalism.com/r/base/<component>.json
```

Install a Base UI component from the registry rather than another library or a
custom primitive. Do not use the Radix UI variant. If a component is
unavailable, compose existing NeoBrutalism components and record the gap before
proposing a new primitive.

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
