'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'mailv3:lastTemplateId'

/**
 * Remembers the template used for the most recent send, so the next Send /
 * Resend / Remind dialog opens with it already selected.
 *
 * Kept in localStorage rather than IndexedDB: it's a UI preference, not data,
 * and storing it here avoids a DB version bump. A remembered template that has
 * since been deleted needs no cleanup — callers fall back to the first template
 * when the id no longer resolves.
 */
export function useLastTemplate() {
  // Read after mount. localStorage doesn't exist during SSR, and seeding the
  // initial state from it would desync the hydrated markup.
  const [lastTemplateId, setLastTemplateId] = useState<string | null>(null)

  useEffect(() => {
    try {
      setLastTemplateId(localStorage.getItem(STORAGE_KEY))
    } catch {
      // Storage disabled (private mode) — behave as if nothing was remembered.
    }
  }, [])

  const rememberTemplate = useCallback((templateId: string) => {
    setLastTemplateId(templateId)
    try {
      localStorage.setItem(STORAGE_KEY, templateId)
    } catch {
      // Non-fatal: the pin just won't survive a reload.
    }
  }, [])

  return { lastTemplateId, rememberTemplate }
}
