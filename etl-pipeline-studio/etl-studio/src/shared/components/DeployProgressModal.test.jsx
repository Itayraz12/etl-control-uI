import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('keeps the current active step centered as progress advances', () => {
    const scrollIntoViewSpy = vi.fn()
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0)
      return 1
    })
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy

    const { rerender } = render(
      <DeployProgressModal
        isOpen
        currentStepIndex={1}
        steps={[
          { id: 'validate', label: 'Validate configuration', status: 'done', error: '' },
          { id: 'deploy', label: 'Deploy pipeline', status: 'active', error: '' },
          { id: 'health', label: 'Run health checks', status: 'pending', error: '' },
        ]}
      />
    )

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })

    rerender(
      <DeployProgressModal
        isOpen
        currentStepIndex={2}
        steps={[
          { id: 'validate', label: 'Validate configuration', status: 'done', error: '' },
          { id: 'deploy', label: 'Deploy pipeline', status: 'done', error: '' },
          { id: 'health', label: 'Run health checks', status: 'active', error: '' },
        ]}
      />
    )

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2)
    expect(requestAnimationFrameSpy).toHaveBeenCalled()

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })
})