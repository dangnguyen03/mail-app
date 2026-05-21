'use client'

import { useState, useCallback, useEffect } from 'react'
import { Contact, ContactStatus } from '@/lib/types'
import {
  addContact,
  updateContact,
  getContact,
  getAllContacts,
  deleteContact,
  deleteContactsByCampaignId,
  initDB,
  clearAll,
  getContactsByStatus,
} from '@/lib/indexeddb'
import { v4 as uuidv4 } from 'uuid'

export interface BulkCreateContactsResult {
  created: Contact[]
  duplicateCount: number
  invalidCount: number
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getFallbackName(email: string): string {
  return email.split('@')[0]?.trim() || email
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        await initDB()
        const data = await getAllContacts()
        setContacts(data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const createContact = useCallback(
    async (email: string, name: string): Promise<Contact> => {
      try {
        const contact: Contact = {
          id: uuidv4(),
          email,
          name,
          status: 'pending' as ContactStatus,
          resendCount: 0,
          createdAt: Date.now(),
        }
        await addContact(contact)
        setContacts((prev) => [...prev, contact])
        return contact
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    []
  )

  const updateContactStatus = useCallback(async (
    id: string,
    status: ContactStatus,
    messageId?: string,
    threadId?: string,
    rfc822MessageId?: string,
    threadIndex?: string,
  ) => {
    try {
      const contact = await getContact(id)
      if (!contact) throw new Error('Contact not found')

      const updated: Contact = {
        ...contact,
        status,
        messageId: messageId || contact.messageId,
        threadId: threadId || contact.threadId,
        rfc822MessageId: rfc822MessageId || contact.rfc822MessageId,
        threadIndex: threadIndex || contact.threadIndex,
        lastSentAt: status === 'sent' ? Date.now() : contact.lastSentAt,
      }

      await updateContact(updated)
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      )
      return updated
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    }
  }, [])

  const bulkCreateContacts = useCallback(
    async (
      data: Array<{ email: string; name: string }>,
      campaignId?: string
    ): Promise<BulkCreateContactsResult> => {
      try {
        const existingContacts = await getAllContacts()
        // Deduplication is scoped to the same campaign:
        // same email is allowed in different campaigns, but not twice in the same one.
        const scopedContacts = campaignId
          ? existingContacts.filter((c) => c.campaignId === campaignId)
          : existingContacts.filter((c) => !c.campaignId)
        const existingEmails = new Set(
          scopedContacts.map((contact) => normalizeEmail(contact.email))
        )
        const newContacts: Contact[] = []
        let duplicateCount = 0
        let invalidCount = 0

        for (const item of data) {
          const email = normalizeEmail(item.email)
          const name = item.name.trim() || getFallbackName(email)

          if (!isValidEmail(email)) {
            invalidCount += 1
            continue
          }

          if (existingEmails.has(email)) {
            duplicateCount += 1
            continue
          }

          const contact: Contact = {
            id: uuidv4(),
            email,
            name,
            status: 'pending' as ContactStatus,
            resendCount: 0,
            createdAt: Date.now(),
            campaignId,
          }
          await addContact(contact)
          existingEmails.add(email)
          newContacts.push(contact)
        }
        setContacts((prev) => [...prev, ...newContacts])
        return {
          created: newContacts,
          duplicateCount,
          invalidCount,
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    []
  )

  const removeContact = useCallback(async (id: string) => {
    try {
      await deleteContact(id)
      setContacts((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    }
  }, [])

  const removeContactsByCampaign = useCallback(async (campaignId: string) => {
    try {
      await deleteContactsByCampaignId(campaignId)
      setContacts((prev) => prev.filter((c) => c.campaignId !== campaignId))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    }
  }, [])

  const clearAllContacts = useCallback(async () => {
    try {
      await clearAll()
      setContacts([])
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    }
  }, [])

  const getContactsByStatusFilter = useCallback(
    async (status: ContactStatus): Promise<Contact[]> => {
      try {
        return await getContactsByStatus(status)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    []
  )

  const incrementResendCount = useCallback(
    async (
      id: string,
      rfc822MessageId?: string,
      threadIndex?: string,
    ): Promise<Contact> => {
      try {
        const contact = await getContact(id)
        if (!contact) throw new Error('Contact not found')

        const updated: Contact = {
          ...contact,
          resendCount: (contact.resendCount || 0) + 1,
          lastSentAt: Date.now(),
          rfc822MessageId: rfc822MessageId || contact.rfc822MessageId,
          threadIndex: threadIndex || contact.threadIndex,
        }

        await updateContact(updated)
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        )
        return updated
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    []
  )

  return {
    contacts,
    isLoading,
    error,
    createContact,
    updateContactStatus,
    bulkCreateContacts,
    removeContact,
    removeContactsByCampaign,
    getContactsByStatusFilter,
    incrementResendCount,
    clearAllContacts,
  }
}
