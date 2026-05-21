'use client'

import { useState, useCallback, useEffect } from 'react'
import { Campaign } from '@/lib/types'
import { addCampaign, getAllCampaigns, deleteCampaignById, initDB } from '@/lib/indexeddb'
import { v4 as uuidv4 } from 'uuid'

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        await initDB()
        const data = await getAllCampaigns()
        setCampaigns(data)
      } catch (err) {
        console.error('Failed to load campaigns:', err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const createCampaign = useCallback(async (name: string): Promise<Campaign> => {
    const campaign: Campaign = {
      id: uuidv4(),
      name: name.trim(),
      createdAt: Date.now(),
    }
    await addCampaign(campaign)
    setCampaigns((prev) => [...prev, campaign])
    return campaign
  }, [])

  const removeCampaign = useCallback(async (id: string) => {
    await deleteCampaignById(id)
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { campaigns, isLoading, createCampaign, removeCampaign }
}
