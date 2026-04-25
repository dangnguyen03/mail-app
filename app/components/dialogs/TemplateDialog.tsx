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
import { AlertCircle, Trash2 } from 'lucide-react'

interface TemplateDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  template?: EmailTemplate
  onSave: (subject: string, body: string) => Promise<void>
  onDelete?: () => Promise<void>
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
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    } else {
      setSubject('')
      setBody('')
    }
    setError(null)
  }, [template, isOpen])

  const handleSave = async () => {
    if (!subject.trim()) {
      setError('Subject is required')
      return
    }
    if (!body.trim()) {
      setError('Body is required')
      return
    }

    setIsSaving(true)
    try {
      await onSave(subject, body)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

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
                <label className="text-sm font-medium block mb-2">Body</label>
                <Textarea
                  placeholder="Enter email body..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full font-mono text-sm max-h-[300px] overflow-y-auto resize-none"
                  />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports basic formatting. Use {'{{name}}'} for personalization.
                </p>
              </div>
            </TabsContent>

            {/* <TabsContent value="preview" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    PREVIEW (with name = John Doe)
                  </p>
                  <div className="bg-background p-3 rounded border">
                    <p className="font-medium mb-3">
                      Subject:{' '}
                      {subject.replace(/{{name}}/g, 'John Doe') || '(empty)'}
                    </p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: body.replace(/{{name}}/g, 'John Doe') || '(empty)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent> */}

            <TabsContent
              value="preview"
              className="space-y-4 overflow-y-auto flex-1 pr-2"
            >
              <div className="bg-muted p-4 rounded-lg space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    PREVIEW (with name = John Doe)
                  </p>
                    <div className="bg-background p-3 rounded border max-h-[470px] overflow-y-auto overflow-x-hidden break-words">
                      <p className="font-medium mb-3">
                      Subject:{' '}
                      {subject.replace(/{{name}}/g, 'John Doe') || '(empty)'}
                    </p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: body.replace(/{{name}}/g, 'John Doe') || '(empty)',
                      }}
                    />
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
            <AlertDialogCancel disabled={isDeleting} className='cursor-pointer'>Cancel</AlertDialogCancel>
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
