'use client'

import { useState, useEffect } from 'react'
import { useToken } from './components/provider/TokenProvider'
import { TokenDialog } from './components/dialogs/TokenDialog'
import { ImportDialog } from './components/dialogs/ImportDialog'
import { TemplateDialog } from './components/dialogs/TemplateDialog'
import { SendDialog } from './components/dialogs/SendDialog'
import { ResendDialog } from './components/dialogs/ResendDialog'
import { ReplyPreviewDialog } from './components/dialogs/ReplyPreviewDialog'
import { DashboardStats } from './components/dashboard/DashboardStats'
import { PollingStatus } from './components/dashboard/PollingStatus'
import { GettingStarted } from './components/dashboard/GettingStarted'
import { ContactTable } from './components/contacts/ContactTable'
import { useContacts } from './hooks/useContacts'
import { useTemplates } from './hooks/useTemplates'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LogOut, Plus, Upload, Send, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { EmailTemplate } from '@/lib/types'

export default function Page() {
  const { token, setToken, clearToken, isLoading: tokenLoading } = useToken()
  const { contacts, isLoading: contactsLoading, removeContact, bulkCreateContacts, updateContactStatus, incrementResendCount, clearAllContacts } = useContacts()
  const { templates, isLoading: templatesLoading, createTemplate, updateTemplateContent, removeTemplate } = useTemplates()
  const { toast } = useToast()

  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [showReplyPreviewDialog, setShowReplyPreviewDialog] = useState(false)
  const [selectedContactForResend, setSelectedContactForResend] = useState<string | null>(null)
  const [selectedContactForPreview, setSelectedContactForPreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'replied' | 'not-replied'>('all')
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  // AlertDialog states
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)

  // ── Contact handlers ──
  const handleDelete = (id: string) => {
    setDeleteContactId(id)
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteContactId) return
    await removeContact(deleteContactId)
    toast({ title: 'Contact deleted' })
    setDeleteContactId(null)
  }

  const handleSend = (id: string) => {
    setSelectedContactForResend(id)
    setShowResendDialog(true)
  }

  const handleResend = (id: string) => {
    setSelectedContactForResend(id)
    setShowResendDialog(true)
  }

  const handleViewReply = (id: string) => {
    setSelectedContactForPreview(id)
    setShowReplyPreviewDialog(true)
  }

  const handleImport = async (contactsData: Array<{ email: string; name: string }>) => {
    try {
      await bulkCreateContacts(contactsData)
      toast({ title: 'Success', description: `Imported ${contactsData.length} contacts` })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to import contacts', variant: 'destructive' })
    }
  }

  const handleClearAllContacts = () => {
    setShowClearAllConfirm(true)
  }

  const handleClearAllConfirmed = async () => {
    await clearAllContacts()
    toast({ title: 'All contacts deleted' })
    setShowClearAllConfirm(false)
  }

  // ── Template handlers ──
  const handleOpenNewTemplate = () => {
    setEditingTemplate(null)
    setShowTemplateDialog(true)
  }

  const handleOpenEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setShowTemplateDialog(true)
  }

  const handleSaveTemplate = async (subject: string, body: string) => {
    try {
      if (editingTemplate) {
        await updateTemplateContent(editingTemplate.id, subject, body)
        toast({ title: 'Template updated' })
      } else {
        await createTemplate(subject, body)
        toast({ title: 'Template created' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' })
    }
  }

  const handleDeleteTemplate = async () => {
    if (!editingTemplate) return
    try {
      await removeTemplate(editingTemplate.id)
      toast({ title: 'Template deleted' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' })
    }
  }

  const handleContactUpdate = async (contactId: string, status: 'sent' | 'failed', messageId?: string, threadId?: string) => {
    if (status === 'sent') {
      await updateContactStatus(contactId, 'sent', messageId, threadId)
    }
  }

  const handleReplyDetected = async (contactId: string) => {
    await updateContactStatus(contactId, 'replied')
    toast({ title: 'Reply detected!', description: 'A recipient has replied.' })
  }

  const handleResendSuccess = async (contact: { id: string }, messageId: string, threadId: string) => {
    await incrementResendCount(contact.id)
    await updateContactStatus(contact.id, 'sent', messageId, threadId)
    toast({ title: 'Email resent successfully' })
  }

  useEffect(() => {
    if (!tokenLoading && !token) {
      setShowTokenDialog(true)
    }
  }, [tokenLoading, token])

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <>
        <TokenDialog isOpen={showTokenDialog} onOpenChange={setShowTokenDialog} />
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Thành Đăng App</h1>
            <p className="text-muted-foreground">
              Add your Gmail access token to get started
            </p>
            <Button onClick={() => setShowTokenDialog(true)}>Add Token</Button>
          </div>
        </div>
      </>
    )
  }

  const filteredContacts = contacts.filter((contact) => {
    if (activeTab === 'replied') return contact.status === 'replied'
    if (activeTab === 'not-replied') return contact.status === 'sent'
    return true
  })

  const deletingContact = contacts.find((c) => c.id === deleteContactId)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Thành Đăng App</h1>
            <p className="text-sm text-muted-foreground">
              Bulk email sending & reply tracking
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTokenDialog(true)}>
              Change Token
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearToken()
                setShowTokenDialog(true)
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <DashboardStats contacts={contacts} />
            <PollingStatus contacts={contacts} token={token} onReplyDetected={handleReplyDetected} />

            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="outline" className="gap-2 cursor-pointer" onClick={() => setShowImportDialog(true)}>
                <Upload className="w-4 h-4" />
                Import Contacts
              </Button>
              <Button size="lg" variant="destructive" className="gap-2 cursor-pointer" onClick={handleClearAllContacts} disabled={contacts.length === 0}>
                <Trash2 className="w-4 h-4" />
                Clear All Contacts
              </Button>
              <Button size="lg" variant="outline" className="gap-2 cursor-pointer" onClick={handleOpenNewTemplate}>
                <Plus className="w-4 h-4" />
                New Template
              </Button>
              <Button size="lg" className="gap-2 cursor-pointer" disabled={contacts.length === 0 || templates.length === 0} onClick={() => setShowSendDialog(true)}>
                <Send className="w-4 h-4" />
                Send Email
              </Button>
            </div>

            {templates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Templates</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditTemplate(t)}
                      className="cursor-pointer"
                    >
                      {t.subject}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="border-b">
                <div className="flex gap-4 overflow-x-auto">
                  {(['all', 'replied', 'not-replied'] as const).map((tab) => {
                    const count =
                      tab === 'all'
                        ? contacts.length
                        : tab === 'replied'
                        ? contacts.filter((c) => c.status === 'replied').length
                        : contacts.filter((c) => c.status === 'sent').length
                    const label =
                      tab === 'all' ? 'All' : tab === 'replied' ? 'Replied' : 'Not Replied'
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 px-1 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                          activeTab === tab
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>

              <ContactTable
                contacts={filteredContacts}
                onDelete={handleDelete}
                onSend={handleSend}
                onResend={handleResend}
                onViewReply={handleViewReply}
              />
            </div>
          </div>

          <div className="space-y-6">
            <GettingStarted
              hasToken={!!token}
              hasContacts={contacts.length > 0}
              hasTemplates={templates.length > 0}
            />
          </div>
        </div>
      </main>

      {/* ── Dialogs ── */}
      <TokenDialog isOpen={showTokenDialog} onOpenChange={setShowTokenDialog} />
      <ImportDialog
        isOpen={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
      />
      <TemplateDialog
        isOpen={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        template={editingTemplate ?? undefined}
        onSave={handleSaveTemplate}
        onDelete={editingTemplate ? handleDeleteTemplate : undefined}
      />

      {token && (
        <>
          <SendDialog
            isOpen={showSendDialog}
            onOpenChange={setShowSendDialog}
            contacts={contacts}
            templates={templates}
            token={token}
            onContactUpdate={handleContactUpdate}
          />
          {selectedContactForResend && (
            <ResendDialog
              isOpen={showResendDialog}
              onOpenChange={setShowResendDialog}
              contact={contacts.find((c) => c.id === selectedContactForResend)}
              templates={templates}
              token={token}
              onResendSuccess={handleResendSuccess}
            />
          )}
          {selectedContactForPreview && (
            <ReplyPreviewDialog
              isOpen={showReplyPreviewDialog}
              onOpenChange={setShowReplyPreviewDialog}
              contact={contacts.find((c) => c.id === selectedContactForPreview)}
              token={token}
            />
          )}
        </>
      )}

      {/* ── AlertDialog: xoá 1 contact ── */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.{' '}
              {deletingContact && (
                <span className="font-medium text-foreground">
                  {deletingContact.name} ({deletingContact.email})
                </span>
              )}{' '}
              will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteContactId(null)} className='cursor-pointer'>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white cursor-pointer"
            >
              Delete contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: xoá tất cả contacts ── */}
      <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All{' '}
              <span className="font-medium text-foreground">{contacts.length} contacts</span>{' '}
              will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='cursor-pointer'>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer text-white"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
