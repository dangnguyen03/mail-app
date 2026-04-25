'use client'

import { useState, useRef } from 'react'
import { read, utils } from 'xlsx'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Upload, CheckCircle2 } from 'lucide-react'

interface ImportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onImport: (contacts: Array<{ email: string; name: string }>) => Promise<void>
}

interface ParsedData {
  columns: string[]
  rows: any[]
}

export function ImportDialog({
  isOpen,
  onOpenChange,
  onImport,
}: ImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [emailColumn, setEmailColumn] = useState<string>('')
  const [nameColumn, setNameColumn] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      // Validate file type
      if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
        setError('Please select a valid Excel or CSV file')
        return
      }

      setFile(selectedFile)

      // Parse the file
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = read(arrayBuffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = utils.sheet_to_json(worksheet, { header: 1 })

      if (data.length < 2) {
        setError('File must contain at least 2 rows (header + 1 data row)')
        return
      }

      const headers = data[0] as string[]
      const rows = data.slice(1)

      setParsedData({ columns: headers, rows })
      setStep('map')
      // Auto-detect columns
      const emailIdx = headers.findIndex((h) =>
        h?.toString().toLowerCase().includes('email')
      )
      const nameIdx = headers.findIndex((h) =>
        h?.toString().toLowerCase().includes('name')
      )
      if (emailIdx >= 0) setEmailColumn(headers[emailIdx])
      if (nameIdx >= 0) setNameColumn(headers[nameIdx])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }

  const handleMappingSubmit = async () => {
    if (!emailColumn || !nameColumn) {
      setError('Please select both email and name columns')
      return
    }

    if (!parsedData) {
      setError('No data to import')
      return
    }

    const emailIdx = parsedData.columns.indexOf(emailColumn)
    const nameIdx = parsedData.columns.indexOf(nameColumn)

    const contacts = parsedData.rows
      .map((row: any[]) => ({
        email: row[emailIdx]?.toString().trim(),
        name: row[nameIdx]?.toString().trim(),
      }))
      .filter((c) => c.email && c.name && c.email.includes('@'))

    if (contacts.length === 0) {
      setError('No valid contacts found after filtering')
      return
    }

    setStep('preview')
  }

  const handleImportSubmit = async () => {
    if (!parsedData) return

    const emailIdx = parsedData.columns.indexOf(emailColumn)
    const nameIdx = parsedData.columns.indexOf(nameColumn)

    const contacts = parsedData.rows
      .map((row: any[]) => ({
        email: row[emailIdx]?.toString().trim(),
        name: row[nameIdx]?.toString().trim(),
      }))
      .filter((c) => c.email && c.name && c.email.includes('@'))

    setIsImporting(true)
    try {
      await onImport(contacts)
      onOpenChange(false)
      // Reset state
      setFile(null)
      setParsedData(null)
      setStep('upload')
      setEmailColumn('')
      setNameColumn('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import contacts')
    } finally {
      setIsImporting(false)
    }
  }

  const getPreviewContacts = (): Array<{ email: string; name: string }> => {
    if (!parsedData) return []

    const emailIdx = parsedData.columns.indexOf(emailColumn)
    const nameIdx = parsedData.columns.indexOf(nameColumn)

    return parsedData.rows
      .slice(0, 5)
      .map((row: any[]) => ({
        email: row[emailIdx]?.toString().trim() || '',
        name: row[nameIdx]?.toString().trim() || '',
      }))
      .filter((c) => c.email && c.name && c.email.includes('@'))
  }

  const getValidContactsCount = (): number => {
    if (!parsedData) return 0

    const emailIdx = parsedData.columns.indexOf(emailColumn)
    const nameIdx = parsedData.columns.indexOf(nameColumn)

    return parsedData.rows
      .filter((row: any[]) => {
        const email = row[emailIdx]?.toString().trim()
        const name = row[nameIdx]?.toString().trim()
        return email && name && email.includes('@')
      }).length
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file with your contacts
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">Click to upload</p>
              <p className="text-sm text-muted-foreground">
                or drag and drop your Excel file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {file && (
              <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
            )}
          </div>
        )}

        {step === 'map' && parsedData && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Email Column
              </label>
              <Select value={emailColumn} onValueChange={setEmailColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select email column" />
                </SelectTrigger>
                <SelectContent>
                  {parsedData.columns.map((col, i) => (
                    <SelectItem key={i} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Name Column
              </label>
              <Select value={nameColumn} onValueChange={setNameColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select name column" />
                </SelectTrigger>
                <SelectContent>
                  {parsedData.columns.map((col, i) => (
                    <SelectItem key={i} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Found {getValidContactsCount()} valid contacts</p>
              <div className="space-y-2">
                {getPreviewContacts().map((contact, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-muted-foreground">{contact.email}</p>
                  </div>
                ))}
                {getValidContactsCount() > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {getValidContactsCount() - 5} more
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step !== 'upload' && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'preview') {
                  setStep('map')
                } else {
                  setStep('upload')
                }
              }}
            >
              Back
            </Button>
          )}
          {step === 'upload' && (
            <Button onClick={() => fileInputRef.current?.click()} disabled={!file}>
              Continue
            </Button>
          )}
          {step === 'map' && (
            <Button onClick={handleMappingSubmit}>Review Data</Button>
          )}
          {step === 'preview' && (
            <Button
              onClick={handleImportSubmit}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import Contacts'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
