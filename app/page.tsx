'use client'

import { useState, useEffect, useRef } from 'react'
import { useToken } from './components/provider/TokenProvider'
import { TokenDialog } from './components/dialogs/TokenDialog'
import { ImportDialog } from './components/dialogs/ImportDialog'
import { TemplateDialog } from './components/dialogs/TemplateDialog'
import { SendDialog } from './components/dialogs/SendDialog'
import { ResendDialog, ResendMode } from './components/dialogs/ResendDialog'
import { ReplyPreviewDialog } from './components/dialogs/ReplyPreviewDialog'
import { DashboardStats } from './components/dashboard/DashboardStats'
import { PollingStatus } from './components/dashboard/PollingStatus'
import { GettingStarted } from './components/dashboard/GettingStarted'
import { ContactTable } from './components/contacts/ContactTable'
import { useContacts } from './hooks/useContacts'
import { useTemplates } from './hooks/useTemplates'
import { useCampaigns } from './hooks/useCampaigns'
import { useLastTemplate } from './hooks/useLastTemplate'
import { useScrollRestore } from './hooks/useScrollRestore'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Plus, Upload, Send, Trash2, ChevronDown, FolderX } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ContactStatus, EmailTemplate } from '@/lib/types'

export default function Page() {
  const { token, clearToken, isLoading: tokenLoading } = useToken()
  const {
    contacts,
    removeContact,
    removeContactsByCampaign,
    bulkCreateContacts,
    updateContactStatus,
    incrementResendCount,
    clearAllContacts,
  } = useContacts()
  const { templates, createTemplate, updateTemplateContent, removeTemplate } = useTemplates()
  const { campaigns, createCampaign, removeCampaign } = useCampaigns()
  const { lastTemplateId, rememberTemplate } = useLastTemplate()
  const { toast } = useToast()

  // Safety net: if anything shortens the page while a dialog is open, put the
  // scroll offset back once it closes. See the hook for why this is needed on top
  // of the render-gate fix below.
  useScrollRestore()

  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [showReplyPreviewDialog, setShowReplyPreviewDialog] = useState(false)
  const [selectedContactForResend, setSelectedContactForResend] = useState<string | null>(null)
  const [selectedContactForPreview, setSelectedContactForPreview] = useState<string | null>(null)
  const [resendMode, setResendMode] = useState<ResendMode>('resend')
  const [activeTab, setActiveTab] = useState<'all' | 'replied' | 'not-replied'>('all')
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  // Set once the dashboard has been shown, so a transient loss of `token` can't
  // swap it out for the sign-in screen. See the render gates below.
  const hasRenderedDashboard = useRef(false)

  // AlertDialog states
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null)

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
    setResendMode('resend')
    setShowResendDialog(true)
  }

  const handleResend = (id: string) => {
    setSelectedContactForResend(id)
    setResendMode('resend')
    setShowResendDialog(true)
  }

  const handleRemind = (id: string) => {
    setSelectedContactForResend(id)
    setResendMode('remind')
    setShowResendDialog(true)
  }

  const handleViewReply = (id: string) => {
    setSelectedContactForPreview(id)
    setShowReplyPreviewDialog(true)
  }

  const handleImport = async (contactsData: Array<{ email: string; name: string }>, campaignName: string) => {
    try {
      let campaignId: string | undefined

      if (campaignName.trim()) {
        // Reuse existing campaign with the same name (case-insensitive) instead of creating a duplicate
        const existing = campaigns.find(
          (c) => c.name.toLowerCase() === campaignName.trim().toLowerCase()
        )
        const campaign = existing ?? (await createCampaign(campaignName))
        campaignId = campaign.id
      }

      const result = await bulkCreateContacts(contactsData, campaignId)
      const skippedCount = result.duplicateCount + result.invalidCount

      toast({
        title: 'Success',
        description:
          skippedCount > 0
            ? `Imported ${result.created.length} contacts${campaignName ? ` into "${campaignName}"` : ''}. Skipped ${skippedCount} invalid or duplicate rows.`
            : `Imported ${result.created.length} contacts${campaignName ? ` into "${campaignName}"` : ''}`,
      })
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

  const handleDeleteCampaign = (campaignId: string) => {
    setDeleteCampaignId(campaignId)
  }

  const handleDeleteCampaignConfirmed = async () => {
    if (!deleteCampaignId) return
    await removeContactsByCampaign(deleteCampaignId)
    await removeCampaign(deleteCampaignId)
    if (activeCampaignId === deleteCampaignId) {
      setActiveCampaignId(null)
    }
    toast({ title: 'Campaign deleted' })
    setDeleteCampaignId(null)
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

  const handleSaveTemplate = async (subject: string, body: string, bodyType: 'html' | 'text' = 'html') => {
    try {
      if (editingTemplate) {
        await updateTemplateContent(editingTemplate.id, subject, body, bodyType)
        toast({ title: 'Template updated' })
      } else {
        await createTemplate(subject, body, bodyType)
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

  const handleContactUpdate = async (
    contactId: string,
    status: 'sent' | 'failed',
    messageId?: string,
    threadId?: string,
    rfc822MessageId?: string,
    threadIndex?: string,
  ) => {
    if (status === 'sent') {
      await updateContactStatus(contactId, 'sent', messageId, threadId, rfc822MessageId, threadIndex)
    }
  }

  const handleReplyDetected = async (contactId: string) => {
    await updateContactStatus(contactId, 'replied')
    toast({ title: 'Reply detected!', description: 'A recipient has replied.' })
  }

  const handleResendSuccess = async (
    contact: { id: string },
    messageId: string,
    threadId: string,
    rfc822MessageId?: string,
    threadIndex?: string,
  ) => {
    // For remind mode: preserve the original rfc822MessageId so future reminds
    // can always use In-Reply-To = original email's Message-ID.
    // Only update rfc822MessageId on a fresh resend (new thread).
    const newRfc822MessageId = resendMode === 'remind' ? undefined : rfc822MessageId
    await incrementResendCount(contact.id, newRfc822MessageId, threadIndex)

    // A remind is a reply inside the *existing* thread, so it must not undo the
    // fact that the recipient already replied. Forcing 'sent' here both lost that
    // history (they reappeared under Not Replied) and dropped the row out of the
    // Replied tab — which shortens the page, so the browser clamps the scroll
    // offset and you land back at the top.
    // A resend is a genuinely new thread, so awaiting a fresh reply is correct.
    const existing = contacts.find((c) => c.id === contact.id)
    const nextStatus: ContactStatus =
      resendMode === 'remind' && existing?.status === 'replied' ? 'replied' : 'sent'

    await updateContactStatus(contact.id, nextStatus, messageId, threadId, newRfc822MessageId, threadIndex)
    toast({ title: resendMode === 'remind' ? 'Reminder sent successfully' : 'Email resent successfully' })
  }

  useEffect(() => {
    if (!tokenLoading && !token) {
      setShowTokenDialog(true)
    }
  }, [tokenLoading, token])

  // Once the dashboard has rendered, keep it mounted even if `token` briefly goes
  // empty — a NextAuth session refetch or a failed token refresh can do that at
  // any moment, and `refreshToken()` at the start of every send makes it likely
  // mid-remind. Swapping the whole dashboard for the sign-in screen collapsed the
  // page to a single viewport, so the browser clamped the scroll offset to 0 and
  // it read as "the app jumped back to home" — and it tore down the open dialog
  // with no exit animation. The TokenDialog effect above still prompts re-auth.
  if (token) hasRenderedDashboard.current = true
  const keepDashboard = hasRenderedDashboard.current

  if (tokenLoading && !keepDashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!token && !keepDashboard) {
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

  // Filter by status tab then by campaign
  const filteredContacts = contacts.filter((contact) => {
    if (activeTab === 'replied' && contact.status !== 'replied') return false
    if (activeTab === 'not-replied' && contact.status !== 'sent') return false
    if (activeCampaignId && contact.campaignId !== activeCampaignId) return false
    return true
  })

  const deletingContact = contacts.find((c) => c.id === deleteContactId)
  const deletingCampaign = campaigns.find((c) => c.id === deleteCampaignId)
  const deletingCampaignContactCount = deleteCampaignId
    ? contacts.filter((c) => c.campaignId === deleteCampaignId).length
    : 0

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <DashboardStats contacts={contacts} />
            <PollingStatus contacts={contacts} token={token} onReplyDetected={handleReplyDetected} />

            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="outline" className="gap-2 cursor-pointer" onClick={() => setShowImportDialog(true)}>
                <Upload className="w-4 h-4" />
                Import Contacts
              </Button>

              {/* Delete: single button if no campaigns, dropdown if campaigns exist */}
              {campaigns.length === 0 ? (
                <Button size="lg" variant="destructive" className="gap-2 cursor-pointer" onClick={handleClearAllContacts} disabled={contacts.length === 0}>
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="lg" variant="destructive" className="gap-2 cursor-pointer" disabled={contacts.length === 0}>
                      <Trash2 className="w-4 h-4" />
                      Delete
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleClearAllContacts} className="gap-2 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                      Clear All Contacts
                    </DropdownMenuItem>
                    {campaigns.map((campaign) => (
                      <DropdownMenuItem
                        key={campaign.id}
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <FolderX className="w-4 h-4" />
                        Delete "{campaign.name}"
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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
          </div>

          <div className="space-y-6">
            <GettingStarted
              hasToken={!!token}
              hasContacts={contacts.length > 0}
              hasTemplates={templates.length > 0}
            />
          </div>
        </div>

        {/* Full width. Nested in the 2/3 grid column above, the contact table
            was squeezed to two thirds of the page by Getting Started. */}
        <div className="space-y-6">
          {/* Campaign filter */}
          {campaigns.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              <button
                onClick={() => setActiveCampaignId(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition ${
                  activeCampaignId === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                All campaigns
              </button>
              {campaigns.map((campaign) => {
                const count = contacts.filter((c) => c.campaignId === campaign.id).length
                return (
                  <div key={campaign.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveCampaignId(campaign.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition ${
                        activeCampaignId === campaign.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {campaign.name} ({count})
                    </button>
                    <button
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="text-muted-foreground hover:text-destructive transition"
                      title={`Delete campaign "${campaign.name}"`}
                    >
                      <FolderX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Status tabs */}
          <div className="border-b">
            <div className="flex gap-4 overflow-x-auto">
              {(['all', 'replied', 'not-replied'] as const).map((tab) => {
                const base = activeCampaignId
                  ? contacts.filter((c) => c.campaignId === activeCampaignId)
                  : contacts
                const count =
                  tab === 'all'
                    ? base.length
                    : tab === 'replied'
                    ? base.filter((c) => c.status === 'replied').length
                    : base.filter((c) => c.status === 'sent').length
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
            campaigns={campaigns}
            onDelete={handleDelete}
            onSend={handleSend}
            onResend={handleResend}
            onRemind={handleRemind}
            onViewReply={handleViewReply}
          />
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

      {/* Not gated on `token`: all three accept a null token, and gating them
          ripped an open dialog out of the tree the moment the token blinked. */}
      <>
        <SendDialog
            isOpen={showSendDialog}
            onOpenChange={setShowSendDialog}
            contacts={contacts}
            campaigns={campaigns}
            templates={templates}
            token={token}
            defaultTemplateId={lastTemplateId}
            onTemplateUsed={rememberTemplate}
            onContactUpdate={handleContactUpdate}
          />
          {selectedContactForResend && (
            <ResendDialog
              isOpen={showResendDialog}
              onOpenChange={(open) => {
                setShowResendDialog(open)
                if (!open) setSelectedContactForResend(null)
              }}
              contact={contacts.find((c) => c.id === selectedContactForResend)}
              templates={templates}
              token={token}
              mode={resendMode}
              defaultTemplateId={lastTemplateId}
              onTemplateUsed={rememberTemplate}
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

      {/* ── AlertDialog: delete 1 contact ── */}
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
            <AlertDialogCancel onClick={() => setDeleteContactId(null)} className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white cursor-pointer"
            >
              Delete contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: clear all contacts ── */}
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
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer text-white"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: delete campaign ── */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={(open) => !open && setDeleteCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign{' '}
              <span className="font-medium text-foreground">"{deletingCampaign?.name}"</span>{' '}
              and all{' '}
              <span className="font-medium text-foreground">{deletingCampaignContactCount} contacts</span>{' '}
              in it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteCampaignId(null)} className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaignConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer text-white"
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
