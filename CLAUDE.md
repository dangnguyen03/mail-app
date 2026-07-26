# mailv3 — Email Tracker

Bulk email sending + reply tracking via Gmail API. **No backend database** — all data lives in the
browser's IndexedDB. Next.js exists only for the UI shell and 3 tiny NextAuth routes.

## Commands

```bash
pnpm dev      # dev server (port 3000)
pnpm build    # next build
pnpm start    # production server
pnpm lint     # eslint
```

Docker: `Dockerfile` is a 4-stage node:20-alpine build using **npm** (`npm ci` + `package-lock.json`),
not pnpm. Image published as `dangnguyenpy/mail-app:latest`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.7 · Tailwind v4 (CSS-first, no tailwind.config)
· shadcn/ui (new-york, neutral) · NextAuth v4 (Google) · TipTap 3 · xlsx (SheetJS) · Dexie **not**
installed despite one stale import — see Dead code.

`@/*` → repo root. `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so **type errors do
not fail the build** — this is why broken dead files survive. Run `npx tsc --noEmit` to see real errors.

## Architecture in one pass

```
Browser (all state)                         Server (thin)
──────────────────────────────────────      ──────────────────────────────
app/page.tsx      orchestrator, all         app/api/auth/[...nextauth]  NextAuth handler
                  dialog + tab state        app/api/auth/config-status  {isConfigured}
app/hooks/*       IndexedDB-backed state    app/api/gmail/token         {accessToken} (fresh)
lib/indexeddb.ts  raw IndexedDB wrapper     lib/auth.ts                 authOptions + refresh
lib/gmail.ts      Gmail REST from browser
```

Gmail API is called **directly from the browser** with a Bearer token. The server never proxies mail.

### Data flow

1. `TokenProvider` (app/components/provider) wraps NextAuth `SessionProvider`; exposes
   `{ token, clearToken, isLoading, refreshToken }`. `token` = `session.accessToken`.
2. `page.tsx` calls `useContacts()` / `useTemplates()` / `useCampaigns()`. Each hook calls `initDB()`
   then loads its store, keeps a React-state mirror, and writes through to IndexedDB.
3. Dialogs receive data + callbacks as props. They construct `new GmailService(token)` themselves.
4. Before any send, dialogs call `refreshToken()` (hits `/api/gmail/token`, which auto-refreshes via
   the NextAuth JWT callback) and use that token instead of the prop.

### Auth

`lib/auth.ts` reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (fallback `AUTH_GOOGLE_ID`/
`AUTH_GOOGLE_SECRET`), rejecting placeholder values. Scope required:
`https://www.googleapis.com/auth/gmail.modify`. If Google grants sign-in without that scope the JWT
gets `error: 'MissingGmailScope'` and `session.accessToken` is deliberately `undefined`.
Access token refreshed in the `jwt` callback with a 60s buffer; failure sets
`error: 'RefreshAccessTokenError'`.

Env vars live in `.env.local` (git-ignored): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`. **Never read or print this file.**

## Directory map — read these, skip the rest

| Path | What | Read it? |
|---|---|---|
| `app/page.tsx` | Single page. All dialog/tab/campaign state, all handlers. 600 lines. | yes, for any UI change |
| `app/components/dialogs/` | Token, Import, Template, Send, Resend, ReplyPreview | yes |
| `app/components/RichTextEditor.tsx` | TipTap editor + image compression + signature paste | yes |
| `app/hooks/` | useContacts, useTemplates, useCampaigns, useReplyTracking | yes |
| `lib/gmail.ts`, `lib/indexeddb.ts`, `lib/types.ts` | see [lib/CLAUDE.md](lib/CLAUDE.md) | yes |
| `components/ui/` | 60+ **unmodified shadcn/ui** primitives | **no** — assume standard shadcn API |
| `app/globals.css` | Tailwind v4 theme, oklch tokens | rarely |
| `python/` | throwaway pandas scripts to make sample xlsx. Git-ignored. | no |
| `public/`, `.next/`, `node_modules/` | assets / build output | no |

## Dead code — do not extend, do not use as reference

These are stale, unimported, and several would not compile if type-checking were on:

- `app/hooks/indexeddb.ts` — Dexie version. `dexie` is **not** a dependency; imports `./types` which
  doesn't exist. Superseded by `lib/indexeddb.ts`.
- `app/components/dialogs/useContacts.ts` — imports `{ db }` from `@/lib/indexeddb`, which exports no
  `db`. Superseded by `app/hooks/useContacts.ts`.
- `app/components/dialogs/gmail.ts` — earlier `GmailService` with no threading support. Superseded by
  `lib/gmail.ts`.
- `app/components/contacts/types.ts` — stale duplicate of `lib/types.ts` (missing campaignId,
  rfc822MessageId, threadIndex, bodyType).
- `lib/storage.ts` — sessionStorage token helpers, obsolete since the OAuth migration.
- `app/hooks/useSendLog.ts` — works, but nothing imports it; the `sendLog` store is never written.
- `components/ui/use-toast.ts` + `components/ui/use-mobile.tsx` — byte-identical duplicates of
  `hooks/use-toast.ts` / `hooks/use-mobile.ts`, which are the ones actually imported.
- `styles/globals.css` — orphan; the real stylesheet is `app/globals.css`.
- `components/theme-provider.tsx` — never mounted; there is no dark-mode toggle.

**Canonical modules:** `lib/types.ts`, `lib/indexeddb.ts`, `lib/gmail.ts`, `app/hooks/*`,
`hooks/use-toast.ts`.

## Conventions

- No semicolons, single quotes, 2-space indent. Named exports for components.
- Every interactive component starts with `'use client'`.
- Feedback via `useToast()` from `@/hooks/use-toast` (not sonner, despite the dep). **Caveat:
  `<Toaster />` is not mounted in `layout.tsx`, so every `toast()` call in `page.tsx` is currently
  invisible.** Fix by adding `<Toaster />` from `@/components/ui/toaster` inside the body.
- Destructive actions use shadcn `AlertDialog`, never `window.confirm`. Confirm state is held in
  `page.tsx` as `deleteContactId` / `showClearAllConfirm` / `deleteCampaignId`.
- UI copy is a **mix of English and Vietnamese** — SendDialog's progress/result strings are Vietnamese,
  most other copy is English. Match the surrounding file; don't "fix" one or the other.
- `{{name}}` is the only template variable; interpolation is a literal
  `.replace(/{{name}}/g, contact.name)` done at each send site.
- No test framework, no CI, no ESLint config file in the repo.

## Gotchas

- IndexedDB is opened at **version 3** with migrations in `lib/indexeddb.ts`. Bumping the version
  requires an `oldVersion` branch — see [lib/CLAUDE.md](lib/CLAUDE.md).
- `getDB()` throws if `initDB()` hasn't run. Every hook awaits `initDB()` first.
- Reply polling is 60s and stops on unmount; it reads contacts from a ref, so restarting isn't needed
  when the contact list changes.
- Bulk send refreshes the token every 50 min mid-loop so long runs don't die at the 1h expiry.
- Radix's scroll lock (`body { overflow: hidden }`) makes the viewport unscrollable and the browser
  clamps the offset, so opening any dialog used to jump the page to the top. `useScrollLockPreserve()`
  in `page.tsx` snapshots and restores it — don't remove it.
- Reply HTML is rendered with `dangerouslySetInnerHTML` and is **not sanitized** (ReplyPreviewDialog,
  ResendDialog, SendDialog previews). Known, accepted for a local single-user tool.

## Docs

`README.md` — end-user guide (setup, OAuth Playground, troubleshooting).
`WORKFLOW.md` — Vietnamese step-by-step for obtaining a Gmail token / configuring Google Cloud.
Both are user-facing; neither describes the code.
