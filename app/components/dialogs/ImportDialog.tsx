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
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Upload, CheckCircle2 } from 'lucide-react'

const AUTO_NAME_COLUMN = '__auto_name__'

interface ContactImportCandidate {
  email: string
  name: string
}

interface ImportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onImport: (contacts: Array<{ email: string; name: string }>, campaignName: string) => Promise<void>
}

interface ParsedData {
  columns: string[]
  rows: any[]
}

function normalizeCell(value: unknown): string {
  return value?.toString().trim() ?? ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getFallbackName(email: string): string {
  return email.split('@')[0]?.trim() || email
}

function buildContacts(
  parsedData: ParsedData,
  emailColumn: string,
  nameColumn: string
): { contacts: ContactImportCandidate[]; skippedCount: number } {
  const emailIdx = parsedData.columns.indexOf(emailColumn)
  const nameIdx =
    nameColumn && nameColumn !== AUTO_NAME_COLUMN
      ? parsedData.columns.indexOf(nameColumn)
      : -1

  const contacts = parsedData.rows
    .map((row: any[]) => {
      const email = normalizeCell(row[emailIdx]).toLowerCase()
      const rawName = nameIdx >= 0 ? normalizeCell(row[nameIdx]) : ''

      if (!isValidEmail(email)) {
        return null
      }

      return {
        email,
        name: rawName || getFallbackName(email),
      }
    })
    .filter((contact): contact is ContactImportCandidate => contact !== null)

  return {
    contacts,
    skippedCount: parsedData.rows.length - contacts.length,
  }
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
  const [campaignName, setCampaignName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
        setError('Please select a valid Excel or CSV file')
        return
      }

      setFile(selectedFile)

      // Auto-fill campaign name from filename (without extension)
      if (!campaignName) {
        setCampaignName(selectedFile.name.replace(/\.(xlsx|xls|csv)$/i, ''))
      }

      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = read(arrayBuffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      })

      if (data.length < 2) {
        setError('File must contain at least 2 rows (header + 1 data row)')
        return
      }

      const headers = data[0] as string[]
      const rows = data.slice(1)

      setParsedData({ columns: headers, rows })
      setStep('map')

      const emailIdx = headers.findIndex((h) =>
        h?.toString().toLowerCase().includes('email')
      )
      const nameIdx = headers.findIndex((h) =>
        h?.toString().toLowerCase().includes('name')
      )
      if (emailIdx >= 0) setEmailColumn(headers[emailIdx])
      if (nameIdx >= 0) {
        setNameColumn(headers[nameIdx])
      } else {
        setNameColumn(AUTO_NAME_COLUMN)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }

  const handleMappingSubmit = async () => {
    if (!emailColumn) {
      setError('Please select an email column')
      return
    }

    if (!parsedData) {
      setError('No data to import')
      return
    }

    const { contacts } = buildContacts(parsedData, emailColumn, nameColumn)

    if (contacts.length === 0) {
      setError('No valid contacts found after filtering')
      return
    }

    setStep('preview')
  }

  const handleImportSubmit = async () => {
    if (!parsedData) return

    const { contacts } = buildContacts(parsedData, emailColumn, nameColumn)

    setIsImporting(true)
    try {
      await onImport(contacts, campaignName.trim())
      onOpenChange(false)
      setFile(null)
      setParsedData(null)
      setStep('upload')
      setEmailColumn('')
      setNameColumn('')
      setCampaignName('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import contacts')
    } finally {
      setIsImporting(false)
    }
  }

  const getPreviewContacts = (): Array<{ email: string; name: string }> => {
    if (!parsedData) return []
    return buildContacts(parsedData, emailColumn, nameColumn).contacts.slice(0, 5)
  }

  const getValidContactsCount = (): number => {
    if (!parsedData) return 0
    return buildContacts(parsedData, emailColumn, nameColumn).contacts.length
  }

  const getSkippedContactsCount = (): number => {
    if (!parsedData) return 0
    return buildContacts(parsedData, emailColumn, nameColumn).skippedCount
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
            <div>
              <label className="text-sm font-medium block mb-2">
                Campaign Name <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Q2 Outreach, Tech Companies..."
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Groups these contacts so you can filter and delete them together.
              </p>
            </div>
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
              <label className="text-sm font-medium block mb-2">Email Column</label>
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
              <label className="text-sm font-medium block mb-2">Name Column</label>
              <Select value={nameColumn} onValueChange={setNameColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Use email as fallback name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_NAME_COLUMN}>
                    Use email as fallback name
                  </SelectItem>
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
            {campaignName && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <span className="font-medium">Campaign: </span>
                <span>{campaignName}</span>
              </div>
            )}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Found {getValidContactsCount()} valid contacts</p>
              {getSkippedContactsCount() > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  Skipped {getSkippedContactsCount()} rows because the email was empty or invalid.
                </p>
              )}
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
            <Button onClick={handleImportSubmit} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import Contacts'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
