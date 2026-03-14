import { createContext, useContext, useEffect, useState } from 'react';

export const MOCK_MODE_STORAGE_KEY = 'etl-studio-use-mock'

const MockModeContext = createContext({ useMock: true, setUseMock: () => {} });

export function parsePersistedMockMode(raw) {
  if (raw == null) return null

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'boolean') return parsed
    if (parsed && typeof parsed === 'object' && typeof parsed.useMock === 'boolean') {
      return parsed.useMock
    }
  } catch {}

  const normalized = String(raw).trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return null
}

export function readPersistedMockMode() {
  try {
    return parsePersistedMockMode(localStorage.getItem(MOCK_MODE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function MockModeProvider({ children }) {
  const [useMock, setUseMock] = useState(() => readPersistedMockMode() ?? true)

  useEffect(() => {
    try {
      localStorage.setItem(MOCK_MODE_STORAGE_KEY, JSON.stringify(useMock))
    } catch {}
  }, [useMock])

  return (
    <MockModeContext.Provider value={{ useMock, setUseMock }}>
      {children}
    </MockModeContext.Provider>
  )
}

export function useMockMode() {
  return useContext(MockModeContext)
}

