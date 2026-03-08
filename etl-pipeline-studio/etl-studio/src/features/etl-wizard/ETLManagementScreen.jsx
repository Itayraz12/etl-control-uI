export default function ETLManagementScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      gap: '20px',
      padding: '40px',
      background: 'var(--bg)',
    }}>
      <div style={{
        fontSize: '48px',
      }}>
        📊
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 700,
        color: 'var(--text)',
      }}>
        ETL Management
      </div>
      <div style={{
        fontSize: '14px',
        color: 'var(--muted)',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        This section will contain ETL pipeline monitoring, execution history, and management controls.
      </div>
      <div style={{
        marginTop: '20px',
        padding: '20px',
        background: 'var(--surf)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        maxWidth: '500px',
        fontSize: '12px',
        color: 'var(--muted)',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
          Coming Soon
        </div>
        <ul style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Pipeline Execution Monitor</li>
          <li>Job History & Analytics</li>
          <li>Configuration Management</li>
          <li>Performance Metrics</li>
          <li>System Alerts & Notifications</li>
        </ul>
      </div>
    </div>
  )
}
