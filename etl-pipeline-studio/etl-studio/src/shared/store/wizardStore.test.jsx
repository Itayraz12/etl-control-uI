import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { WizardProvider, useWizard } from './wizardStore.jsx'
import { getWizardStorageKeyForUser } from './wizardPersistence.js'

function StateProbe() {
  const { state } = useWizard()

  return (
    <div>
      <div data-testid="navigation-mode">{state.navigationMode}</div>
      <div data-testid="current-step">{String(state.currentStep)}</div>
      <div data-testid="read-only">{String(state.readOnly)}</div>
      <div data-testid="product-type">{state.metadata.productType}</div>
      <div data-testid="kafka-topic">{state.source.kafkaTopic}</div>
      <div data-testid="sink-kafka-topic">{state.sink.sinkKafkaTopic}</div>
    </div>
  )
}

describe('WizardProvider preview boot', () => {
  const user = { userId: 'user-1', teamName: 'data-platform' }

  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('hydrates read-only state only for preview URLs that include the deployment id', async () => {
    localStorage.setItem(
      'etl-deployment-preview:dep-77:saved',
      JSON.stringify({
        wizardState: {
          navigationMode: 'etl-config',
          currentStep: 4,
          completedSteps: [0, 1, 2, 3, 4],
          readOnly: true,
          metadata: { productType: 'Catalog' },
        },
      }),
    )
    window.history.replaceState({}, '', '/?preview=true&deploymentId=dep-77&previewSource=saved')

    render(
      <WizardProvider user={user}>
        <StateProbe />
      </WizardProvider>,
    )

    expect(screen.getByTestId('navigation-mode')).toHaveTextContent('etl-config')
    expect(screen.getByTestId('current-step')).toHaveTextContent('4')
    expect(screen.getByTestId('read-only')).toHaveTextContent('true')
    expect(screen.getByTestId('product-type')).toHaveTextContent('Catalog')
  })

  it('keeps plain localhost boots editable even when persisted state previously contained readOnly', async () => {
    localStorage.setItem(
      getWizardStorageKeyForUser(user.userId),
      JSON.stringify({
        navigationMode: 'etl-config',
        currentStep: 2,
        completedSteps: [0, 1],
        readOnly: true,
        metadata: { productType: 'Pricing' },
      }),
    )

    render(
      <WizardProvider user={user}>
        <StateProbe />
      </WizardProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('navigation-mode')).toHaveTextContent('etl-config')
      expect(screen.getByTestId('current-step')).toHaveTextContent('2')
      expect(screen.getByTestId('read-only')).toHaveTextContent('false')
      expect(screen.getByTestId('product-type')).toHaveTextContent('Pricing')
    })
  })

  it('starts new wizard state with an empty Kafka topic by default', async () => {
    render(
      <WizardProvider user={user}>
        <StateProbe />
      </WizardProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('kafka-topic')).toHaveTextContent('')
    })
  })

  it('starts new wizard state with an empty sink Kafka topic by default', async () => {
    render(
      <WizardProvider user={user}>
        <StateProbe />
      </WizardProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('sink-kafka-topic')).toHaveTextContent('')
    })
  })
})

