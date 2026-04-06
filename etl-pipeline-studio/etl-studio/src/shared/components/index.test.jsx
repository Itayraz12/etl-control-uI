import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FilterTabs, FormHint, InfoHint, Tooltip } from './index.jsx'

afterEach(() => {
  document.documentElement.dataset.theme = 'dark'
})

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

  it('uses a readable light-mode palette for tooltip and inline hint text', () => {
    document.documentElement.dataset.theme = 'light'

    render(
      <>
        <InfoHint text="Readable hint" />
        <FormHint>Inline help text</FormHint>
      </>
    )

    fireEvent.mouseEnter(screen.getByText('i'))

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveStyle({
      color: '#1f2937',
      boxShadow: '0 12px 28px rgba(15,23,42,0.12)',
    })
    expect(tooltip.style.background).toContain('linear-gradient')

    expect(screen.getByText('Inline help text')).toHaveStyle({
      color: '#475569',
      background: 'rgba(148,163,184,0.12)',
    })
  })
})

describe('FilterTabs styling overrides', () => {
  it('supports styling a compact options group with separators between tabs', () => {
    render(
      <FilterTabs
        tabs={[
          { id: 'all', label: 'All', count: 3 },
          { id: 'prod', label: 'Prod', count: 1 },
        ]}
        activeTab="all"
        rowStyle={{ minWidth: 'fit-content', gap: 0, borderBottomWidth: 0, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--border)' }}
        tabStyle={{ background: 'transparent', padding: '12px 14px 13px' }}
        getTabStyle={(_tab, { isLast }) => ({ borderRight: isLast ? 'none' : '1px solid var(--border)' })}
      />
    )

    const allTab = screen.getByRole('button', { name: /all/i })
    const prodTab = screen.getByRole('button', { name: /prod/i })
    const tabRow = allTab.parentElement

    expect(allTab.getAttribute('style')).toContain('border-right: 1px solid var(--border)')
    expect(prodTab.getAttribute('style')).not.toContain('border-right: 1px solid var(--border)')
    expect(tabRow.getAttribute('style')).toContain('border-bottom-width: 0px')
    expect(tabRow.getAttribute('style')).toContain('min-width: fit-content')
    expect(tabRow.getAttribute('style')).toContain('gap: 0')
    expect(tabRow.getAttribute('style')).toContain('box-shadow: inset 0 0 0 1px var(--border)')
  })
})

