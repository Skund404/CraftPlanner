/**
 * Electronics module E2E tests — comprehensive suite covering navigation,
 * circuit CRUD, component library (15 types), templates, simulation (linear
 * and nonlinear with operating regions), export, and catalogue integration.
 *
 * Prerequisites:
 *   - Shell running on http://localhost:9000 with electronics module loaded
 *   - Core running and connected (for catalogue tests)
 *   - Frontend rebuilt with electronics module registered
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = 'http://localhost:9000/modules/electronics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to an electronics route and wait for the sidebar to render. */
async function goElectronics(page: Page, path = '/electronics') {
  await page.goto(path)
  await page.waitForSelector('button:has-text("Home")', { timeout: 10_000 })
}

/** Create a circuit via API and return the parsed JSON. */
async function createCircuitApi(page: Page, name: string) {
  const resp = await page.request.post(`${BASE}/circuits`, { data: { name } })
  return resp.json()
}

/** Clean up a circuit by ID via API. */
async function deleteCircuitApi(page: Page, circuitId: string) {
  await page.request.delete(`${BASE}/circuits/${circuitId}`)
}

/** Build a voltage divider via API and return component IDs. */
async function buildVoltageDividerApi(page: Page, circuitId: string) {
  const v1 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'voltage_source', x: 100, y: 100 },
  })).json()

  const r1 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'resistor', x: 200, y: 100, value: '1000', unit: 'ohm' },
  })).json()

  const r2 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'resistor', x: 320, y: 100, value: '1000', unit: 'ohm' },
  })).json()

  const gnd = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'ground', x: 100, y: 300 },
  })).json()

  // Wire the divider: V1+ → VCC ← R1 → MID ← R2 → GND, V1- → GND
  for (const conn of [
    { component_id: v1.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: v1.id, pin_name: 'n', net_name: 'GND' },
    { component_id: r1.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: r1.id, pin_name: 'n', net_name: 'MID' },
    { component_id: r2.id, pin_name: 'p', net_name: 'MID' },
    { component_id: r2.id, pin_name: 'n', net_name: 'GND' },
    { component_id: gnd.id, pin_name: 'gnd', net_name: 'GND' },
  ]) {
    await page.request.post(`${BASE}/circuits/${circuitId}/connect`, { data: conn })
  }

  return { v1, r1, r2, gnd }
}

/** Build a forward-biased diode circuit: V1(5V) → R1(330Ω) → D1(1N4148) → GND. */
async function buildDiodeCircuitApi(page: Page, circuitId: string) {
  const v1 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'voltage_source', value: '5', x: 100, y: 100 },
  })).json()

  const r1 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'resistor', value: '330', x: 200, y: 100 },
  })).json()

  const d1 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'diode', x: 300, y: 100, model_params: { model: '1N4148' } },
  })).json()

  const gnd = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'ground', x: 100, y: 300 },
  })).json()

  for (const conn of [
    { component_id: v1.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: v1.id, pin_name: 'n', net_name: 'GND' },
    { component_id: r1.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: r1.id, pin_name: 'n', net_name: 'MID' },
    { component_id: d1.id, pin_name: 'anode', net_name: 'MID' },
    { component_id: d1.id, pin_name: 'cathode', net_name: 'GND' },
    { component_id: gnd.id, pin_name: 'gnd', net_name: 'GND' },
  ]) {
    await page.request.post(`${BASE}/circuits/${circuitId}/connect`, { data: conn })
  }

  return { v1, r1, d1, gnd }
}

/** Build a BJT common-emitter circuit: Vcc(12V) → Rb(100k) → Q1(2N3904) base, Rc(1k) → collector. */
async function buildBjtCircuitApi(page: Page, circuitId: string) {
  const vcc = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'voltage_source', value: '12', x: 100, y: 100 },
  })).json()

  const rb = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'resistor', value: '10M', x: 200, y: 100 },
  })).json()

  const rc = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'resistor', value: '1k', x: 320, y: 100 },
  })).json()

  const q1 = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'npn_bjt', x: 300, y: 200, model_params: { model: '2N3904' } },
  })).json()

  const gnd = await (await page.request.post(`${BASE}/circuits/${circuitId}/components`, {
    data: { component_type: 'ground', x: 100, y: 300 },
  })).json()

  for (const conn of [
    { component_id: vcc.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: vcc.id, pin_name: 'n', net_name: 'GND' },
    { component_id: rb.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: rb.id, pin_name: 'n', net_name: 'BASE' },
    { component_id: rc.id, pin_name: 'p', net_name: 'VCC' },
    { component_id: rc.id, pin_name: 'n', net_name: 'COLLECTOR' },
    { component_id: q1.id, pin_name: 'base', net_name: 'BASE' },
    { component_id: q1.id, pin_name: 'collector', net_name: 'COLLECTOR' },
    { component_id: q1.id, pin_name: 'emitter', net_name: 'GND' },
    { component_id: gnd.id, pin_name: 'gnd', net_name: 'GND' },
  ]) {
    await page.request.post(`${BASE}/circuits/${circuitId}/connect`, { data: conn })
  }

  return { vcc, rb, rc, q1, gnd }
}

// ===========================================================================
// 1. Sidebar navigation
// ===========================================================================

test.describe('Sidebar navigation', () => {
  test('visits all four views and back', async ({ page }) => {
    await goElectronics(page, '/electronics')
    await expect(page.getByRole('heading', { name: 'Electronics Lab' })).toBeVisible()

    // Circuits
    await page.click('button:has-text("Circuits")')
    await expect(page).toHaveURL(/\/electronics\/circuits/)
    await expect(page.getByRole('heading', { name: 'Circuits' })).toBeVisible()

    // Components
    await page.click('button:has-text("Components")')
    await expect(page).toHaveURL(/\/electronics\/components/)
    await expect(page.getByRole('heading', { name: 'Component Library' })).toBeVisible()

    // Catalogue
    await page.click('button:has-text("Catalogue")')
    await expect(page).toHaveURL(/\/electronics\/catalogue/)
    await expect(page.getByText('Component Catalogue')).toBeVisible()

    // Home
    await page.click('button:has-text("Home")')
    await expect(page).toHaveURL(/\/electronics$/)
    await expect(page.getByRole('heading', { name: 'Electronics Lab' })).toBeVisible()

    // Back to workshop link
    await expect(page.getByText('Back to workshop')).toBeVisible()
  })
})

// ===========================================================================
// 2. Circuit CRUD
// ===========================================================================

test.describe('Circuit CRUD', () => {
  test('create from home, verify in list, delete', async ({ page }) => {
    const circuitName = `E2E Home ${Date.now()}`

    await goElectronics(page, '/electronics')
    await page.fill('input[placeholder="New circuit name..."]', circuitName)
    await page.click('button:has-text("Create")')

    // Should navigate to editor
    await page.waitForURL('**/electronics/circuits/*', { timeout: 10_000 })
    await page.waitForTimeout(1000)
    await expect(page.locator(`h2:has-text("${circuitName}")`)).toBeVisible({ timeout: 5_000 })

    const circuitId = page.url().split('/').pop()!

    // Verify in circuits list
    await page.click('button:has-text("Circuits")')
    await page.waitForTimeout(1500)
    await expect(page.locator(`text="${circuitName}"`)).toBeVisible({ timeout: 5_000 })

    // Delete and verify removal
    await deleteCircuitApi(page, circuitId)
    await goElectronics(page, '/electronics/circuits')
    await page.waitForTimeout(1500)
    await expect(page.locator(`text="${circuitName}"`)).toHaveCount(0, { timeout: 5_000 })
  })

  test('create from circuits list page', async ({ page }) => {
    const circuitName = `E2E List ${Date.now()}`

    await goElectronics(page, '/electronics/circuits')
    await page.fill('input[placeholder="Name..."]', circuitName)
    await page.click('button:has-text("New")')

    await page.waitForURL('**/electronics/circuits/*', { timeout: 10_000 })
    const circuitId = page.url().split('/').pop()!

    try {
      await expect(page.locator(`h2:has-text("${circuitName}")`)).toBeVisible({ timeout: 5_000 })
    } finally {
      await deleteCircuitApi(page, circuitId)
    }
  })

  test('delete circuit via trash button', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E Trash ${Date.now()}`)

    await goElectronics(page, '/electronics/circuits')
    await page.waitForTimeout(1500)
    await expect(page.getByText(circuit.name)).toBeVisible({ timeout: 5_000 })

    // Auto-accept confirm dialog
    page.on('dialog', (d) => d.accept())

    // Find the circuit name button, navigate to parent row div, click the trash button
    const circuitBtn = page.locator('button').filter({ hasText: circuit.name })
    await circuitBtn.locator('xpath=..').locator('button').last().click()

    await page.waitForTimeout(1500)
    await expect(page.getByText(circuit.name)).toHaveCount(0, { timeout: 5_000 })
  })
})

// ===========================================================================
// 3. Component Library
// ===========================================================================

test.describe('Component Library', () => {
  test('shows all 15 types in 6 groups', async ({ page }) => {
    await goElectronics(page, '/electronics/components')
    await page.waitForTimeout(1500)

    // 6 category groups
    // Category headings use CSS text-transform:uppercase, but DOM text is mixed-case
    for (const group of ['Passive', 'Sources', 'Semiconductor', 'Transistor', 'IC', 'MCU']) {
      await expect(page.getByText(group, { exact: true }).first()).toBeVisible()
    }

    // All 15 component labels
    for (const label of [
      'Resistor', 'Capacitor', 'Inductor',
      'Voltage Source', 'Current Source', 'Ground',
      'Diode', 'Zener Diode', 'LED',
      'NPN BJT', 'PNP BJT',
      'NMOS FET', 'PMOS FET',
      'Op-Amp', 'Microcontroller',
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('shows pin info per component', async ({ page }) => {
    await goElectronics(page, '/electronics/components')
    await page.waitForTimeout(1500)

    await expect(page.getByText('Pins: p, n').first()).toBeVisible()
    await expect(page.getByText('Pins: gnd')).toBeVisible()
  })
})

// ===========================================================================
// 4. Templates
// ===========================================================================

test.describe('Templates', () => {
  test('home page shows template gallery', async ({ page }) => {
    await goElectronics(page, '/electronics')

    // Wait for templates to load from API
    await expect(page.getByRole('heading', { name: /Templates/ })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Voltage Divider').first()).toBeVisible()

    // At least one card shows component count
    await expect(page.getByText('components').first()).toBeVisible()
  })

  test('create circuit from template navigates to editor', async ({ page }) => {
    await goElectronics(page, '/electronics')

    // Wait for templates to load from API then click Voltage Divider
    await expect(page.getByRole('heading', { name: /Templates/ })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Voltage Divider/ }).click()
    await page.waitForURL('**/electronics/circuits/*', { timeout: 10_000 })

    const circuitId = page.url().split('/').pop()!

    try {
      // Editor should show components
      await page.waitForTimeout(1500)
      await expect(page.getByText('components').first()).toBeVisible()
    } finally {
      await deleteCircuitApi(page, circuitId)
    }
  })
})

// ===========================================================================
// 5. Circuit Editor
// ===========================================================================

test.describe('Circuit Editor', () => {
  test('palette shows component buttons with placement hint', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E Palette ${Date.now()}`)

    try {
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      // Key palette buttons visible (accessible names include short label prefix)
      await expect(page.getByRole('button', { name: 'R Resistor' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'C Capacitor' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'D Diode', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Q NPN BJT' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'U Op-Amp' })).toBeVisible()

      // Toggle placement mode
      await page.getByRole('button', { name: /^R Resistor/ }).click()
      await page.waitForTimeout(300)
      await expect(page.getByText('Click on canvas to place')).toBeVisible()

      await page.getByRole('button', { name: /^R Resistor/ }).click()
      await page.waitForTimeout(300)
      await expect(page.getByText('Click on canvas to place')).toBeHidden()
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })

  test('simulation panel has 7 sim types and export buttons', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E SimPanel ${Date.now()}`)

    try {
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      // Sim type dropdown with 7 options
      const select = page.locator('select')
      await expect(select).toBeVisible()
      const options = select.locator('option')
      await expect(options).toHaveCount(7)

      // Check key option labels
      await expect(options.filter({ hasText: 'DC Operating Point' })).toHaveCount(1)
      await expect(options.filter({ hasText: 'Monte Carlo' })).toHaveCount(1)
      await expect(options.filter({ hasText: 'Transient' })).toHaveCount(1)

      // Simulate button
      await expect(page.locator('button:has-text("Simulate")')).toBeVisible()

      // Export buttons
      await expect(page.getByText('SPICE')).toBeVisible()
      await expect(page.getByText('BOM')).toBeVisible()
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })

  test('simulate voltage divider shows results', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E VDiv Sim ${Date.now()}`)

    try {
      await buildVoltageDividerApi(page, circuit.id)
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      // Run simulation
      await page.click('button:has-text("Simulate")')

      // Wait for Complete status
      await expect(page.getByText('Complete')).toBeVisible({ timeout: 10_000 })

      // Node Voltages section (use span locators to avoid SVG text duplicates)
      await expect(page.getByText('Node Voltages')).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'VCC' })).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'MID' })).toBeVisible()

      // Component Results section
      await expect(page.getByText('Component Results')).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'R1' }).first()).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'R2' }).first()).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'V1' }).first()).toBeVisible()
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })

  test('simulation error for circuit without ground', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E NoGnd ${Date.now()}`)

    try {
      // Add components but no ground
      const v1 = await (await page.request.post(`${BASE}/circuits/${circuit.id}/components`, {
        data: { component_type: 'voltage_source', x: 100, y: 100 },
      })).json()

      const r1 = await (await page.request.post(`${BASE}/circuits/${circuit.id}/components`, {
        data: { component_type: 'resistor', x: 200, y: 100 },
      })).json()

      await page.request.post(`${BASE}/circuits/${circuit.id}/connect`, {
        data: { component_id: v1.id, pin_name: 'p', net_name: 'N001' },
      })
      await page.request.post(`${BASE}/circuits/${circuit.id}/connect`, {
        data: { component_id: r1.id, pin_name: 'p', net_name: 'N001' },
      })

      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      await page.click('button:has-text("Simulate")')
      await expect(page.getByText('Error').first()).toBeVisible({ timeout: 10_000 })
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })
})

// ===========================================================================
// 6. Nonlinear simulation
// ===========================================================================

test.describe('Nonlinear simulation', () => {
  test('diode forward bias shows operating region', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E Diode ${Date.now()}`)

    try {
      await buildDiodeCircuitApi(page, circuit.id)
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      await page.click('button:has-text("Simulate")')
      await expect(page.getByText('Complete')).toBeVisible({ timeout: 10_000 })

      // D1 should show "forward" operating region (use span to avoid SVG duplicates)
      await expect(page.locator('span').filter({ hasText: 'D1' }).first()).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'forward' })).toBeVisible()

      // NR convergence info
      await expect(page.getByText(/NR:.*iterations/)).toBeVisible()
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })

  test('BJT common emitter shows active region', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E BJT ${Date.now()}`)

    try {
      await buildBjtCircuitApi(page, circuit.id)
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      await page.click('button:has-text("Simulate")')
      await expect(page.getByText('Complete')).toBeVisible({ timeout: 10_000 })

      // Q1 should show "active" operating region in component results
      await expect(page.locator('span').filter({ hasText: 'Q1' })).toBeVisible()
      await expect(page.locator('span').filter({ hasText: 'active' })).toBeVisible()
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })
})

// ===========================================================================
// 7. Export
// ===========================================================================

test.describe('Export', () => {
  test('SPICE export triggers download', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E SPICE ${Date.now()}`)

    try {
      await buildVoltageDividerApi(page, circuit.id)
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      const downloadPromise = page.waitForEvent('download')
      await page.locator('button').filter({ hasText: 'SPICE' }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('.cir')
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })

  test('BOM export triggers download', async ({ page }) => {
    const circuit = await createCircuitApi(page, `E2E BOM ${Date.now()}`)

    try {
      await buildVoltageDividerApi(page, circuit.id)
      await goElectronics(page, `/electronics/circuits/${circuit.id}`)
      await page.waitForTimeout(1500)

      const downloadPromise = page.waitForEvent('download')
      await page.locator('button').filter({ hasText: 'BOM' }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('bom')
    } finally {
      await deleteCircuitApi(page, circuit.id)
    }
  })
})

// ===========================================================================
// 8. Catalogue
// ===========================================================================

test.describe('Catalogue', () => {
  test('catalogue view shows layout elements', async ({ page }) => {
    await goElectronics(page, '/electronics/catalogue')
    await page.waitForTimeout(1500)

    // Title and subtitle
    await expect(page.getByText('Component Catalogue')).toBeVisible()
    await expect(page.getByText('SPICE models from the catalogue')).toBeVisible()

    // Controls
    await expect(page.locator('select')).toBeVisible()
    await expect(page.locator('input[placeholder="Search models..."]')).toBeVisible()
    await expect(page.getByText('Seed Built-in Presets')).toBeVisible()

    // Empty/detail placeholder
    await expect(page.getByText('Select a model to view details')).toBeVisible()
  })

  test('seed and browse catalogue models', async ({ page }) => {
    await goElectronics(page, '/electronics/catalogue')
    await page.waitForTimeout(1500)

    // Click seed button
    await page.getByText('Seed Built-in Presets').click()

    // Wait for seed status
    await expect(page.getByText(/Seeded/)).toBeVisible({ timeout: 15_000 })

    // Model list should populate — wait for at least one model button
    await page.waitForTimeout(2000)

    // If models appeared, click the first one to show detail
    const modelButtons = page.locator('button').filter({ has: page.locator('.rounded-full') })
    const count = await modelButtons.count()

    if (count > 0) {
      await modelButtons.first().click()
      await page.waitForTimeout(500)

      // Detail panel should show SPICE Parameters
      await expect(page.getByText('SPICE Parameters')).toBeVisible({ timeout: 5_000 })
      await expect(page.getByText('Catalogue Path')).toBeVisible()
    }
  })
})
