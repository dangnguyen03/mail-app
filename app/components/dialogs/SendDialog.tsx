'use client'

import { useState, useEffect, useMemo } from 'react'
import { Campaign, Contact, EmailTemplate } from '@/lib/types'
import { GmailService } from '@/lib/gmail'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, CheckCircle2, AlertTriangle, MailCheck } from 'lucide-react'

const ALL_CAMPAIGNS = '__all__'

interface SendDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contacts: Contact[]
  campaigns: Campaign[]
  templates: EmailTemplate[]
  token: string | null
  onContactUpdate: (contactId: string, status: 'sent' | 'failed', messageId?: string, threadId?: string, rfc822MessageId?: string, threadIndex?: string) => void
}

interface SendLog {
  contactId: string
  email: string
  status: 'pending' | 'sending' | 'success' | 'failed'
  error?: string
  timestamp: number
}

export function SendDialog({
  isOpen,
  onOpenChange,
  contacts,
  campaigns,
  templates,
  token,
  onContactUpdate,
}: SendDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState(ALL_CAMPAIGNS)
  const [delay, setDelay] = useState([1000])
  const [isSending, setIsSending] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [sendLogs, setSendLogs] = useState<SendLog[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  const allContactsDeduped = useMemo(() => {
    const seen = new Set<string>()
    return contacts.filter((c) => {
      const key = c.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [contacts])

  const targetContacts = (() => {
    const pool =
      selectedCampaignId === ALL_CAMPAIGNS
        ? contacts
        : contacts.filter((c) => c.campaignId === selectedCampaignId)

    if (selectedCampaignId !== ALL_CAMPAIGNS) return pool

    // When sending to all campaigns, deduplicate by email (last-campaign wins).
    // Same email may appear in multiple campaigns — only send once.
    const seen = new Set<string>()
    return pool.filter((c) => {
      const key = c.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isSending) return
      setIsDone(false)
      setSendLogs([])
      setProgress(0)
      setError(null)
    }
    onOpenChange(open)
  }

  const handleStartSend = async () => {
    if (!selectedTemplateId || !token) {
      setError('Vui lòng chọn template và đảm bảo token hợp lệ')
      return
    }

    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) {
      setError('Không tìm thấy template')
      return
    }

    if (targetContacts.length === 0) {
      setError('No contacts to send to.')
      return
    }

    setIsSending(true)
    setIsDone(false)
    setError(null)
    setSendLogs([])
    setProgress(0)

    const gmail = new GmailService(token)
    const delayMs = delay[0]

    const logs: SendLog[] = targetContacts.map((contact) => ({
      contactId: contact.id,
      email: contact.email,
      status: 'pending',
      timestamp: Date.now(),
    }))

    setSendLogs(logs)

    for (let i = 0; i < targetContacts.length; i++) {
      const contact = targetContacts[i]
      const logIndex = logs.findIndex((l) => l.contactId === contact.id)

      setSendLogs((prev) =>
        prev.map((log, idx) =>
          idx === logIndex ? { ...log, status: 'sending' } : log
        )
      )

      try {
        const subject = template.subject.replace(/{{name}}/g, contact.name)
        const body = template.body.replace(/{{name}}/g, contact.name)

        const response = await gmail.sendEmail({
          to: contact.email,
          subject,
          body,
          bodyType: template.bodyType ?? 'html',
        })

        setSendLogs((prev) =>
          prev.map((log, idx) =>
            idx === logIndex
              ? { ...log, status: 'success', timestamp: Date.now() }
              : log
          )
        )

        onContactUpdate(contact.id, 'sent', response.id, response.threadId, response.rfc822MessageId, response.threadIndex)
        setProgress(((i + 1) / targetContacts.length) * 100)

        if (i < targetContacts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      } catch (err) {
        setSendLogs((prev) =>
          prev.map((log, idx) =>
            idx === logIndex
              ? {
                  ...log,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Lỗi không xác định',
                  timestamp: Date.now(),
                }
              : log
          )
        )

        setProgress(((i + 1) / targetContacts.length) * 100)
      }
    }

    setIsSending(false)
    setIsDone(true)
  }

  const handleClose = () => {
    setIsDone(false)
    setSendLogs([])
    setProgress(0)
    setError(null)
    onOpenChange(false)
  }

  const successCount = sendLogs.filter((l) => l.status === 'success').length
  const failCount = sendLogs.filter((l) => l.status === 'failed').length
  const allSuccess = isDone && failCount === 0

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isDone ? 'Result send mail' : 'Send emails to contacts'}
          </DialogTitle>
          <DialogDescription>
            {isDone
              ? `Completed — ${successCount}/${targetContacts.length} emails sent successfully`
              : 'Send bulk emails to contacts with customizable delay'}
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1: Configuration ── */}
        {!isSending && !isDone && (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium block mb-2">Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Campaign</label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CAMPAIGNS}>
                    All contacts ({allContactsDeduped.length})
                  </SelectItem>
                  {campaigns.map((campaign) => {
                    const count = contacts.filter((c) => c.campaignId === campaign.id).length
                    return (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name} ({count})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-2">Preview:</p>
                <p className="font-semibold mb-2">{selectedTemplate.subject}</p>
                {selectedTemplate.bodyType === 'text' ? (
                  <pre className="font-sans text-xs whitespace-pre-wrap overflow-y-auto h-30 border rounded-md p-2 bg-background">
                    {selectedTemplate.body.replace(/{{name}}/g, 'Nguyễn Văn A')}
                  </pre>
                ) : (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none overflow-y-auto h-30 border rounded-md p-2 bg-background"
                    dangerouslySetInnerHTML={{
                      __html: selectedTemplate.body.replace(/{{name}}/g, 'Nguyễn Văn A'),
                    }}
                  />
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-4">
                Delay: {delay[0]}ms
              </label>
              <Slider
                value={delay}
                onValueChange={setDelay}
                min={1000}
                max={180000}
                step={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {delay[0]}ms = {(delay[0] / 1000).toFixed(1)}s mỗi email
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Will send to {targetContacts.length} contacts • Estimated time:{' '}
                {((targetContacts.length * delay[0]) / 1000 / 60).toFixed(1)} minutes
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ── BƯỚC 2: Đang gửi (loading) ── */}
        {isSending && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Đang gửi...</span>
                <span className="text-sm text-muted-foreground">
                  {successCount + failCount} / {targetContacts.length}
                </span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">✓ Thành công: {successCount}</p>
              {failCount > 0 && (
                <p className="text-sm font-medium text-destructive">✗ Thất bại: {failCount}</p>
              )}
            </div>

            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="space-y-2">
                {sendLogs.map((log, i) => (
                  <div
                    key={i}
                    className="text-sm flex items-start gap-2 pb-2 border-b last:border-0"
                  >
                    {log.status === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    {log.status === 'failed' && (
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    {(log.status === 'pending' || log.status === 'sending') && (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-foreground animate-spin flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{log.email}</p>
                      {log.error && (
                        <p className="text-xs text-destructive">{log.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ── BƯỚC 3: Hoàn tất (done) ── */}
        {isDone && (
          <div className="space-y-4">
            <Alert variant={allSuccess ? 'default' : 'destructive'}>
              {allSuccess ? (
                <MailCheck className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                {allSuccess
                  ? `Tất cả ${successCount} email đã gửi thành công!`
                  : `${successCount} thành công · ${failCount} thất bại`}
              </AlertDescription>
            </Alert>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Hoàn tất</span>
                <span className="text-sm text-muted-foreground">
                  {successCount + failCount} / {targetContacts.length}
                </span>
              </div>
              <Progress value={100} />
            </div>

            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="space-y-2">
                {sendLogs.map((log, i) => (
                  <div
                    key={i}
                    className="text-sm flex items-start gap-2 pb-2 border-b last:border-0"
                  >
                    {log.status === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    {log.status === 'failed' && (
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{log.email}</p>
                      {log.error && (
                        <p className="text-xs text-destructive">{log.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {!isSending && !isDone && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStartSend}
                disabled={!selectedTemplateId || targetContacts.length === 0}
              >
                Send to {targetContacts.length} contacts
              </Button>
            </>
          )}

          {isSending && (
            <Button disabled>
              <span className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
              Đang gửi... Vui lòng chờ
            </Button>
          )}

          {isDone && (
            <>
              {failCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDone(false)
                    setSendLogs([])
                    setProgress(0)
                  }}
                >
                  Thử lại
                </Button>
              )}
              <Button onClick={handleClose}>Đóng</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
