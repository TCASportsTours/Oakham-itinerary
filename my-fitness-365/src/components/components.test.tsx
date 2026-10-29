import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { WeightInput } from './WeightInput'
import { HeightInput } from './HeightInput'
import { WeightField } from './WeightField'
import { Segmented } from './ui'
import { openDatabase, db } from '@/data/db'
import { create, setSession } from '@/data/repo'
import { wipeLocalData } from '@/services/backup'

describe('WeightInput', () => {
  it('reports kg from stones and pounds', async () => {
    const onChange = vi.fn()
    render(<WeightInput unit="st" valueKg={null} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Stones'), '13')
    await userEvent.type(screen.getByLabelText('Pounds'), '7')
    const kg = onChange.mock.calls.at(-1)![0]
    expect(kg).toBeCloseTo(85.73, 2)
  })

  it('rejects impossible pounds (≥14) instead of guessing', async () => {
    const onChange = vi.fn()
    render(<WeightInput unit="st" valueKg={null} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Stones'), '13')
    await userEvent.type(screen.getByLabelText('Pounds'), '15')
    expect(onChange.mock.calls.at(-1)![0]).toBeNull()
  })

  it('accepts kilograms', async () => {
    const onChange = vi.fn()
    render(<WeightInput unit="kg" valueKg={null} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Weight in kilograms'), '87.4')
    expect(onChange.mock.calls.at(-1)![0]).toBe(87.4)
  })
})

describe('HeightInput', () => {
  it('saves feet and inches as centimetres when focus leaves', async () => {
    const onSave = vi.fn()
    render(<><HeightInput valueCm={175} onSave={onSave} /><button>elsewhere</button></>)
    expect(screen.getByLabelText('Feet')).toHaveValue(5)
    expect(screen.getByLabelText('Inches')).toHaveValue(8.9)
    await userEvent.clear(screen.getByLabelText('Inches'))
    await userEvent.type(screen.getByLabelText('Inches'), '10')
    await userEvent.click(screen.getByText('elsewhere'))
    expect(onSave).toHaveBeenCalledWith(177.8)
  })
  it('switches to centimetres keeping the value', async () => {
    render(<HeightInput valueCm={175} onSave={vi.fn()} />)
    await userEvent.click(screen.getByRole('radio', { name: 'cm' }))
    expect(screen.getByLabelText('Height in centimetres')).toHaveValue(175)
  })
})

describe('WeightField', () => {
  it('saves a goal entered in stones and pounds as kg', async () => {
    const onSave = vi.fn()
    render(<><WeightField id="t" label="First milestone" unit="st" valueKg={83} onSave={onSave} /><button>elsewhere</button></>)
    expect(screen.getByLabelText('Stones')).toHaveValue(13)
    await userEvent.clear(screen.getByLabelText('Stones'))
    await userEvent.type(screen.getByLabelText('Stones'), '12')
    await userEvent.clear(screen.getByLabelText('Pounds'))
    await userEvent.type(screen.getByLabelText('Pounds'), '7')
    await userEvent.click(screen.getByText('elsewhere'))
    expect(onSave.mock.calls.at(-1)![0]).toBeCloseTo(79.379, 2)
  })
})

describe('Segmented', () => {
  it('is an accessible radio group', async () => {
    function Demo() {
      const [v, setV] = useState<'a' | 'b'>('a')
      return <Segmented label="Pick" value={v} onChange={setV} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
    }
    render(<Demo />)
    await userEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('sign-out hygiene', () => {
  it('wipes every local table, including photo blobs and the sync queue', async () => {
    openDatabase(`wipe-${Math.random()}`)
    setSession('u', true)
    await create('weight_entries', { date: '2026-11-01', weight_kg: 88, notes: '' })
    await db.blobs.put({ id: 'p', user_id: 'u', blob: new Blob(['x']), created_at: '' })
    await wipeLocalData()
    for (const t of db.tables) expect(await t.count(), t.name).toBe(0)
  })
})
