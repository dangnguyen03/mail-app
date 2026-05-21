'use client'

import { useState, useEffect } from 'react'
import { EmailTemplate } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Trash2, Type, Code2, Eye, Info } from 'lucide-react'
import { RichTextEditor } from '@/app/components/RichTextEditor'

// editorMode drives how we edit; bodyType drives how we send
type EditorMode = 'visual' | 'source' | 'text'

interface TemplateDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  template?: EmailTemplate
  onSave: (subject: string, body: string, bodyType: 'html' | 'text') => Promise<void>
  onDelete?: () => Promise<void>
}

function modeToBodyType(mode: EditorMode): 'html' | 'text' {
  return mode === 'text' ? 'text' : 'html'
}

function templateToMode(t?: EmailTemplate): EditorMode {
  if (t?.bodyType === 'text') return 'text'
  return 'visual'
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim()
}

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}

export function TemplateDialog({
  isOpen,
  onOpenChange,
  template,
  onSave,
  onDelete,
}: TemplateDialogProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [editorMode, setEditorMode] = useState<EditorMode>('visual')
  const [autoSwitchedToSource, setAutoSwitchedToSource] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
      setEditorMode(templateToMode(template))
    } else {
      setSubject('')
      setBody('')
      setEditorMode('visual')
    }
    setError(null)
    setAutoSwitchedToSource(false)
  }, [template, isOpen])

  // Called by RichTextEditor when it detects pasted HTML with table/complex layout
  const handleComplexHtmlPaste = (html: string) => {
    setBody(html)
    setEditorMode('source')
    setAutoSwitchedToSource(true)
  }

  const switchMode = (newMode: EditorMode) => {
    if (newMode === editorMode) return

    // Convert body when switching between modes
    if (newMode === 'text') {
      // HTML → plain text: strip tags
      if (editorMode !== 'text') {
        setBody(stripHtml(body))
      }
    } else if (editorMode === 'text') {
      // plain text → HTML: wrap in paragraphs
      setBody(textToHtml(body))
    }
    // visual ↔ source: body is already HTML, no conversion needed

    setEditorMode(newMode)
  }

  const handleSave = async () => {
    if (!subject.trim()) {
      setError('Subject is required')
      return
    }
    const trimmedBody = body.replace(/<p><br><\/p>/g, '').replace(/<p><\/p>/g, '').trim()
    if (!trimmedBody) {
      setError('Body is required')
      return
    }

    setIsSaving(true)
    try {
      await onSave(subject, body, modeToBodyType(editorMode))
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => setShowDeleteConfirm(true)

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true)
    try {
      await onDelete?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const previewHtml = editorMode !== 'text'
    ? body.replace(/{{name}}/g, 'John Doe')
    : null
  const previewText = editorMode === 'text'
    ? body.replace(/{{name}}/g, 'John Doe')
    : null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-6xl w-[70vw] max-h-[150vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{template ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            <DialogDescription>
              Create an email template. Use {'{{name}}'} to insert recipient name.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="editor" className="w-full flex-1 overflow-hidden">
            <TabsList>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label className="text-sm font-medium block mb-2">Subject</label>
                <Input
                  placeholder="Enter email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Example: Hello {'{{name}}'}, special offer inside!
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Body</label>
                  {/* 3-way mode toggle */}
                  <div className="flex items-center gap-1 border rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => switchMode('visual')}
                      title="Visual editor (WYSIWYG)"
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                        editorMode === 'visual'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('source')}
                      title="Raw HTML source"
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                        editorMode === 'source'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Code2 className="w-3 h-3" />
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('text')}
                      title="Plain text"
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                        editorMode === 'text'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Type className="w-3 h-3" />
                      Text
                    </button>
                  </div>
                </div>

                {/* Auto-switch banner */}
                {autoSwitchedToSource && editorMode === 'source' && (
                  <Alert className="py-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Phát hiện HTML phức tạp (table layout — signature). Đã tự chuyển sang{' '}
                      <strong>HTML mode</strong> để giữ nguyên bố cục. Xem tab{' '}
                      <strong>Preview</strong> để kiểm tra kết quả gửi đi.
                    </AlertDescription>
                  </Alert>
                )}

                {editorMode === 'visual' && (
                  <RichTextEditor
                    value={body}
                    onChange={setBody}
                    onComplexHtmlPaste={handleComplexHtmlPaste}
                    placeholder="Write your email body here... Use {{name}} for personalization."
                  />
                )}

                {editorMode === 'source' && (
                  <Textarea
                    placeholder="Paste or write raw HTML here..."
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setAutoSwitchedToSource(false) }}
                    rows={14}
                    className="w-full font-mono text-sm max-h-[300px] overflow-y-auto resize-none"
                  />
                )}

                {editorMode === 'text' && (
                  <Textarea
                    placeholder="Enter plain text email body... Use {{name}} for personalization."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={14}
                    className="w-full text-sm max-h-[300px] overflow-y-auto resize-none"
                  />
                )}

                <p className="text-xs text-muted-foreground mt-1">
                  {editorMode === 'visual' && 'Rich text — use toolbar for formatting, images, links.'}
                  {editorMode === 'source' && 'HTML source — paste or write raw HTML. Sent as text/html.'}
                  {editorMode === 'text' && 'Plain text — no formatting. Sent as text/plain.'}
                  {' '}Use {'{{name}}'} for personalization.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div className="bg-muted p-4 rounded-lg space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      PREVIEW (with name = John Doe)
                    </p>
                    <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                      {editorMode === 'text' ? 'text/plain' : 'text/html'}
                    </span>
                  </div>
                  <div className="bg-background p-3 rounded border max-h-[470px] overflow-y-auto overflow-x-hidden break-words">
                    <p className="font-medium mb-3 text-sm">
                      Subject: {subject.replace(/{{name}}/g, 'John Doe') || '(empty)'}
                    </p>
                    {previewHtml !== null ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewHtml || '(empty)' }}
                      />
                    ) : (
                      <pre className="text-sm font-sans whitespace-pre-wrap">
                        {previewText || '(empty)'}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2 shrink-0">
            {template && onDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="mr-auto cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Template{' '}
              <span className="font-medium text-foreground">
                &ldquo;{template?.subject}&rdquo;
              </span>{' '}
              will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              disabled={isDeleting}
              className="bg-destructive cursor-pointer text-white hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
