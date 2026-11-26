import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// Screens run in a tab that entered farm 1 (the demo farm) on Select Farm, as a signed-in member's tab does. Set before
// the test file's imports too, since feature APIs read the tab's farm when they load. A test about a tab without a farm
// clears it itself.
const enterDemoFarm = () => sessionStorage.setItem('beefcare.currentFarmId', '1')
enterDemoFarm()

beforeEach(enterDemoFarm)

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
