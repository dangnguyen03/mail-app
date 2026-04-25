'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Contact } from '@/lib/types'
import { GmailService } from '@/lib/gmail'

interface ReplyCheckResult {
  contactId: string
  hasReply: boolean
  error?: string
}

export function useReplyTracking(token: string | null) {
  const [isPolling, setIsPolling] = useState(false)
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // FIX #3: dùng ref để luôn có contacts mới nhất trong closure
  const contactsRef = useRef<Contact[]>([])
  const userEmailRef = useRef<string>('')
  const onReplyDetectedRef = useRef<((contactId: string) => void) | null>(null)

  // FIX #1 + #2: so sánh full email & check tất cả messages (không chỉ cuối)
  const checkThreadForReplies = useCallback(
    async (threadId: string, userEmail: string): Promise<boolean> => {
      if (!token) {
        throw new Error('No token available')
      }

      const gmail = new GmailService(token)
      try {
        const thread = await gmail.getThread(threadId)

        if (!thread.messages || thread.messages.length <= 1) {
          // Chỉ có 1 message (email gốc do mình gửi) => chưa có reply
          return false
        }

        // Bỏ message đầu tiên (do mình gửi), check tất cả message còn lại
        const subsequentMessages = thread.messages.slice(1)

        const hasReply = subsequentMessages.some((msg) => {
          const headers = (msg as any).payload?.headers || []
          const fromHeader = headers.find((h: any) => h.name === 'From')
          if (!fromHeader?.value) return false

          const fromValue = fromHeader.value.toLowerCase()
          const normalizedUserEmail = userEmail.toLowerCase()

          // FIX #1: so sánh full email thay vì chỉ username
          return !fromValue.includes(normalizedUserEmail)
        })

        return hasReply
      } catch (err) {
        console.error('[useReplyTracking] Error checking thread:', err)
        return false
      }
    },
    [token]
  )

  const checkContactsForReplies = useCallback(
    async (
      contacts: Contact[],
      userEmail: string,
      onReplyDetected: (contactId: string) => void
    ): Promise<ReplyCheckResult[]> => {
      const results: ReplyCheckResult[] = []

      // Chỉ check các contact có status 'sent' và có threadId
      const contactsToCheck = contacts.filter(
        (c) => c.status !== 'replied' && c.status === 'sent' && !!c.threadId
      )

      for (const contact of contactsToCheck) {
        try {
          const hasReply = await checkThreadForReplies(
            contact.threadId!,
            userEmail
          )

          if (hasReply) {
            onReplyDetected(contact.id)
          }

          results.push({ contactId: contact.id, hasReply })
        } catch (err) {
          results.push({
            contactId: contact.id,
            hasReply: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      return results
    },
    [checkThreadForReplies]
  )

  // FIX #4: cập nhật refs khi contacts/userEmail/callback thay đổi
  // để interval luôn dùng data mới nhất
  const updatePollingRefs = useCallback(
    (
      contacts: Contact[],
      userEmail: string,
      onReplyDetected: (contactId: string) => void
    ) => {
      contactsRef.current = contacts
      userEmailRef.current = userEmail
      onReplyDetectedRef.current = onReplyDetected
    },
    []
  )

  const startPolling = useCallback(
    (
      contacts: Contact[],
      userEmail: string,
      onReplyDetected: (contactId: string) => void,
      intervalMs: number = 60000
    ) => {
      if (!token) {
        setError(new Error('No token available'))
        return
      }

      // Cập nhật refs với data hiện tại
      contactsRef.current = contacts
      userEmailRef.current = userEmail
      onReplyDetectedRef.current = onReplyDetected

      setIsPolling(true)
      setError(null)

      // Dừng interval cũ nếu đang chạy
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }

      // FIX #3: runCheck luôn đọc từ ref => không bị stale closure
      const runCheck = async () => {
        try {
          await checkContactsForReplies(
            contactsRef.current,
            userEmailRef.current,
            onReplyDetectedRef.current ?? (() => {})
          )
          setLastChecked(Date.now())
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
        }
      }

      // Check ngay lập tức
      runCheck()

      // Setup interval
      pollingIntervalRef.current = setInterval(runCheck, intervalMs)
    },
    [token, checkContactsForReplies]
  )

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return {
    isPolling,
    lastChecked,
    error,
    startPolling,
    stopPolling,
    updatePollingRefs, // expose để cập nhật contacts mà không restart polling
    checkContactsForReplies,
    checkThreadForReplies,
  }
}