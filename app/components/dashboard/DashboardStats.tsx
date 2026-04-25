'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Contact } from '@/lib/types'
import { Mail, Send, CheckCircle2, Clock } from 'lucide-react'

interface DashboardStatsProps {
  contacts: Contact[]
}

export function DashboardStats({ contacts }: DashboardStatsProps) {
  const totalEmails = contacts.length
  const sentEmails = contacts.filter((c) => c.status === 'sent').length
  const repliedEmails = contacts.filter((c) => c.status === 'replied').length
  const notRepliedEmails = sentEmails - repliedEmails

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEmails}</div>
          <p className="text-xs text-muted-foreground">contacts in database</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sent</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sentEmails}</div>
          <p className="text-xs text-muted-foreground">
            {totalEmails > 0 ? ((sentEmails / totalEmails) * 100).toFixed(1) : 0}% of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Replied</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{repliedEmails}</div>
          <p className="text-xs text-muted-foreground">
            {sentEmails > 0 ? ((repliedEmails / sentEmails) * 100).toFixed(1) : 0}% of sent
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Not Replied</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{notRepliedEmails}</div>
          <p className="text-xs text-muted-foreground">awaiting response</p>
        </CardContent>
      </Card>
    </div>
  )
}
