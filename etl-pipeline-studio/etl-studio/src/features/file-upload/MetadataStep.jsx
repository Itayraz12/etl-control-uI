import { useEffect, useRef } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { useTeamNames } from '../../shared/store/teamNamesContext.jsx'
import {
  MOCK_RECORDS_PER_DAY,
  MOCK_STREAMING_CONTINUITIES,
} from '../../shared/services/configService.js'
import {
  normalizeSourceSchema,
  ENVIRONMENT_OPTIONS,
  getAllowedMetadataLocations,
  isProductionEnvironment,
  normalizeMetadataLocation,
} from '../../shared/types/index.js'
import { PRODUCT_CODE_LABEL } from '../../shared/services/appConfig.js'
import { Card, CardTitle, FormRow, FormGroup } from '../../shared/components/index.jsx'
import { getMissingMetadataRequiredFields } from '../../shared/services/wizardValidation.js'

export default function MetadataStep() {
  const { state, actions } = useWizard()
  const { user } = useUser()
  const {
    entities,
    streamingContinuities = MOCK_STREAMING_CONTINUITIES,
    recordsPerDay = MOCK_RECORDS_PER_DAY,
    selectedEntitySchema = [],
    selectedEntitySchemaName = '',
    loadingEntitySchema = false,
    entitySchemaError = '',
  } = useConfig()
  const { teamNames } = useTeamNames()
  const { metadata } = state
  const src = state.source
  const isAdminUser = user?.role === 'admin'
  const teamOptions = Array.from(new Set([
    String(user?.teamName ?? '').trim(),
    String(metadata.team ?? '').trim(),
    ...teamNames,
  ].filter(Boolean)))
  const hasEnvironment = Boolean(String(metadata.environment ?? '').trim())
  const isProduction = isProductionEnvironment(metadata.environment)
  const allowedLocations = getAllowedMetadataLocations(metadata.environment)
  const normalizedLocation = normalizeMetadataLocation(metadata.location, metadata.environment)
  const missingRequiredFields = new Set(getMissingMetadataRequiredFields(metadata, src))
  const previousEntityRef = useRef(metadata.entityName)
  const u = (k, v) => actions.updateMetadata({ [k]: v })
  const updateSourceField = (k, v) => actions.updateSource({ [k]: v })
  const isInvalid = (field) => missingRequiredFields.has(field) ? 'true' : undefined
  const handleProductCodeChange = (value) => {
    u('productCode', String(value ?? '').replace(/\D+/g, ''))
  }

  // Sync team from user context when it changes
  useEffect(() => {
    if (!user?.teamName) return

    if (!isAdminUser && metadata.team !== user.teamName) {
      actions.updateMetadata({ team: user.teamName })
      return
    }

    if (isAdminUser && !String(metadata.team ?? '').trim()) {
      actions.updateMetadata({ team: user.teamName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser, metadata.team, user?.teamName])

  useEffect(() => {
    if (metadata.location !== normalizedLocation) {
      actions.updateMetadata({ location: normalizedLocation })
    }
  }, [actions, metadata.location, normalizedLocation])

  useEffect(() => {
    const entityName = String(metadata.entityName ?? '').trim()
    const previousEntityName = String(previousEntityRef.current ?? '').trim()
    const resolvedEntityName = String(selectedEntitySchemaName ?? '').trim()

    if (!entityName) {
      actions.setTargetSchema([])
      if (previousEntityName) {
        actions.setMappings([])
      }
      previousEntityRef.current = entityName
      return
    }

    if (loadingEntitySchema || resolvedEntityName !== entityName) {
      return
    }

    if (entitySchemaError) {
      actions.setTargetSchema([])
      return
    }

    const schema = normalizeSourceSchema(selectedEntitySchema)
    if (schema.length === 0) {
      actions.setTargetSchema([])
      return
    }

    actions.setTargetSchema(schema)
    if (previousEntityName && previousEntityName !== entityName) {
      actions.setMappings([])
    }
    previousEntityRef.current = entityName
  }, [actions, entitySchemaError, loadingEntitySchema, metadata.entityName, selectedEntitySchema, selectedEntitySchemaName])


  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 30px 40px' }}>
        <Card>
          <CardTitle>🏷️ Pipeline Metadata</CardTitle>
          <FormRow>
            <FormGroup label="Product Source" required>
              <input aria-label="Product Source" aria-invalid={isInvalid('product source')} value={metadata.productSource} onChange={e => u('productSource', e.target.value)} />
            </FormGroup>
            <FormGroup label="Product Type" required>
              <input aria-label="Product Type" aria-invalid={isInvalid('product type')} value={metadata.productType} onChange={e => u('productType', e.target.value)} />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={PRODUCT_CODE_LABEL}>
              <input
                aria-label={PRODUCT_CODE_LABEL}
                value={metadata.productCode || ''}
                onChange={e => handleProductCodeChange(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Numbers only"
              />
            </FormGroup>
            <FormGroup label="Team" required>
              <select
                aria-label="Team"
                aria-invalid={isInvalid('team')}
                value={metadata.team || user?.teamName || ''}
                onChange={e => u('team', e.target.value)}
                disabled={!isAdminUser}
                style={!isAdminUser ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                {teamOptions.length === 0 && <option value="">Select a team...</option>}
                {teamOptions.map(teamOption => (
                  <option key={teamOption} value={teamOption}>{teamOption}</option>
                ))}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Environment" required>
              <select
                aria-label="Environment"
                aria-invalid={isInvalid('environment')}
                value={metadata.environment}
                onChange={e => actions.updateMetadata({
                  environment: e.target.value,
                  location: normalizeMetadataLocation('', e.target.value),
                })}
              >
                <option value="">select an environment...</option>
                {ENVIRONMENT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Location" required={hasEnvironment}>
              <select
                aria-label="Location"
                aria-invalid={isInvalid('location')}
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
              <select aria-label="Entity Name" aria-invalid={isInvalid('entity name')} value={metadata.entityName} onChange={e => u('entityName', e.target.value)}>
                <option value="">Select an entity...</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.type}>{ent.name}</option>
                ))}
              </select>
              {loadingEntitySchema && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>Loading entity schema…</div>}
              {!!entitySchemaError && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)' }}>{entitySchemaError}</div>}
            </FormGroup>
          </FormRow>
        </Card>

        <Card>
          <CardTitle>📊 Data Stream Info</CardTitle>
          <FormRow>
            <FormGroup label="Streaming Continuity" required>
              <select aria-label="Streaming Continuity" aria-invalid={isInvalid('streaming continuity')} value={src.streamingContinuity || ''} onChange={e => updateSourceField('streamingContinuity', e.target.value)}>
                <option value="">Select data stream info...</option>
                {streamingContinuities.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Avg Records Per Day" required>
              <select aria-label="Avg Records Per Day" aria-invalid={isInvalid('avg records per day')} value={src.recordsPerDay || ''} onChange={e => updateSourceField('recordsPerDay', e.target.value)}>
                <option value="">Select avg records per day...</option>
                {recordsPerDay.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormGroup>
          </FormRow>
        </Card>
      </div>
    </div>
  )
}
