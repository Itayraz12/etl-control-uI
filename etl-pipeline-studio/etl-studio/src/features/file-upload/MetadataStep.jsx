import { useEffect, useRef, useState } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { useMockMode } from '../../shared/store/mockModeContext.jsx'
import { fetchEntitySchema } from '../../shared/services/configService.js'
import { normalizeSourceSchema, ENVIRONMENTS } from '../../shared/types/index.js'
import { Card, CardTitle, FormRow, FormGroup } from '../../shared/components/index.jsx'

export default function MetadataStep() {
  const { state, actions } = useWizard()
  const { user } = useUser()
  const { entities } = useConfig()
  const { useMock } = useMockMode()
  const { metadata } = state
  const previousEntityRef = useRef(metadata.entityName)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [schemaError, setSchemaError] = useState('')
  const u = (k, v) => actions.updateMetadata({ [k]: v })

  // Sync team from user context when it changes
  useEffect(() => {
    if (user?.teamName && metadata.team !== user.teamName) {
      actions.updateMetadata({ team: user.teamName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.teamName])

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
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
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
            <FormGroup label="Team" required>
              <input value={user?.teamName || metadata.team || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </FormGroup>
            <FormGroup label="Environment" required>
              <select value={metadata.environment} onChange={e => u('environment', e.target.value)}>
                <option value="">select an environment...</option>
                {ENVIRONMENTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Entity Name" required>
              <select value={metadata.entityName} onChange={e => u('entityName', e.target.value)}>
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
      </div>
    </div>
  )
}
