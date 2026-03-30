import { useEffect, useRef, useState } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import { fetchEntitySchema } from '../../shared/services/configService.js'
import {
  normalizeSourceSchema,
  ENVIRONMENTS,
  getAllowedMetadataLocations,
  isProductionEnvironment,
  normalizeMetadataLocation,
} from '../../shared/types/index.js'
import { Card, CardTitle, FormRow, FormGroup } from '../../shared/components/index.jsx'

export default function MetadataStep() {
  const { state, actions } = useWizard()
  const { user } = useUser()
  const { entities } = useConfig()
  const { useMock } = useMockMode()
  const { metadata } = state
  const src = state.source
  const hasEnvironment = Boolean(String(metadata.environment ?? '').trim())
  const isProduction = isProductionEnvironment(metadata.environment)
  const allowedLocations = getAllowedMetadataLocations(metadata.environment)
  const normalizedLocation = normalizeMetadataLocation(metadata.location, metadata.environment)
  const previousEntityRef = useRef(metadata.entityName)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [schemaError, setSchemaError] = useState('')
  const u = (k, v) => actions.updateMetadata({ [k]: v })
  const updateSourceField = (k, v) => actions.updateSource({ [k]: v })
  const handleProductCodeChange = (value) => {
    u('productCode', String(value ?? '').replace(/\D+/g, ''))
  }

  // Sync team from user context when it changes
  useEffect(() => {
    if (user?.teamName && metadata.team !== user.teamName) {
      actions.updateMetadata({ team: user.teamName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.teamName])

  useEffect(() => {
    if (metadata.location !== normalizedLocation) {
      actions.updateMetadata({ location: normalizedLocation })
    }
  }, [actions, metadata.location, normalizedLocation])

  useEffect(() => {
    const entityName = String(metadata.entityName ?? '').trim()
    const previousEntityName = String(previousEntityRef.current ?? '').trim()

    if (!entityName) {
      setSchemaError('')
      setLoadingSchema(false)
      actions.setTargetSchema([])
      if (previousEntityName) {
        actions.setMappings([])
      }
      previousEntityRef.current = entityName
      return
    }

    let isActive = true
    setLoadingSchema(true)
    setSchemaError('')

    fetchEntitySchema(entityName, useMock)
      .then(schemaResponse => {
        if (!isActive) return
        const schema = normalizeSourceSchema(schemaResponse)
        if (schema.length === 0) {
          throw new Error('Entity schema returned no fields')
        }
        actions.setTargetSchema(schema)
        if (previousEntityName && previousEntityName !== entityName) {
          actions.setMappings([])
        }
        previousEntityRef.current = entityName
      })
      .catch(error => {
        if (!isActive) return
        actions.setTargetSchema([])
        setSchemaError(error?.message || 'Failed to load entity schema.')
      })
      .finally(() => {
        if (!isActive) return
        setLoadingSchema(false)
      })

    return () => {
      isActive = false
    }
  }, [actions, metadata.entityName, useMock])


  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 30px 40px' }}>
        <Card>
          <CardTitle>🏷️ Pipeline Metadata</CardTitle>
          <FormRow>
            <FormGroup label="Product Source" required>
              <input value={metadata.productSource} onChange={e => u('productSource', e.target.value)} />
            </FormGroup>
            <FormGroup label="Product Type" required>
              <input value={metadata.productType} onChange={e => u('productType', e.target.value)} />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Product Code">
              <input
                value={metadata.productCode || ''}
                onChange={e => handleProductCodeChange(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Numbers only"
              />
            </FormGroup>
            <FormGroup label="Team" required>
              <input value={user?.teamName || metadata.team || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Environment" required>
              <select
                aria-label="Environment"
                value={metadata.environment}
                onChange={e => actions.updateMetadata({
                  environment: e.target.value,
                  location: normalizeMetadataLocation('', e.target.value),
                })}
              >
                <option value="">select an environment...</option>
                {ENVIRONMENTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Location" required={hasEnvironment}>
              <select
                aria-label="Location"
                value={normalizedLocation}
                disabled={!hasEnvironment}
                onChange={e => u('location', normalizeMetadataLocation(e.target.value, metadata.environment))}
              >
                {(!hasEnvironment || isProduction) && <option value="">Select a location...</option>}
                {allowedLocations.map(location => <option key={location} value={location}>{location}</option>)}
              </select>
              {!hasEnvironment && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>Select an environment to choose a location.</div>}
              {hasEnvironment && !isProduction && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>Non-production environments are limited to HOME.</div>}
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Entity Name" required>
              <select aria-label="Entity Name" value={metadata.entityName} onChange={e => u('entityName', e.target.value)}>
                <option value="">Select an entity...</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.type}>{ent.name} ({ent.type})</option>
                ))}
              </select>
              {loadingSchema && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>Loading entity schema…</div>}
              {!!schemaError && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)' }}>{schemaError}</div>}
            </FormGroup>
          </FormRow>
        </Card>

        <Card>
          <CardTitle>📊 Data Stream Info</CardTitle>
          <FormRow>
            <FormGroup label="Streaming Continuity" required>
              <select value={src.streamingContinuity || 'continuous'} onChange={e => updateSourceField('streamingContinuity', e.target.value)}>
                <option value="once">Once</option>
                <option value="every-hour">Every Hour</option>
                <option value="every-few-hours">Every Few Hours</option>
                <option value="every-day">Once a Day</option>
                <option value="continuous">Continuous</option>
              </select>
            </FormGroup>
            <FormGroup label="Avg Records Per Day" required>
              <select value={src.recordsPerDay || 'millions'} onChange={e => updateSourceField('recordsPerDay', e.target.value)}>
                <option value="hundreds">Hundreds</option>
                <option value="thousands">Thousands</option>
                <option value="hun-thousands">Hundred of Thousands</option>
                <option value="millions">A Few Millions</option>
                <option value="tens-millions">Tens of Millions</option>
                <option value="hundreds-millions">Hundreds of Millions</option>
              </select>
            </FormGroup>
          </FormRow>
        </Card>
      </div>
    </div>
  )
}
