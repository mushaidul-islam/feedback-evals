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

For local development, add `http://localhost:3000/api/auth/google/callback` to the Google OAuth client's authorized redirect URIs. Use `http://localhost:3000/login` to start sign-in.

Set `API_URL` to the Go backend's URL as seen from the Next.js server. It defaults to `http://localhost:8080` for local development.

Creators sign in at `/login`. The button links to `/api/auth/google/start`, which sends the browser to Google. Google returns to `/api/auth/google/callback` with a one-time code; that route trades the code with Google for an ID token (this needs the client secret, so it happens on the server), has the Go API verify it, and stores the resulting session token in an http-only `tbt_session` cookie. Browser code never sees the token. A random `state` value in a short-lived cookie makes sure the sign-in started on this site.

Campaign and feedback pages load data through same-origin Next.js API routes, which forward the token as `Authorization: Bearer <token>` on protected backend calls. `src/proxy.ts` sends visitors without the cookie to `/login` from every page except `/login` itself and the public `/f/...` collection pages. If the API rejects an old cookie, the page redirects to `/login` too. `/` redirects to `/c`.

`/c` lists your campaigns and creates new ones. `/c/<campaign-id>` shows saved feedback and links to the public `/f/c/<campaign-id>` collection page. You only see campaigns you created. The collection page shows “sent” immediately when a valid message is submitted, then sends it in the background. It does not check the API result or retry, so the message can be shown even when no feedback was saved.

The creation form uses a 75/25 split for the campaign name and button from the small-screen breakpoint upward, and stacks them on narrower screens. The button keeps its size and position while creating. An optional content link accepts HTTPS post or video URLs from YouTube, X, TikTok, LinkedIn, Facebook, and Instagram. The public page shows the creator's Google display name followed by "is asking for feedback", then the campaign name and linked content. A missing display name uses "Someone".

Embeds use the provider's player or widget. The original link is always available because private, removed, or restricted posts and browser settings can prevent an embed from loading. Short TikTok share links show the original link; use a full `/@username/video/id` or `/@username/photo/id` URL for an embedded player. LinkedIn supports public posts with an activity, share, or ugcPost identifier. No media files or pasted embed HTML are accepted. The feedback classifier still receives the campaign name and submitted feedback text, not the contents of the external post or video.

## Campaign regression tests

Playwright tests are in `tests/campaign.spec.ts` and `tests/collection.spec.ts`. Install the Playwright Chromium browser and start the frontend and Go API. Public-page tests have passed against the local app; creation-layout tests require a configured test session. Put a valid local test-account session token in the ignored `.env.local` as `TBT_TEST_SESSION`, and an existing campaign ID with a content link as `TBT_TEST_CAMPAIGN_ID`. Run `bun run test:ui`. `PLAYWRIGHT_BASE_URL` optionally changes the default `http://localhost:3000`.

The layout tests use the real app session and delay then abort the creation request so no test campaign is saved. They compare the button's position and dimensions before and during creation at desktop, tablet, and mobile widths. The public-page test uses the real API and deliberately blocks the provider request to cover the original-link fallback. Tests requiring missing session or campaign settings are skipped. The test session is a credential and must stay out of Git and test output.

The public collection page displays the creator’s Google photo with an initials fallback. Existing accounts receive their photo on their next Google sign-in. The campaign prompt uses the existing yellow highlight and display font. At desktop widths (1024px and above), content appears on the left and feedback stays alongside it on the right. Smaller screens start with a collapsed “View content” bar; opening or closing it preserves the feedback draft. Transitions respect reduced-motion preferences.

Instagram and X use their provider scripts so the provider can size the embed. YouTube uses a responsive video ratio; the remaining iframe providers use provider-specific dimensions. Cross-origin contents cannot be restyled by this app, and provider restrictions may still prevent playback or introduce internal scrolling. The original link remains available. Run `TBT_TEST_CAMPAIGN_ID=<campaign-with-content> bunx playwright test tests/collection.spec.ts` against the running app to check desktop placement, mobile disclosure, draft preservation, and horizontal overflow.

## Layout and sharing

Campaign detail, dashboard, and sign-in use the collection page’s highlighted display headings, cream background, black borders, and spacious desktop columns. The dashboard places creation alongside existing campaigns. Campaign detail places content alongside received feedback. `CampaignPreview` supplies the same mobile disclosure on both public and creator pages.

The campaign’s “Share campaign” action and each response’s “Share feedback” action open an accessible preview dialog. Cards are generated locally with Canvas and the existing fonts; private feedback is not uploaded to an image service or exposed through a public feedback URL. Each PNG is 1080×1920, includes the selected text and a QR code to the public collection page, and can be downloaded. Image text comes directly from the campaign or saved feedback and cannot be edited. Text wraps at a readable size; overflow ends with an ellipsis inside the image. Saved feedback is never truncated.

Where the browser supports file sharing, a prepared PNG is passed directly to the system share menu on the next click, preserving user activation. The destination depends on installed apps and browser support. Cancelling does not download or publish anything. Unsupported or failed sharing retains download and copy-link actions. X and WhatsApp link composers are available; images must be attached manually there. Instagram/TikTok users can choose their app from the native menu or upload the downloaded card, then add a link sticker where supported. PNGs cannot contain clickable links.

Collection URLs use the current site origin. On localhost, the dialog explains that links/QR codes will not work for other people; use a published HTTPS site for real mobile sharing. There are no hard-coded production domains, social credentials, or publishing calls.

`tests/sharing.spec.ts` uses a real local campaign, owner session, and saved response. Set `TBT_TEST_SESSION` and `TBT_TEST_CAMPAIGN_ID` before running `bun run test:ui`. It checks desktop/mobile placement, modal focus, PNG dimensions, decoding the exported QR to the collection URL, clipboard copying, removal of image text editing, long-feedback export without changing saved records, and narrow dashboard/sign-in layouts. Native share menus need a supported real device/browser; the PNG share and cancellation were checked in desktop Chrome. The suite does not publish to social accounts.

UI copy uses a casual, restrained voice: full sentences for guidance, plain action
labels, and no repeated slogan fragments. The campaign-name example remains visible
below the input. Empty inboxes reuse the main sharing action rather than adding a
second button.

Share cards include a small source stamp when content is linked. YouTube cards use
the video's public thumbnail through Next.js's built-in image optimizer, restricted
to HTTPS `i.ytimg.com/vi/*/hqdefault.jpg` with redirects disabled. The iframe is not
captured. Other platforms, missing images, or blocked/timed-out thumbnails use a
source label; PNG downloads and QR codes still work. Only the public thumbnail is
fetched by the server; feedback text continues to be drawn locally. The sharing
regression checks inspect thumbnail pixels in the exported PNG and cover export
when thumbnail loading is blocked.
