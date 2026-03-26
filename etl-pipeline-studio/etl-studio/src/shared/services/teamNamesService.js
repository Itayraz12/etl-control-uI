import { API_BASE } from './appConfig.js'

function normalizeTeamName(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    return String(value.name ?? value.teamName ?? value.value ?? '').trim()
  }
  return String(value).trim()
}

export function normalizeTeamNames(payload) {
  if (!Array.isArray(payload)) return []

  return payload
    .map(normalizeTeamName)
    .filter(Boolean)
    .filter((teamName, index, list) => list.indexOf(teamName) === index)
}

export async function fetchTeamNames() {
  const response = await fetch(`${API_BASE}/backend/teamNames`)
  if (!response.ok) {
    throw new Error(`Failed to fetch team names: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return normalizeTeamNames(payload)
}

