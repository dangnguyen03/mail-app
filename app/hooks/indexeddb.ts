import Dexie, { Table } from 'dexie'
import { Contact, EmailTemplate, SendLog, ContactStatus } from './types'

export class MySubClassedDexie extends Dexie {
  contacts!: Table<Contact>
  templates!: Table<EmailTemplate>
  sendLogs!: Table<SendLog>

  constructor() {
    super('myDatabase')
    this.version(1).stores({
      contacts: '++id, email, status, threadId, createdAt',
      templates: '++id, createdAt',
      sendLogs: '++id, contactId, templateId, sentAt, status',
    })
  }
}

export const db = new MySubClassedDexie()

export const initDB = async () => {
  await db.open()
}

// Contact Functions
export const getAllContacts = () => db.contacts.orderBy('createdAt').reverse().toArray()
export const getContact = (id: string) => db.contacts.get(id)
export const addContact = (contact: Contact) => db.contacts.add(contact)
export const updateContact = (contact: Contact) => db.contacts.put(contact)
export const deleteContact = (id: string) => db.contacts.delete(id)
export const getContactsByStatus = (status: ContactStatus) =>
  db.contacts.where('status').equals(status).toArray()
export const clearAll = () => db.contacts.clear()

// Template Functions
export const getAllTemplates = () => db.templates.orderBy('createdAt').reverse().toArray()
export const addTemplate = (template: EmailTemplate) => db.templates.add(template)
export const updateTemplate = (template: EmailTemplate) => db.templates.put(template)
export const deleteTemplate = (id: string) => db.templates.delete(id)

// SendLog Functions
export const addSendLog = (log: SendLog) => db.sendLogs.add(log)
export const getSendLogByContactId = (contactId: string) =>
  db.sendLogs.where('contactId').equals(contactId).toArray()