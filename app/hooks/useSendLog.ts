'use client'

import { useState, useCallback, useEffect } from 'react'
import { SendLog } from '@/lib/types'
import { addSendLog, getSendLogByContactId, initDB } from '@/lib/indexeddb'
import { v4 as uuidv4 } from 'uuid'

export function useSendLog() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        await initDB()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const logSend = useCallback(
    async (
      contactId: string,
      templateId: string,
      status: 'success' | 'failed',
      messageId?: string,
      threadId?: string,
      errorMessage?: string
    ): Promise<SendLog> => {
      try {
        const log: SendLog = {
          id: uuidv4(),
          contactId,
          templateId,
          sentAt: Date.now(),
          status,
          messageId,
          threadId,
          errorMessage,
        }
        await addSendLog(log)
        return log
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    []
  )

  const getContactLogs = useCallback(async (contactId: string): Promise<SendLog[]> => {
    try {
      return await getSendLogByContactId(contactId)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    }
  }, [])

  return {
    isLoading,
    error,
    logSend,
    getContactLogs,
  }
}
