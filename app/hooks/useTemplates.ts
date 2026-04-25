'use client'

import { useState, useCallback, useEffect } from 'react'
import { EmailTemplate } from '@/lib/types'
import {
  addTemplate,
  updateTemplate,
  getAllTemplates,
  deleteTemplate,
  initDB,
} from '@/lib/indexeddb'
import { v4 as uuidv4 } from 'uuid'

export function useTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Initialize DB and load templates
  useEffect(() => {
    const init = async () => {
      try {
        await initDB()
        const data = await getAllTemplates()
        setTemplates(data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const createTemplate = useCallback(
    async (subject: string, body: string): Promise<EmailTemplate> => {
      try {
        const template: EmailTemplate = {
          id: uuidv4(),
          subject,
          body,
          createdAt: Date.now(),
        }
        await addTemplate(template)
        setTemplates((prev) => [...prev, template])
        return template
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    []
  )

  const updateTemplateContent = useCallback(
    async (id: string, subject: string, body: string): Promise<EmailTemplate> => {
      try {
        const template: EmailTemplate = {
          id,
          subject,
          body,
          createdAt: templates.find((t) => t.id === id)?.createdAt || Date.now(),
        }
        await updateTemplate(template)
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? template : t))
        )
        return template
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        throw error
      }
    },
    [templates]
  )

  const removeTemplate = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    }
  }, [])

  const getLatestTemplate = useCallback((): EmailTemplate | undefined => {
    if (templates.length === 0) return undefined
    return [...templates].sort((a, b) => b.createdAt - a.createdAt)[0]
  }, [templates])

  const interpolateTemplate = useCallback(
    (templateId: string, name: string): { subject: string; body: string } | null => {
      const template = templates.find((t) => t.id === templateId)
      if (!template) return null

      return {
        subject: template.subject.replace(/{{name}}/g, name),
        body: template.body.replace(/{{name}}/g, name),
      }
    },
    [templates]
  )

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplateContent,
    removeTemplate,
    getLatestTemplate,
    interpolateTemplate,
  }
}
