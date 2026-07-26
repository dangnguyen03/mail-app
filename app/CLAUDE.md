# app/ — UI layer

Single-page app. `layout.tsx` mounts `TokenProvider`; `page.tsx` is everything else.
Data models and Gmail behavior live in [../lib/CLAUDE.md](../lib/CLAUDE.md).

## page.tsx — the orchestrator

Owns **all** cross-component state; children are presentational and take props + callbacks.

State groups:
- dialog visibility: `showTokenDialog`, `showImportDialog`, `showTemplateDialog`, `showSendDialog`,
  `showResendDialog`, `showReplyPreviewDialog`
- selection: `selectedContactForResend`, `selectedContactForPreview`, `editingTemplate`, `resendMode`
- filters: `activeTab` (`'all' | 'replied' | 'not-replied'`), `activeCampaignId`
- confirm-dialogs: `deleteContactId`, `showClearAllConfirm`, `deleteCampaignId`

Render gates, in order: `tokenLoading` → spinner; `!token` → sign-in screen + TokenDialog;
otherwise the dashboard. Send/Resend/ReplyPreview dialogs render only inside `{token && ...}`.

`page.tsx` calls `toast()` on nearly every action, but `layout.tsx` never mounts `<Toaster />` — none
of those toasts are visible today. Mount `<Toaster />` from `@/components/ui/toaster` to turn them on.

`filteredContacts` = status tab filter, then campaign filter. The `'not-replied'` tab matches
`status === 'sent'`, so `pending` contacts never appear there.

Both `handleSend` (pending contact) and `handleResend` open **ResendDialog** with `mode='resend'`;
only the dialog title differs. `handleRemind` opens it with `mode='remind'`.

`handleImport` reuses an existing campaign when the name matches case-insensitively rather than
creating a duplicate.

`handleResendSuccess` passes `rfc822MessageId: undefined` when `resendMode === 'remind'` — intentional,
see the remind rule in ../lib/CLAUDE.md.

## hooks/

All three data hooks share a shape: `await initDB()` in a mount effect, load the store into React
state, and write through to IndexedDB *and* the state mirror on every mutation. They never re-read
after a write.

| Hook | Notable |
|---|---|
| `useContacts` | `bulkCreateContacts` dedupes **within a campaign scope** (`campaignId`, or the no-campaign bucket) and validates emails; returns `{created, duplicateCount, invalidCount}`. Missing names fall back to the local part of the address. `updateContactStatus` and `incrementResendCount` merge with `\|\|`, so passing `undefined` preserves the stored value. |
| `useTemplates` | `interpolateTemplate` and `getLatestTemplate` exist but nothing calls them — dialogs do the `{{name}}` replace inline. |
| `useCampaigns` | thin: create / list / delete. |
| `useLastTemplate` | localStorage (`mailv3:lastTemplateId`), **not** IndexedDB — it's a UI preference. Returns `{lastTemplateId, rememberTemplate}`. Read after mount to avoid a hydration mismatch. A deleted template needs no cleanup: consumers fall back to `templates[0]` when the id doesn't resolve. |
| `useScrollLockPreserve` | not a data hook; see below. |
| `useReplyTracking` | not a data hook; see below. |
| `useSendLog` | dead, unimported. |

### useScrollLockPreserve

Called once in `page.tsx`. Radix locks scrolling with `overflow: hidden` on `<body>`; since `<html>`
is `overflow: visible` that propagates to the viewport, the document becomes unscrollable and the
browser clamps its offset — so any dialog opened from far down the page dumped you back at the top on
close. The hook watches `body[data-scroll-locked]` (set by `react-remove-scroll`) with a
MutationObserver, snapshots the offset when the lock appears, and restores it when it clears.

The offset comes from a passive `scroll` listener rather than a live `window.scrollY` read, so the
snapshot can't pick up an already-clamped `0`. Nested overlays (a Select inside a Dialog) only bump
the attribute's counter, so the observer ignores changes where the locked/unlocked state is unchanged.

### useReplyTracking

`startPolling(contacts, userEmail, onReplyDetected, intervalMs = 60000)` runs one check immediately
then sets an interval. Contacts, user email, and the callback are kept in **refs** and re-read on
every tick, so the caller can change them without restarting the interval — that's what
`updatePollingRefs` is for (currently unused by `PollingStatus`).

Detection: fetch the thread, skip `messages[0]` (ours), and treat any later message whose `From`
header doesn't contain the authenticated address as a reply. Only contacts with
`status === 'sent' && threadId` are checked. Thread-fetch errors return `false` rather than throwing,
so one bad thread doesn't stop the sweep. The interval is cleared on unmount.

## components/dialogs/

| Dialog | Job | Notes |
|---|---|---|
| `TokenDialog` | Google sign-in / sign-out | Despite the name there is no token input any more. Probes `/api/auth/config-status` when opened while signed out; renders a distinct message for `session.error === 'MissingGmailScope'`. |
| `ImportDialog` | xlsx/csv → contacts | 3 steps: `upload → map → preview`. Multi-sheet aware (sheet picker appears when >1). Header row is sanitized: blanks become `Column N`, duplicates get ` (2)`. Auto-suggests columns containing "email"/"name"; `__auto_name__` sentinel means derive the name from the address. Campaign name pre-fills from the filename. |
| `TemplateDialog` | create/edit template | 3-way editor mode: `visual` (TipTap) / `source` (raw HTML) / `text`. Mode maps to `bodyType`: text→`text/plain`, else `text/html`. Switching to text runs `stripHtml`, switching away wraps lines in `<p>`. Pasting table-based HTML auto-switches to `source` — see RichTextEditor. |
| `SendDialog` | bulk send | Takes `defaultTemplateId` + `onTemplateUsed` and pins the last-used template (see `useLastTemplate`); re-applies it on each open via a `wasOpen` ref so an in-progress selection is never clobbered. 3 phases in one dialog: config / sending / done. Dedupes by lowercased email when the campaign filter is "All". Delay slider is 1000–180000 ms. Refreshes the token before the loop and again every 50 min mid-loop. Cannot be closed while sending. Per-contact failures are logged and the loop continues. |
| `ResendDialog` | resend or remind | Also pinned via `defaultTemplateId`/`onTemplateUsed`; mounted fresh on every open, so the initial pick doubles as the restore. `mode='resend'` → brand-new email. `mode='remind'` → reply in-thread: loads the thread, harvests RFC 2822 Message-IDs, and uses the **first** message's subject + id. |
| `ReplyPreviewDialog` | show the reply | Identifies the reply as the newest message whose `From` address differs from `messages[0]`'s. Decodes base64url `text/html` parts recursively, falling back to `snippet`. |

Bodies are injected with `dangerouslySetInnerHTML` and are not sanitized.

## components/RichTextEditor.tsx

TipTap 3: StarterKit (h1–h3), Underline, TextStyle+Color, TextAlign, Link, Placeholder, and
`ImageWithSize` — a `TiptapImage` extension that preserves `width`/`height` attributes so pasted
signature images keep their size.

Image handling: pasted or dropped images run through `compressImage` (canvas, max width 700, quality
0.85) and become base64 data URLs. **GIFs bypass the canvas** and are read raw, otherwise animation is
lost; PNGs stay PNG to keep transparency.

Paste priority: (1) raw image file → compress + insert; (2) HTML matching `/<(table|tr|td|th)[\s>]/i`
→ hand the raw HTML to `onComplexHtmlPaste` and let the caller switch to source mode, because TipTap
destroys table layout on round-trip; (3) everything else → TipTap's default.

`immediatelyRender: false` is required (SSR). The `value` effect calls `setContent(..., {emitUpdate:
false})` only when the HTML actually differs, to avoid an update loop.

## components/dashboard/ and components/contacts/

Presentational, no data access except `PollingStatus`, which calls `getProfile()` for the user's
address and drives `useReplyTracking`. `GettingStarted` returns `null` once all steps are done —
step 4 is hardcoded `completed: false`, so it never fully disappears. `ContactTable` does its own
search + sort locally; the action buttons shown depend on `status` (and `threadId` for Remind).

`components/contacts/types.ts` and `components/dialogs/{gmail,useContacts}.ts` are dead — see root
CLAUDE.md.

## api/

Three routes, all trivial: `auth/[...nextauth]` (NextAuth handler), `auth/config-status`
(`{isConfigured}`, no secrets), `gmail/token` (`{accessToken}` from the server session, 401 if none).
