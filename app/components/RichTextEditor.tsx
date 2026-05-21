'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapImage from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading2, Heading3, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon,
  Undo, Redo, Quote, Upload, Loader2,
} from 'lucide-react'

// Read a Blob directly as base64 data URL — preserves binary exactly (GIF animation, etc.)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Compress large raster images via Canvas. GIFs are passed through unmodified
// (canvas cannot preserve animation). PNG images with transparency keep PNG format.
async function compressImage(file: File, maxWidth = 700, quality = 0.85): Promise<string> {
  // GIF: canvas would lose animation — return raw base64 unchanged
  if (file.type === 'image/gif') {
    return blobToBase64(file)
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      // Only resize if image is larger than maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas unavailable')); return }
      ctx.drawImage(img, 0, 0, width, height)
      const isPng = file.type === 'image/png'
      resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

// Image extension with preserved width / height / style so that pasted
// signature images keep their intended display size.
const ImageWithSize = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width') ?? el.style.width ?? null,
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => el.getAttribute('height') ?? el.style.height ?? null,
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
    }
  },
})

// HTML that contains table-based layout (common in email signatures) cannot be
// round-tripped through TipTap without losing structure. Callers can handle
// this by switching to a raw HTML source mode instead.
function hasComplexLayout(html: string): boolean {
  return /<(table|tr|td|th)[\s>]/i.test(html)
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onComplexHtmlPaste?: (html: string) => void
  placeholder?: string
  className?: string
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 self-center" />
}

export function RichTextEditor({ value, onChange, onComplexHtmlPaste, placeholder, className }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const [isInsertingImage, setIsInsertingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  // Keep a stable ref so the handlePaste closure always sees the latest callback
  const onComplexHtmlPasteRef = useRef(onComplexHtmlPaste)
  useEffect(() => { onComplexHtmlPasteRef.current = onComplexHtmlPaste }, [onComplexHtmlPaste])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-500 underline cursor-pointer' },
      }),
      // Use extended image that preserves width/height from pasted HTML
      ImageWithSize.configure({ HTMLAttributes: { class: 'max-w-full rounded' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write your email body here...' }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-3 py-2',
      },

      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? [])

        // Priority 1: raw image file (Ctrl+V after "Copy image" or screenshot)
        const rawImageItem = items.find((item) => item.type.startsWith('image/'))
        if (rawImageItem) {
          const file = rawImageItem.getAsFile()
          if (file) {
            setIsInsertingImage(true)
            compressImage(file)
              .then((src) => {
                const node = view.state.schema.nodes.image?.create({ src })
                if (node) view.dispatch(view.state.tr.replaceSelectionWith(node))
              })
              .catch(console.error)
              .finally(() => setIsInsertingImage(false))
            return true
          }
        }

        // Priority 2: HTML with table-based layout (e.g. email signature from Outlook/Gmail).
        // TipTap cannot round-trip table HTML — it strips the structure and produces wrong layout.
        // Delegate to the caller (TemplateDialog) to switch to HTML source mode instead.
        const html = event.clipboardData?.getData('text/html') ?? ''
        if (html && hasComplexLayout(html) && onComplexHtmlPasteRef.current) {
          onComplexHtmlPasteRef.current(html)
          return true
        }

        return false // let TipTap handle everything else
      },

      handleDrop(view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? [])
        const imageFile = files.find((f) => f.type.startsWith('image/'))
        if (!imageFile) return false

        setIsInsertingImage(true)
        compressImage(imageFile)
          .then((src) => {
            const node = view.state.schema.nodes.image?.create({ src })
            if (!node) return
            const pos = view.posAtCoords({
              left: (event as DragEvent).clientX,
              top: (event as DragEvent).clientY,
            })
            view.dispatch(
              pos
                ? view.state.tr.insert(pos.pos, node)
                : view.state.tr.replaceSelectionWith(node)
            )
          })
          .catch(console.error)
          .finally(() => setIsInsertingImage(false))
        return true
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => { editorRef.current = editor }, [editor])

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl) return
    if (editor.state.selection.empty) {
      editor.chain().focus().setLink({ href: linkUrl }).insertContent(linkUrl).run()
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run()
    }
    setLinkUrl('')
    setShowLinkInput(false)
  }, [editor, linkUrl])

  const insertImageFromUrl = useCallback(() => {
    if (!editor || !imageUrl) return
    editor.chain().focus().setImage({ src: imageUrl }).run()
    setImageUrl('')
    setShowImageInput(false)
  }, [editor, imageUrl])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      setIsInsertingImage(true)
      compressImage(file)
        .then((src) => {
          editor.chain().focus().setImage({ src }).run()
          setShowImageInput(false)
        })
        .catch(console.error)
        .finally(() => setIsInsertingImage(false))
      e.target.value = ''
    },
    [editor]
  )

  if (!editor) return null

  return (
    <div className={`border rounded-md overflow-hidden ${className ?? ''}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-background">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => setShowLinkInput((v) => !v)} active={showLinkInput || editor.isActive('link')} title="Insert Link">
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setShowImageInput((v) => !v)} active={showImageInput} title="Insert Image">
          {isInsertingImage
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ImageIcon className="w-3.5 h-3.5" />}
        </ToolbarButton>
        <Divider />
        <label className="relative p-1.5 cursor-pointer rounded hover:bg-muted" title="Text Color">
          <span className="font-bold" style={{ fontSize: '13px' }}>A</span>
          <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        </label>
      </div>

      {isInsertingImage && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing image...
        </div>
      )}

      {showLinkInput && (
        <div className="flex gap-2 p-2 border-b bg-muted/50">
          <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && insertLink()} className="h-7 text-sm" autoFocus />
          <Button size="sm" variant="secondary" onClick={insertLink} className="h-7 px-3 text-xs cursor-pointer">Insert</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowLinkInput(false)} className="h-7 px-3 text-xs cursor-pointer">Cancel</Button>
        </div>
      )}

      {showImageInput && (
        <div className="p-2 border-b bg-muted/50 space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Image URL (https://...)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && insertImageFromUrl()} className="h-7 text-sm" />
            <Button size="sm" variant="secondary" onClick={insertImageFromUrl} disabled={!imageUrl}
              className="h-7 px-3 text-xs cursor-pointer shrink-0">Insert URL</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
              disabled={isInsertingImage} className="h-7 px-3 text-xs cursor-pointer">
              {isInsertingImage
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing...</>
                : <><Upload className="w-3 h-3 mr-1" />Upload file</>}
            </Button>
            <span className="text-xs text-muted-foreground">
              or drag-drop / <kbd className="px-1 py-0.5 rounded border text-xs bg-background">Ctrl+V</kbd> image into editor
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Paste signature từ Gmail/Outlook:</strong> Ctrl+V thẳng vào editor.
            Nếu ảnh chân dung bị lỗi (auth-gated URL), mở ảnh trong tab mới →{' '}
            chuột phải → <strong>Copy image</strong> → paste lại.
          </p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <Button size="sm" variant="ghost" onClick={() => setShowImageInput(false)} className="h-6 px-2 text-xs cursor-pointer">Close</Button>
        </div>
      )}

      <EditorContent editor={editor} className="overflow-y-auto" style={{ maxHeight: '300px' }} />
    </div>
  )
}
