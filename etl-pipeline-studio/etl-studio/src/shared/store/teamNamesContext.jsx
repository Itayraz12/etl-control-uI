import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchTeamNames } from '../services/teamNamesService.js'
import { useMockMode } from './mockModeContext.jsx'
import { MOCK_TEAM_NAMES } from '../services/authService.js'

const TeamNamesContext = createContext({
  teamNames: [],
  loadingTeamNames: false,
  teamNamesError: '',
  refreshTeamNames: () => Promise.resolve([]),
})

export function TeamNamesProvider({ children }) {
  const { useMock } = useMockMode()
  const [teamNames, setTeamNames] = useState([])
  const [loadingTeamNames, setLoadingTeamNames] = useState(false)
  const [teamNamesError, setTeamNamesError] = useState('')

  const refreshTeamNames = useCallback(async () => {
    if (useMock) {
      setTeamNames(MOCK_TEAM_NAMES)
      setTeamNamesError('')
      setLoadingTeamNames(false)
      return MOCK_TEAM_NAMES
    }

    setLoadingTeamNames(true)
    setTeamNamesError('')

    try {
      const nextTeamNames = await fetchTeamNames()
      setTeamNames(nextTeamNames)
      return nextTeamNames
    } catch (error) {
      setTeamNames([])
      setTeamNamesError(error instanceof Error ? error.message : 'Failed to load team names')
      return []
    } finally {
      setLoadingTeamNames(false)
    }
  }, [useMock])

  useEffect(() => {
    refreshTeamNames()
  }, [refreshTeamNames])

  const value = useMemo(() => ({
    teamNames,
    loadingTeamNames,
    teamNamesError,
    refreshTeamNames,
  }), [loadingTeamNames, refreshTeamNames, teamNames, teamNamesError])

  return (
    <TeamNamesContext.Provider value={value}>
      {children}
    </TeamNamesContext.Provider>
  )
}

export function useTeamNames() {
  return useContext(TeamNamesContext)
}

