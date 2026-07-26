# lib/ — canonical data + Gmail layer

Four live files: `types.ts`, `indexeddb.ts`, `gmail.ts`, `auth.ts` (+ `utils.ts` = `cn()`).
`storage.ts` is dead (see root CLAUDE.md).

## types.ts — the source of truth for all models

`Contact` is the interesting one. Beyond the obvious fields it carries **four** identity fields, and
mixing them up is the most common bug in this repo:

| Field | What it is | Used for |
|---|---|---|
| `messageId` | Gmail **internal** message id (`18f2a...`) | not used for threading |
| `threadId` | Gmail **internal** thread id | `threadId` param on send → groups in *our* mailbox |
| `rfc822MessageId` | RFC 2822 header, `<hex@mailapp>` | `In-Reply-To`/`References` → groups in the **recipient's** mailbox |
| `threadIndex` | Outlook MAPI `Thread-Index`, base64 | Outlook conversation grouping |

`ContactStatus` = `'pending' | 'sent' | 'replied'`. Note the UI's "Not Replied" tab filters
`status === 'sent'` (not `!== 'replied'`), so `pending` contacts are excluded from it.

`EmailTemplate.bodyType` is `'html' | 'text'` and optional — always default it to `'html'`
(`template.bodyType ?? 'html'`) since older records predate the field.

## indexeddb.ts — raw IndexedDB, no ORM

DB `EmailTrackerDB`, **version 3**. Stores: `contacts`, `emailTemplates`, `sendLog`, `campaigns`
(all `keyPath: 'id'`, ids are uuidv4 strings).

Indexes on `contacts`: `email` (non-unique), `status`, `campaignId`.

Migration history — replicate this shape if you bump the version:

- v1 → v2: added the `campaignId` index.
- v2 → v3: **dropped and recreated the `email` index as non-unique.** The same address may legitimately
  appear in several campaigns. Do not reintroduce `unique: true`.

Every function is a hand-rolled `new Promise` around an `IDBRequest`. Module-scoped `db` is set by
`initDB()`; `getDB()` throws `'Database not initialized'` if called first. `db` is **not exported** —
one dead file tries to import it.

`deleteContactsByCampaignId` is the only cursor-based op; it resolves on `tx.oncomplete`, not on the
request. `clearAll()` clears **contacts only**, leaving templates and campaigns intact.

## gmail.ts — GmailService

`new GmailService(accessToken)` → `sendEmail`, `getThread`, `getProfile`. Plus
`createGmailService()` and `validateToken()` (a `getProfile()` probe).

Base: `https://www.googleapis.com/gmail/v1/users/me`. Auth is a Bearer header; there is no proxy.

### sendEmail — the threading logic

`SendEmailRequest` accepts `inReplyToMessageId`, `referencesHeader`, `parentThreadIndex`,
`threadTopic`. Returns `SendResult` = the Gmail response **plus** `rfc822MessageId` and `threadIndex`,
which the caller must persist onto the Contact.

Order of operations:

1. Generate our own `Message-ID` (`<32-hex@mailapp>`) up front so it's known before the API call.
2. `Thread-Index`: append 5 FILETIME bytes to `parentThreadIndex` if replying, else generate a fresh
   22-byte value (`0x01` + 5 timestamp bytes + 16 random).
3. `In-Reply-To` / `References`: prefer what the caller passed. Only if absent *and* a `threadId`
   exists does it fetch the thread and harvest `Message-ID` headers. Fetch failures are logged, not
   thrown — the mail still sends, just unthreaded for the recipient.
4. Build headers, base64url the RFC 822 blob, POST to `/messages/send`.
5. Re-fetch the sent message's actual `Message-ID` header (Gmail may rewrite ours) and return that.

Three separate mechanisms have to line up for a reply to thread everywhere:
`threadId` (our Gmail) · `In-Reply-To`+`References` (Gmail/standard clients) · `Thread-Index`+
`Thread-Topic` (Outlook). Changing one without the others breaks a subset of recipients.

### The remind rule

`ResendDialog` in `remind` mode sets `In-Reply-To` to the **first** message in the thread, not the
last, and `page.tsx` deliberately passes `undefined` for `rfc822MessageId` on remind so the stored
value keeps pointing at the original email. Rationale: the original is the one message the recipient
provably has; chaining off a previous remind that failed to thread on their side breaks every
remind after it. Same reason `Thread-Topic` always uses the original subject.

`encodeEmail` uses `btoa(unescape(encodeURIComponent(...)))` for UTF-8 — required for Vietnamese
subjects/bodies.

## auth.ts

`getGoogleAuthConfig()` (also used by the `/api/auth/config-status` route) and `authOptions`.
Placeholder env values (`''`, `your_google_client_id_here`, …) count as unconfigured, and the
providers array is then empty rather than throwing. See root CLAUDE.md for the scope/refresh behavior.
