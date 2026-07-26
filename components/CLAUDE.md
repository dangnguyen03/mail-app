# components/

## components/ui/ — do not read these files

60+ **unmodified shadcn/ui** primitives (style `new-york`, base color `neutral`, CSS variables on,
lucide icons). They match upstream shadcn exactly. Assume the standard API; reading them costs tokens
and tells you nothing project-specific.

To add a primitive: `npx shadcn@latest add <name>` — `components.json` is already configured
(`@/components/ui`, `@/lib/utils`, css `app/globals.css`).

Two files here are **dead duplicates** — import from `@/hooks/` instead:

- `components/ui/use-toast.ts` → use `@/hooks/use-toast`
- `components/ui/use-mobile.tsx` → use `@/hooks/use-mobile`

`components/theme-provider.tsx` is also dead; there is no theme toggle in the app.

## What the app actually uses

`alert-dialog`, `alert`, `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`,
`progress`, `scroll-area`, `select`, `slider`, `table`, `tabs`, `textarea`, `toast`/`toaster`.
The rest (sidebar, carousel, chart, command, menubar, …) came with the scaffold and is unused.

## Theming

Tailwind v4, CSS-first. Tokens are oklch variables in `app/globals.css` under `:root` and `.dark`;
there is no `tailwind.config.js`. `styles/globals.css` is an orphan copy — edit `app/globals.css`.
