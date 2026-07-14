import { createContext, useContext, useState, useMemo } from 'react'
import { panels, getPanel, searchAll } from './data/index'

const DocContext = createContext(null)

export function DocProvider({ children }) {
  const [activePanel, setActivePanel] = useState(panels[0]?.id || 'super-admin')
  const [activeScreen, setActiveScreen] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFeatures, setExpandedFeatures] = useState({})

  const currentPanel = useMemo(() => getPanel(activePanel), [activePanel])
  const searchResults = useMemo(() => searchAll(searchQuery), [searchQuery])

  const toggleFeature = (screenPath, featureIdx) => {
    const key = `${screenPath}-${featureIdx}`
    setExpandedFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const value = {
    panels,
    activePanel,
    setActivePanel,
    activeScreen,
    setActiveScreen,
    searchQuery,
    setSearchQuery,
    searchResults,
    currentPanel,
    expandedFeatures,
    toggleFeature,
  }

  return (
    <DocContext.Provider value={value}>
      {children}
    </DocContext.Provider>
  )
}

export function useDoc() {
  const ctx = useContext(DocContext)
  if (!ctx) throw new Error('useDoc must be used within DocProvider')
  return ctx
}
