<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI component policy

Use [NeoBrutalism](https://neobrutalism.com/docs/installation) as the sole
component library for all interface work. The existing primitives in
`src/components/ui` are NeoBrutalism Base UI components; do not replace them
with another library or hand-built alternatives.

Before implementing any UI, check the
[NeoBrutalism component list](https://neobrutalism.com/docs/components) and
search the configured registry:

```bash
bunx --bun shadcn@latest list @neobrutalism-base
bunx --bun shadcn@latest search @neobrutalism-base
bunx --bun shadcn@latest add https://neobrutalism.com/r/base/<component>.json
```

Install the matching Base UI component through the official registry. Do not
use the NeoBrutalism Radix UI variant or a different component library. If the
registry does not provide the needed component, compose the available
NeoBrutalism primitives and raise the gap before adding a new custom primitive.
