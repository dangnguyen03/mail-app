import { Campaign, Contact, EmailTemplate, SendLog } from './types'

const DB_NAME = 'EmailTrackerDB'
const DB_VERSION = 3

const STORES = {
  CONTACTS: 'contacts',
  TEMPLATES: 'emailTemplates',
  SEND_LOG: 'sendLog',
  CAMPAIGNS: 'campaigns',
}

let db: IDBDatabase | null = null

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      const tx = (event.target as IDBOpenDBRequest).transaction!

      if (!database.objectStoreNames.contains(STORES.CONTACTS)) {
        // Fresh install: email is NOT unique — same email can exist in multiple campaigns
        const contactStore = database.createObjectStore(STORES.CONTACTS, { keyPath: 'id' })
        contactStore.createIndex('email', 'email', { unique: false })
        contactStore.createIndex('status', 'status', { unique: false })
        contactStore.createIndex('campaignId', 'campaignId', { unique: false })
      } else {
        const contactStore = tx.objectStore(STORES.CONTACTS)

        // v2 migration: add campaignId index
        if (event.oldVersion < 2) {
          if (!contactStore.indexNames.contains('campaignId')) {
            contactStore.createIndex('campaignId', 'campaignId', { unique: false })
          }
        }

        // v3 migration: drop unique constraint on email index
        if (event.oldVersion < 3) {
          if (contactStore.indexNames.contains('email')) {
            contactStore.deleteIndex('email')
          }
          contactStore.createIndex('email', 'email', { unique: false })
        }
      }

      if (!database.objectStoreNames.contains(STORES.TEMPLATES)) {
        database.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(STORES.SEND_LOG)) {
        const logStore = database.createObjectStore(STORES.SEND_LOG, { keyPath: 'id' })
        logStore.createIndex('contactId', 'contactId', { unique: false })
      }

      if (!database.objectStoreNames.contains(STORES.CAMPAIGNS)) {
        database.createObjectStore(STORES.CAMPAIGNS, { keyPath: 'id' })
      }
    }
  })
}

function getDB(): IDBDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.')
  }
  return db
}

// Contacts operations
export async function addContact(contact: Contact): Promise<Contact> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readwrite')
    const store = tx.objectStore(STORES.CONTACTS)
    const request = store.add(contact)

    request.onerror = () => reject(new Error('Failed to add contact'))
    request.onsuccess = () => resolve(contact)
  })
}

export async function updateContact(contact: Contact): Promise<Contact> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readwrite')
    const store = tx.objectStore(STORES.CONTACTS)
    const request = store.put(contact)

    request.onerror = () => reject(new Error('Failed to update contact'))
    request.onsuccess = () => resolve(contact)
  })
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readonly')
    const store = tx.objectStore(STORES.CONTACTS)
    const request = store.get(id)

    request.onerror = () => reject(new Error('Failed to get contact'))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function getAllContacts(): Promise<Contact[]> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readonly')
    const store = tx.objectStore(STORES.CONTACTS)
    const request = store.getAll()

    request.onerror = () => reject(new Error('Failed to get all contacts'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function getContactsByStatus(status: string): Promise<Contact[]> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readonly')
    const store = tx.objectStore(STORES.CONTACTS)
    const index = store.index('status')
    const request = index.getAll(status)

    request.onerror = () => reject(new Error('Failed to get contacts by status'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function getContactsByCampaignId(campaignId: string): Promise<Contact[]> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readonly')
    const store = tx.objectStore(STORES.CONTACTS)
    const index = store.index('campaignId')
    const request = index.getAll(campaignId)

    request.onerror = () => reject(new Error('Failed to get contacts by campaign'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function deleteContact(id: string): Promise<void> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readwrite')
    const store = tx.objectStore(STORES.CONTACTS)
    const request = store.delete(id)

    request.onerror = () => reject(new Error('Failed to delete contact'))
    request.onsuccess = () => resolve()
  })
}

export async function deleteContactsByCampaignId(campaignId: string): Promise<void> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readwrite')
    const store = tx.objectStore(STORES.CONTACTS)
    const index = store.index('campaignId')
    const request = index.openCursor(IDBKeyRange.only(campaignId))

    request.onerror = () => reject(new Error('Failed to delete contacts by campaign'))
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(new Error('Transaction failed'))
  })
}

export async function clearAll(): Promise<void> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CONTACTS, 'readwrite')
    const store = tx.objectStore(STORES.CONTACTS)
    const request = store.clear()

    request.onerror = () => reject(new Error('Failed to clear contacts'))
    request.onsuccess = () => resolve()
  })
}

// Templates operations
export async function addTemplate(template: EmailTemplate): Promise<EmailTemplate> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.TEMPLATES, 'readwrite')
    const store = tx.objectStore(STORES.TEMPLATES)
    const request = store.add(template)

    request.onerror = () => reject(new Error('Failed to add template'))
    request.onsuccess = () => resolve(template)
  })
}

export async function updateTemplate(template: EmailTemplate): Promise<EmailTemplate> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.TEMPLATES, 'readwrite')
    const store = tx.objectStore(STORES.TEMPLATES)
    const request = store.put(template)

    request.onerror = () => reject(new Error('Failed to update template'))
    request.onsuccess = () => resolve(template)
  })
}

export async function getAllTemplates(): Promise<EmailTemplate[]> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.TEMPLATES, 'readonly')
    const store = tx.objectStore(STORES.TEMPLATES)
    const request = store.getAll()

    request.onerror = () => reject(new Error('Failed to get templates'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.TEMPLATES, 'readwrite')
    const store = tx.objectStore(STORES.TEMPLATES)
    const request = store.delete(id)

    request.onerror = () => reject(new Error('Failed to delete template'))
    request.onsuccess = () => resolve()
  })
}

// Send log operations
export async function addSendLog(log: SendLog): Promise<SendLog> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.SEND_LOG, 'readwrite')
    const store = tx.objectStore(STORES.SEND_LOG)
    const request = store.add(log)

    request.onerror = () => reject(new Error('Failed to add send log'))
    request.onsuccess = () => resolve(log)
  })
}

export async function getSendLogByContactId(contactId: string): Promise<SendLog[]> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.SEND_LOG, 'readonly')
    const store = tx.objectStore(STORES.SEND_LOG)
    const index = store.index('contactId')
    const request = index.getAll(contactId)

    request.onerror = () => reject(new Error('Failed to get send log by contact'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

// Campaign operations
export async function addCampaign(campaign: Campaign): Promise<Campaign> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CAMPAIGNS, 'readwrite')
    const store = tx.objectStore(STORES.CAMPAIGNS)
    const request = store.add(campaign)

    request.onerror = () => reject(new Error('Failed to add campaign'))
    request.onsuccess = () => resolve(campaign)
  })
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CAMPAIGNS, 'readonly')
    const store = tx.objectStore(STORES.CAMPAIGNS)
    const request = store.getAll()

    request.onerror = () => reject(new Error('Failed to get campaigns'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function deleteCampaignById(id: string): Promise<void> {
  const database = getDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CAMPAIGNS, 'readwrite')
    const store = tx.objectStore(STORES.CAMPAIGNS)
    const request = store.delete(id)

    request.onerror = () => reject(new Error('Failed to delete campaign'))
    request.onsuccess = () => resolve()
  })
}
