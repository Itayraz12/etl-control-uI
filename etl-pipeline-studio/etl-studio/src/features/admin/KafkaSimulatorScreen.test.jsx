import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KafkaSimulatorScreen from './KafkaSimulatorScreen.jsx'

const mockUpdateSimulator = vi.fn()
const mockStartSimulation = vi.fn()
const mockStopSimulation = vi.fn()
const mockDeleteSimulation = vi.fn()
const mockTestKafkaConnection = vi.fn()
const mockGetSimulationStatus = vi.fn()
const mockGetSimulationPlan = vi.fn()
const mockGetSimulationPlans = vi.fn()
const mockSaveSimulationPlan = vi.fn()
const mockDeleteSimulationPlan = vi.fn()

const mockState = {
  simulator: {
    brokerEnv: 'CAP',
    topic: 'sim-topic',
    connTest: null,
    rows: [
      {
        id: 'row-1',
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
  },
}

vi.mock('../../shared/store/wizardStore.jsx', () => ({
  useWizard: () => ({
    state: mockState,
    actions: {
      updateSimulator: mockUpdateSimulator,
    },
  }),
}))

vi.mock('../../shared/services/simulatorService.js', () => ({
  startSimulation: (...args) => mockStartSimulation(...args),
  stopSimulation: (...args) => mockStopSimulation(...args),
  deleteSimulation: (...args) => mockDeleteSimulation(...args),
  testKafkaConnection: (...args) => mockTestKafkaConnection(...args),
  getSimulationStatus: (...args) => mockGetSimulationStatus(...args),
  getSimulationPlan: (...args) => mockGetSimulationPlan(...args),
  getSimulationPlans: (...args) => mockGetSimulationPlans(...args),
  saveSimulationPlan: (...args) => mockSaveSimulationPlan(...args),
  deleteSimulationPlan: (...args) => mockDeleteSimulationPlan(...args),
}))

describe('KafkaSimulatorScreen', () => {
  beforeEach(() => {
    mockUpdateSimulator.mockReset()
    mockStartSimulation.mockReset()
    mockStopSimulation.mockReset()
    mockDeleteSimulation.mockReset()
    mockTestKafkaConnection.mockReset()
    mockGetSimulationStatus.mockReset()
    mockGetSimulationPlan.mockReset()
    mockGetSimulationPlans.mockReset()
    mockSaveSimulationPlan.mockReset()
    mockDeleteSimulationPlan.mockReset()
    mockState.simulator = {
      brokerEnv: 'CAP',
      topic: 'sim-topic',
      connTest: null,
      rows: [
        {
          id: 'row-1',
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
    }
  })

  it('loads and shows the saved test plan list by name without showing plan ids in the table', async () => {
    mockGetSimulationPlans.mockResolvedValue([
      { id: 'plan-1', name: 'Nightly Smoke' },
      { id: 'plan-2', name: 'Burst Load' },
    ])

    render(<KafkaSimulatorScreen />)

    await waitFor(() => {
      expect(mockGetSimulationPlans).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Nightly Smoke')).toBeInTheDocument()
    expect(screen.getByText('Burst Load')).toBeInTheDocument()
    expect(screen.queryByText('Plan ID')).not.toBeInTheDocument()
    expect(screen.queryByText('plan-1')).not.toBeInTheDocument()
    expect(screen.queryByText('plan-2')).not.toBeInTheDocument()
  })

  it('saves the current simulator task plan with an auto-generated numeric id and the entered name', async () => {
    const user = userEvent.setup()
    mockGetSimulationPlans
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: '1', name: 'Nightly Smoke' }])
    mockSaveSimulationPlan.mockResolvedValue({
      id: '1',
      name: 'Nightly Smoke',
      brokerEnv: 'CAP',
      topic: 'sim-topic',
      rows: mockState.simulator.rows,
    })

    render(<KafkaSimulatorScreen />)

    await waitFor(() => {
      expect(mockGetSimulationPlans).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByLabelText('Plan ID')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load plan$/i })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Plan Name'), 'Nightly Smoke')
    await user.click(screen.getByRole('button', { name: /save plan/i }))

    await waitFor(() => {
      expect(mockSaveSimulationPlan).toHaveBeenCalledWith({
        id: '1',
        name: 'Nightly Smoke',
        simulator: mockState.simulator,
      })
    })

    await waitFor(() => {
      expect(mockGetSimulationPlans).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Saved test plan Nightly Smoke.')
    const savedPlanRow = screen.getByRole('row', { name: /Nightly Smoke/i })
    expect(within(savedPlanRow).getByText('Nightly Smoke')).toBeInTheDocument()
    expect(within(savedPlanRow).queryByText('1')).not.toBeInTheDocument()
  })

  it('loads a selected saved plan and applies it to the simulator state', async () => {
    const user = userEvent.setup()
    mockGetSimulationPlans.mockResolvedValue([{ id: 'plan-2', name: 'Burst Load' }])
    mockGetSimulationPlan.mockResolvedValue({
      id: 'plan-2',
      name: 'Burst Load',
      brokerEnv: 'HOME',
      topic: 'burst-topic',
      rows: [
        {
          id: 'row-2',
          messageFormat: 'csv',
          sampleMessage: 'a,b,c',
          messagesPerSecond: 3,
          totalMessages: 25,
          intervalSeconds: 10,
          status: 'idle',
          statusMessage: '',
          remoteTaskId: null,
          sentCount: 0,
          _loading: false,
        },
      ],
    })

    render(<KafkaSimulatorScreen />)

    await waitFor(() => {
      expect(mockGetSimulationPlans).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole('button', { name: 'Load plan Burst Load' }))

    await waitFor(() => {
      expect(mockGetSimulationPlan).toHaveBeenCalledWith({ id: 'plan-2', name: 'Burst Load' })
    })

    expect(mockUpdateSimulator).toHaveBeenCalledWith({
      brokerEnv: 'HOME',
      topic: 'burst-topic',
      rows: [
        expect.objectContaining({
          id: 'row-2',
          messageFormat: 'csv',
          sampleMessage: 'a,b,c',
        }),
      ],
      connTest: null,
    })
    expect(screen.getByLabelText('Plan Name')).toHaveValue('Burst Load')
    expect(screen.getByRole('status')).toHaveTextContent('Loaded test plan Burst Load.')
  })

  it('deletes a saved plan from the table and refreshes the list', async () => {
    const user = userEvent.setup()
    mockGetSimulationPlans
      .mockResolvedValueOnce([{ id: 'plan-3', name: 'Regression Smoke' }])
      .mockResolvedValueOnce([])
    mockDeleteSimulationPlan.mockResolvedValue({ success: true })

    render(<KafkaSimulatorScreen />)

    await waitFor(() => {
      expect(mockGetSimulationPlans).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole('button', { name: 'Delete plan Regression Smoke' }))

    await waitFor(() => {
      expect(mockDeleteSimulationPlan).toHaveBeenCalledWith({ id: 'plan-3', name: 'Regression Smoke' })
    })

    await waitFor(() => {
      expect(mockGetSimulationPlans).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Deleted test plan Regression Smoke.')
    expect(screen.queryByText('Regression Smoke')).not.toBeInTheDocument()
  })
})

