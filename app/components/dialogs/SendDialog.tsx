'use client'

import { useState, useEffect } from 'react'
import { Contact, EmailTemplate } from '@/lib/types'
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

interface SendDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contacts: Contact[]
  templates: EmailTemplate[]
  token: string | null
  onContactUpdate: (contactId: string, status: 'sent' | 'failed', messageId?: string, threadId?: string) => void
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
  templates,
  token,
  onContactUpdate,
}: SendDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
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

  // Reset state khi dialog đóng/mở lại
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Chỉ cho đóng nếu không đang gửi
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

    setIsSending(true)
    setIsDone(false)
    setError(null)
    setSendLogs([])
    setProgress(0)

    const gmail = new GmailService(token)
    const delayMs = delay[0]

    // Khởi tạo log cho tất cả contacts
    const logs: SendLog[] = contacts.map((contact) => ({
      contactId: contact.id,
      email: contact.email,
      status: 'pending',
      timestamp: Date.now(),
    }))

    setSendLogs(logs)

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      const logIndex = logs.findIndex((l) => l.contactId === contact.id)

      // Cập nhật trạng thái đang gửi
      setSendLogs((prev) =>
        prev.map((log, idx) =>
          idx === logIndex ? { ...log, status: 'sending' } : log
        )
      )

      try {
        // Thay thế biến template
        const subject = template.subject.replace(/{{name}}/g, contact.name)
        const body = template.body.replace(/{{name}}/g, contact.name)

        const response = await gmail.sendEmail({
          to: contact.email,
          subject,
          body,
        })

        setSendLogs((prev) =>
          prev.map((log, idx) =>
            idx === logIndex
              ? { ...log, status: 'success', timestamp: Date.now() }
              : log
          )
        )

        onContactUpdate(contact.id, 'sent', response.id, response.threadId)
        setProgress(((i + 1) / contacts.length) * 100)

        // Delay trước email tiếp theo
        if (i < contacts.length - 1) {
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

        setProgress(((i + 1) / contacts.length) * 100)
      }
    }

    // Gửi xong — chuyển sang màn hình kết quả
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
            {isDone ? 'Kết quả gửi email' : 'Gửi Email Hàng Loạt'}
          </DialogTitle>
          <DialogDescription>
            {isDone
              ? `Đã hoàn tất — ${successCount}/${contacts.length} email gửi thành công`
              : 'Gửi email hàng loạt đến danh sách liên hệ với độ trễ tuỳ chỉnh'}
          </DialogDescription>
        </DialogHeader>

        {/* ── BƯỚC 1: Cấu hình ── */}
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

            {selectedTemplate && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-2">Xem trước:</p>
                <p className="font-semibold mb-2">{selectedTemplate.subject}</p>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none overflow-hidden text-ellipsis h-24"
                  dangerouslySetInnerHTML={{
                    __html: selectedTemplate.body.replace(/{{name}}/g, 'Nguyễn Văn A'),
                  }}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-4">
                Độ trễ giữa các email: {delay[0]}ms
              </label>
              <Slider
                value={delay}
                onValueChange={setDelay}
                min={1000}
                max={60000}
                step={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {delay[0]}ms = {(delay[0] / 1000).toFixed(1)}s mỗi email
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Sẽ gửi đến {contacts.length} liên hệ • Thời gian ước tính:{' '}
                {((contacts.length * delay[0]) / 1000 / 60).toFixed(1)} phút
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
                  {successCount + failCount} / {contacts.length}
                </span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">
                ✓ Thành công: {successCount}
              </p>
              {failCount > 0 && (
                <p className="text-sm font-medium text-destructive">
                  ✗ Thất bại: {failCount}
                </p>
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
            {/* Banner kết quả */}
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

            {/* Progress bar đầy */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Hoàn tất</span>
                <span className="text-sm text-muted-foreground">
                  {successCount + failCount} / {contacts.length}
                </span>
              </div>
              <Progress value={100} />
            </div>

            {/* Log chi tiết */}
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
          {/* Config: Cancel + Send */}
          {!isSending && !isDone && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button
                onClick={handleStartSend}
                disabled={!selectedTemplateId || contacts.length === 0}
              >
                Gửi đến {contacts.length} liên hệ
              </Button>
            </>
          )}

          {/* Đang gửi: disable */}
          {isSending && (
            <Button disabled>
              <span className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
              Đang gửi... Vui lòng chờ
            </Button>
          )}

          {/* Done: Đóng (+ Gửi lại nếu có lỗi) */}
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
