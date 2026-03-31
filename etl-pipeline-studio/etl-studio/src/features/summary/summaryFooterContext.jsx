import { createContext, useContext, useMemo, useState } from 'react'

const SummaryFooterContext = createContext(null)

export function SummaryFooterProvider({ children }) {
  const [summaryFooterActions, setSummaryFooterActions] = useState(null)

  const value = useMemo(() => ({
    summaryFooterActions,
    setSummaryFooterActions,
  }), [summaryFooterActions])

  return (
    <SummaryFooterContext.Provider value={value}>
      {children}
    </SummaryFooterContext.Provider>
  )
}

export function useSummaryFooter() {
  return useContext(SummaryFooterContext)
}
