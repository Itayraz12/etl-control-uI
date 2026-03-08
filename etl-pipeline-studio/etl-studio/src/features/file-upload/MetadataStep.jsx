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
              <input value={metadata.productType} onChange={e => u('productType', e.target.value)} />
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
          </FormRow>
        </Card>

        <Card>
          <CardTitle>🏷️ Data Catalog Options</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={metadata.shadow || false}
                onChange={e => u('shadow', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>📌 SHADOW</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={metadata.saknay || false}
                onChange={e => u('saknay', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>📤 SAKNAY</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={metadata.asg || false}
                onChange={e => u('asg', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>🏰 asg</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={() => actions.goNext(state.currentStep)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              ✓ Create
            </button>
            <button
              onClick={() => alert('Load functionality coming soon')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
            >
              📂 Load
            </button>
            <button
              onClick={() => alert('Delete functionality coming soon')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'transparent',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              🗑 Delete
            </button>
          </div>
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
