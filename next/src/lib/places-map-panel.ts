/** Panneau bas de PlacesMap : détail du lieu sélectionné. */

export function shouldShowPlacesMapPanel(opts: {
  hasSelectedPlace: boolean
  hideSelectionPanel: boolean
}): boolean {
  return opts.hasSelectedPlace && !opts.hideSelectionPanel
}
