import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InfoHint, Tooltip } from './index.jsx'

describe('Tooltip placements', () => {
  it('renders InfoHint tooltips on the right side', () => {
    render(<InfoHint text="Right side hint" />)

    fireEvent.mouseEnter(screen.getByText('i'))

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Right side hint')
    expect(tooltip).toHaveStyle({
      left: 'calc(100% + 8px)',
      top: '50%',
      transform: 'translateY(-50%)',
    })
  })

  it('keeps default Tooltip placement above the trigger', () => {
    render(
      <Tooltip content="Top hint">
        <button type="button">Hover me</button>
      </Tooltip>
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover me' }))

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Top hint')
    expect(tooltip).toHaveStyle({
      bottom: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
    })
  })
})

