import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      <div data-testid="environment">{state.metadata.environment}</div>
      <div data-testid="source-kafka-env">{state.source.kafkaEnv}</div>
      <div data-testid="sink-kafka-env">{state.sink.sinkKafkaEnv}</div>
      <div data-testid="kafka-topic">{state.source.kafkaTopic}</div>
      <div data-testid="sink-kafka-topic">{state.sink.sinkKafkaTopic}</div>
      <div data-testid="simulator-broker-env">{state.simulator?.brokerEnv || ''}</div>
      <div data-testid="simulator-topic">{state.simulator?.topic || ''}</div>
      <div data-testid="simulator-rows-count">{String(state.simulator?.rows?.length || 0)}</div>
    </div>
  )
}

function SimulatorStateControls() {
  const { actions } = useWizard()

  return (
    <div>
      <button
        type="button"
        onClick={() => actions.updateSimulator({
          brokerEnv: 'CAP',
          topic: 'sim-topic',
          rows: [
            {
              id: 'sim-row-1',
              messageFormat: 'json',
              sampleMessage: '{"id":"1"}',
              messagesPerSecond: 5,
              totalMessages: 50,
              intervalSeconds: 5,
              status: 'idle',
              statusMessage: '',
              remoteTaskId: null,
              sentCount: 0,
            },
          ],
        })}
      >
        Seed simulator state
      </button>
      <button
        type="button"
        onClick={() => actions.loadState({
          navigationMode: 'etl-config',
          metadata: { productType: 'Pricing', environment: 'PROD' },
          source: { kafkaEnv: 'CAP', kafkaTopic: 'orders' },
          sink: { sinkKafkaEnv: 'PROD', sinkKafkaTopic: 'orders.out' },
          completedSteps: [0, 1],
          currentStep: 0,
        })}
      >
        Load edit state
      </button>
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
          metadata: { productType: 'Catalog', environment: 'PROD' },
          source: { kafkaEnv: 'CAP' },
          sink: { sinkKafkaEnv: 'PROD' },
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
    expect(screen.getByTestId('environment')).toHaveTextContent('PROD')
    expect(screen.getByTestId('source-kafka-env')).toHaveTextContent('CAP')
    expect(screen.getByTestId('sink-kafka-env')).toHaveTextContent('PROD')
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

  it('preserves simulator state when loadState is used for deployment editing without simulator payload', async () => {
    const user = userEvent.setup()

    render(
      <WizardProvider user={user}>
        <SimulatorStateControls />
        <StateProbe />
      </WizardProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Seed simulator state' }))

    await waitFor(() => {
      expect(screen.getByTestId('simulator-broker-env')).toHaveTextContent('CAP')
      expect(screen.getByTestId('simulator-topic')).toHaveTextContent('sim-topic')
      expect(screen.getByTestId('simulator-rows-count')).toHaveTextContent('1')
    })

    await user.click(screen.getByRole('button', { name: 'Load edit state' }))

    await waitFor(() => {
      expect(screen.getByTestId('navigation-mode')).toHaveTextContent('etl-config')
      expect(screen.getByTestId('product-type')).toHaveTextContent('Pricing')
      expect(screen.getByTestId('simulator-broker-env')).toHaveTextContent('CAP')
      expect(screen.getByTestId('simulator-topic')).toHaveTextContent('sim-topic')
      expect(screen.getByTestId('simulator-rows-count')).toHaveTextContent('1')
    })
  })
})

