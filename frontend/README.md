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

Copy `.env.example` to `.env.local` and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The client ID must match the backend's `GOOGLE_CLIENT_ID`. Restart `bun dev` after changing them.

Set `API_URL` to the Go backend's URL as seen from the Next.js server. It defaults to `http://localhost:8080` for local development.

Creators sign in at `/login`. The button links to `/api/auth/google/start`, which sends the browser to Google. Google returns to `/api/auth/google/callback` with a one-time code; that route trades the code with Google for an ID token (this needs the client secret, so it happens on the server), has the Go API verify it, and stores the resulting session token in an http-only `tbt_session` cookie. Browser code never sees the token. A random `state` value in a short-lived cookie makes sure the sign-in started on this site.

Campaign and feedback pages load data through same-origin Next.js API routes, which forward the token as `Authorization: Bearer <token>` on protected backend calls. `src/proxy.ts` sends visitors without the cookie to `/login` from every page except `/login` itself and the public `/f/...` collection pages. If the API rejects an old cookie, the page redirects to `/login` too. `/` redirects to `/c`.

`/c` lists your campaigns and creates new ones. `/c/<campaign-id>` shows saved feedback and links to the public `/f/c/<campaign-id>` collection page. You only see campaigns you created. The collection page shows “sent” immediately when a valid message is submitted, then sends it in the background. It does not check the API result or retry, so the message can be shown even when no feedback was saved.
