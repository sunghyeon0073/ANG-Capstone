import { useCallback, useMemo, useRef, useState } from 'react'
import api from '../api/axios'
import { AiGenerationContext } from './AiGenerationState'

const notifyMascot = (message, animation = 'idle') => {
  window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
    detail: { message, animation },
  }))
}

export function AiGenerationProvider({ children }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentTask, setCurrentTask] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [lastError, setLastError] = useState(null)
  const activeTaskRef = useRef(null)

  const startGeneration = useCallback(async (payload) => {
    if (activeTaskRef.current) {
      throw new Error('이미 AI 문서를 생성하고 있어요. 조금만 기다려 주세요.')
    }

    const task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startedAt: new Date().toISOString(),
      outputFormat: payload?.outputFormat || 'pdf',
    }

    activeTaskRef.current = task
    setCurrentTask(task)
    setLastError(null)
    setIsGenerating(true)

    notifyMascot('문서 초안을 열심히 쓰는 중이에요. 다른 일을 보고 오셔도 계속 만들고 있을게요.', 'run')

    try {
      const response = await api.post('/documents/ai-generate', payload)
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'AI 문서 생성에 실패했습니다.')
      }

      const generatedDocument = response.data.data
      setLastResult(generatedDocument)

      window.dispatchEvent(new CustomEvent('ang:ai-document-generated', {
        detail: { document: generatedDocument, task },
      }))

      notifyMascot('문서 초안이 완성됐어요. 문서함에서 확인해 주세요!', 'idle')
      return generatedDocument
    } catch (error) {
      setLastError(error)
      notifyMascot('문서 생성이 잠깐 막혔어요. 연결 상태를 확인하고 다시 시도해 주세요.', 'idle')
      throw error
    } finally {
      activeTaskRef.current = null
      setCurrentTask(null)
      setIsGenerating(false)
    }
  }, [])

  const value = useMemo(() => ({
    isGenerating,
    currentTask,
    lastResult,
    lastError,
    startGeneration,
  }), [currentTask, isGenerating, lastError, lastResult, startGeneration])

  return (
    <AiGenerationContext.Provider value={value}>
      {children}
    </AiGenerationContext.Provider>
  )
}
