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
import { useContacts } from './hooks/useContacts' // This now correctly points to the updated hook
import { useTemplates } from './hooks/useTemplates' // Assuming this hook exists
import { Button } from '@/components/ui/button'
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

  // FIX: thêm state track template đang edit, null = tạo mới
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure? This action cannot be undone.')) {
      await removeContact(id)
      toast({ title: 'Contact deleted' })
    }
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

  const handleClearAllContacts = async () => {
    if (confirm('Are you sure you want to delete all contacts? This action cannot be undone.')) {
      await clearAllContacts()
      toast({ title: 'All contacts deleted' })
    }
  }

  // FIX: mở dialog tạo mới — reset editingTemplate về null
  const handleOpenNewTemplate = () => {
    setEditingTemplate(null)
    setShowTemplateDialog(true)
  }

  // FIX: mở dialog edit — set template cần edit
  const handleOpenEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setShowTemplateDialog(true)
  }

  // FIX: onSave tự biết create hay update dựa vào editingTemplate
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

  // FIX: delete template từ dialog edit
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
            <Button onClick={() => setShowTokenDialog(true)}>
              Add Token
            </Button>
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
              <Button size="lg" variant="outline" className="gap-2" onClick={() => setShowImportDialog(true)}>
                <Upload className="w-4 h-4" />
                Import Contacts
              </Button>
              <Button size="lg" variant="destructive" className="gap-2" onClick={handleClearAllContacts} disabled={contacts.length === 0}>
                <Trash2 className="w-4 h-4" />
                Clear All Contacts
              </Button>
              {/* FIX: dùng handleOpenNewTemplate thay vì setShowTemplateDialog(true) */}
              <Button size="lg" variant="outline" className="gap-2" onClick={handleOpenNewTemplate}>
                <Plus className="w-4 h-4" />
                New Template
              </Button>
              <Button size="lg" className="gap-2" disabled={contacts.length === 0 || templates.length === 0} onClick={() => setShowSendDialog(true)}>
                <Send className="w-4 h-4" />
                Send Email
              </Button>
            </div>

            {/* FIX: hiện danh sách template để click edit */}
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
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`pb-2 px-1 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                      activeTab === 'all'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All ({contacts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('replied')}
                    className={`pb-2 px-1 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                      activeTab === 'replied'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Replied ({contacts.filter((c) => c.status === 'replied').length})
                  </button>
                  <button
                    onClick={() => setActiveTab('not-replied')}
                    className={`pb-2 px-1 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                      activeTab === 'not-replied'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Not Replied ({contacts.filter((c) => c.status === 'sent').length})
                  </button>
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

      <TokenDialog isOpen={showTokenDialog} onOpenChange={setShowTokenDialog} />
      <ImportDialog
        isOpen={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
      />
      {/* FIX: truyền template (null = new, object = edit) — bỏ isNew */}
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
    </div>
  )
}