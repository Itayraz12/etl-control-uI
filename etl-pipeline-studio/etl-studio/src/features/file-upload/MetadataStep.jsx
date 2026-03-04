import { useWizard } from '../../shared/store/wizardStore.jsx'
import { Card, CardTitle, FormRow, FormGroup, SidePanel } from '../../shared/components/index.jsx'

export default function MetadataStep() {
  const { state, actions } = useWizard()
  const { metadata } = state
  const u = (k, v) => actions.updateMetadata({ [k]: v })

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
              <select value={metadata.productType} onChange={e => u('productType', e.target.value)}>
                {['Inventory', 'Orders', 'CRM', 'Product', 'User'].map(o => <option key={o}>{o}</option>)}
              </select>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Team" required>
              <input value={metadata.team} onChange={e => u('team', e.target.value)} />
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
                {['Product', 'Order', 'User', 'InventoryItem'].map(o => <option key={o}>{o}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Schema Version">
              <select value={metadata.schemaVersion} onChange={e => u('schemaVersion', e.target.value)}>
                {['v1', 'v2', 'v3'].map(o => <option key={o}>{o}</option>)}
              </select>
            </FormGroup>
          </FormRow>
        </Card>

        <Card>
          <CardTitle>🔖 Custom Tags</CardTitle>
          <FormGroup hint="Comma-separated key:value pairs added to the pipeline definition">
            <input
              value={metadata.tags}
              onChange={e => u('tags', e.target.value)}
              placeholder="owner:team-alpha, priority:high, region:eu-west"
            />
          </FormGroup>
        </Card>
      </div>

      <SidePanel title="Snapshot" items={[
        ['Entity',   `${metadata.entityName} ${metadata.schemaVersion}`],
        ['Env',      metadata.environment],
        ['Team',     metadata.team],
        ['Type',     metadata.productType],
      ]} />
    </div>
  )
}
