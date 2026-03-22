import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DeployProgressModal from './DeployProgressModal.jsx'

describe('DeployProgressModal', () => {
  it('shows the failure detail only in the header when the deployment fails', () => {
    const errorText = 'The deployment API endpoint was not found. Verify that the backend server is running.'

    render(
      <DeployProgressModal
        isOpen
        isError
        errorMessage={errorText}
        steps={[
          { id: 'validate', label: 'Validating pipeline configuration', status: 'failed', error: errorText },
          { id: 'deploy', label: 'Deploying pipeline', status: 'pending', error: '' },
        ]}
      />
    )

    expect(screen.getByText('Deployment failed')).toBeInTheDocument()
    expect(screen.getByText(errorText)).toBeInTheDocument()
    expect(screen.getByText('Validating pipeline configuration')).toBeInTheDocument()
    expect(screen.getAllByText(errorText)).toHaveLength(1)
  })
})