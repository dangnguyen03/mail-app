'use client'

import { useState, useMemo } from 'react'
import { Campaign, Contact, ContactStatus } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Trash2, RotateCcw, Search, Send, Mail, Bell } from 'lucide-react'
import { format } from 'date-fns'

interface ContactTableProps {
  contacts: Contact[]
  campaigns?: Campaign[]
  onDelete: (id: string) => void
  onSend: (id: string) => void
  onResend: (id: string) => void
  onRemind: (id: string) => void
  onViewReply: (id: string) => void
}

export function ContactTable({
  contacts,
  campaigns = [],
  onDelete,
  onSend,
  onResend,
  onRemind,
  onViewReply,
}: ContactTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const campaignMap = useMemo(
    () => Object.fromEntries(campaigns.map((c) => [c.id, c.name])),
    [campaigns]
  )

  const filteredAndSorted = useMemo(() => {
    let filtered = contacts
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = contacts.filter(
        (c) =>
          c.email.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query)
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a.name
      let bVal: any = b.name

      if (sortBy === 'status') {
        const statusOrder = { pending: 0, sent: 1, replied: 2 }
        aVal = statusOrder[a.status as ContactStatus]
        bVal = statusOrder[b.status as ContactStatus]
      } else if (sortBy === 'date') {
        aVal = a.lastSentAt || 0
        bVal = b.lastSentAt || 0
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [contacts, searchQuery, sortBy, sortOrder])

  const getStatusBadge = (status: ContactStatus) => {
    const variants: Record<ContactStatus, 'default' | 'secondary' | 'outline'> = {
      pending: 'outline',
      sent: 'secondary',
      replied: 'default',
    }
    const labels: Record<ContactStatus, string> = {
      pending: 'Pending',
      sent: 'Sent',
      replied: 'Replied',
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => toggleSort('name')}
                  className="font-medium hover:text-foreground cursor-pointer"
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort('status')}
                  className="font-medium hover:text-foreground cursor-pointer"
                >
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort('date')}
                  className="font-medium hover:text-foreground cursor-pointer"
                >
                  Last Sent {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {contacts.length === 0
                    ? 'No contacts yet. Import contacts to get started.'
                    : 'No matches found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <div>{contact.name}</div>
                    {contact.campaignId && campaignMap[contact.campaignId] && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {campaignMap[contact.campaignId]}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{contact.email}</TableCell>
                  <TableCell>{getStatusBadge(contact.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.lastSentAt
                      ? format(new Date(contact.lastSentAt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {contact.status === 'replied' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewReply(contact.id)}
                          className="gap-1 cursor-pointer"
                        >
                          <Mail className="w-4 h-4" />
                          View Reply
                        </Button>
                      )}
                      {contact.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSend(contact.id)}
                          className="gap-1 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          Send
                        </Button>
                      )}
                      {(contact.status === 'sent' || contact.status === 'replied') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onResend(contact.id)}
                          className="gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Resend
                        </Button>
                      )}
                      {(contact.status === 'sent' || contact.status === 'replied') && contact.threadId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onRemind(contact.id)}
                          className="gap-1 cursor-pointer"
                        >
                          <Bell className="w-4 h-4" />
                          Remind
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onDelete(contact.id)}
                            className="gap-2 text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSorted.length} of {contacts.length} contacts
      </div>
    </div>
  )
}
