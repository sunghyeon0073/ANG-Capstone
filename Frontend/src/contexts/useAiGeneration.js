import { useContext } from 'react'
import { AiGenerationContext } from './AiGenerationState'

export function useAiGeneration() {
  const context = useContext(AiGenerationContext)
  if (!context) {
    throw new Error('useAiGeneration must be used inside AiGenerationProvider')
  }
  return context
}
