import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldShowPlacesMapPanel } from './places-map-panel'

describe('shouldShowPlacesMapPanel', () => {
  it('shows the panel when a place is selected', () => {
    assert.equal(shouldShowPlacesMapPanel({ hasSelectedPlace: true, hideSelectionPanel: false }), true)
  })

  it('hides the panel on mini-maps even when a place is selected', () => {
    assert.equal(shouldShowPlacesMapPanel({ hasSelectedPlace: true, hideSelectionPanel: true }), false)
  })

  it('hides the panel when nothing is selected', () => {
    assert.equal(shouldShowPlacesMapPanel({ hasSelectedPlace: false, hideSelectionPanel: false }), false)
  })
})
