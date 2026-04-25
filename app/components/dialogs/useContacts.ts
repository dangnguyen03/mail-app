'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/indexeddb'
import { Contact } from '@/lib/types'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    const allContacts = await db.contacts.toArray()
    setContacts(allContacts.sort((a: Contact, b: Contact) => (b.createdAt || 0) - (a.createdAt || 0)))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const removeContact = async (id: string) => {
    await db.contacts.delete(id)
    await fetchContacts()
  }

  const clearAllContacts = async () => {
    await db.contacts.clear()
    await fetchContacts()
  }

  const bulkCreateContacts = async (newContacts: Array<{ email: string; name: string }>) => {
    const contactsWithStatus = newContacts.map(c => ({ ...c, id: crypto.randomUUID(), status: 'pending', createdAt: Date.now(), resendCount: 0 }))
    await db.contacts.bulkAdd(contactsWithStatus)
    await fetchContacts()
  }

  const updateContactStatus = async (contactId: string, status: Contact['status'], messageId?: string, threadId?: string) => {
    await db.contacts.update(contactId, { status, messageId, threadId })
    await fetchContacts()
  }

  const incrementResendCount = async (contactId: string) => {
    await db.contacts.where({ id: contactId }).modify((c: Contact) => { c.resendCount = (c.resendCount || 0) + 1 })
    await fetchContacts()
  }

  return { contacts, isLoading, fetchContacts, removeContact, bulkCreateContacts, updateContactStatus, incrementResendCount, clearAllContacts }
}