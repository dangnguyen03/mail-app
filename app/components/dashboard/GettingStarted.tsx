'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle } from 'lucide-react'

interface GettingStartedProps {
  hasToken: boolean
  hasContacts: boolean
  hasTemplates: boolean
}

export function GettingStarted({
  hasToken,
  hasContacts,
  hasTemplates,
}: GettingStartedProps) {
  const steps = [
    {
      number: 1,
      title: 'Add Gmail Token',
      description:
        'Get your Gmail access token from the OAuth Playground to enable email sending',
      completed: hasToken,
    },
    {
      number: 2,
      title: 'Import Contacts',
      description: 'Upload your contact list via Excel or CSV file with email and name columns',
      completed: hasContacts,
    },
    {
      number: 3,
      title: 'Create Email Template',
      description:
        'Write an email template with {{name}} variable for personalization',
      completed: hasTemplates,
    },
    {
      number: 4,
      title: 'Send Emails',
      description:
        'Send your emails with configurable delay and monitor replies in real-time',
      completed: false,
    },
  ]

  const completedSteps = steps.filter((s) => s.completed).length

  if (completedSteps === 4) {
    return null // Don't show if all steps are complete
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Getting Started</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`flex gap-3 p-3 rounded-lg transition ${
                step.completed ? 'bg-muted/50' : 'bg-muted'
              }`}
            >
              <div className="flex-shrink-0">
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`font-medium text-sm ${
                    step.completed
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Progress: {completedSteps} of 4 steps complete
        </div>
      </CardContent>
    </Card>
  )
}
