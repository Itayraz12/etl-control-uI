import { useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { useUser } from '../../shared/store/userContext.jsx'
import { useConfig } from '../../shared/store/configContext.jsx'
import { Card, CardTitle, FormRow, FormGroup, SidePanel } from '../../shared/components/index.jsx'

export default function MetadataStep() {
  const { state, actions } = useWizard()
  const { user } = useUser()
  const { entities } = useConfig()
  const { metadata } = state
  const u = (k, v) => actions.updateMetadata({ [k]: v })

  // Sync team from user context when it changes
  useEffect(() => {
    if (user?.teamName && metadata.team !== user.teamName) {
      actions.updateMetadata({ team: user.teamName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.teamName])


  return (
    <div style={{ display: 'flex', gap: 22, flex: 1, overflow: 'hidden' }}>
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
                {['dev', 'staging', 'production'].map(o => <option key={o}>{o}</option>)}
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
            </FormGroup>
          </FormRow>
        </Card>
      </div>

      <SidePanel title="Snapshot" items={[
        ['Entity',   `${metadata.entityName} ${metadata.schemaVersion || ''}`],
        ['Source',   metadata.productSource],
        ['Env',      metadata.environment],
        ['Team',     metadata.team],
        ['Type',     metadata.productType],
      ]} />
    </div>
  )
}
