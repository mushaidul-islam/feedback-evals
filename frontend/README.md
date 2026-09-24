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

The Go service owns campaigns, feedback, and classification. The Next.js server
calls it for the dashboard and forwards public submissions.

Set `API_URL` to the Go backend's URL as seen from the Next.js server. It defaults to `http://localhost:8080` for local development. Campaign and feedback pages load data in the browser through same-origin Next.js API routes. Those routes add the temporary `Bearer test-key` header only for protected backend calls. The key must not go in a `NEXT_PUBLIC_*` variable.

`/c` lists campaigns and creates new ones. `/c/<campaign-id>` shows saved feedback and links to the public `/f/c/<campaign-id>` collection page. Anyone who can open the dashboard pages can read their contents during this test. The collection page shows “sent” immediately when a valid message is submitted, then sends it in the background. It does not check the API result or retry, so the message can be shown even when no feedback was saved.
