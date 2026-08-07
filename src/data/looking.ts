/** Casual-encounter intents — not dating labels */
export const LOOKING_OPTIONS = [
  'Right now',
  'Hosting',
  'Cruising',
  'Car',
  'Hotel',
  'Tonight',
] as const

export type LookingOption = (typeof LOOKING_OPTIONS)[number]

export const LOOKING_FILTERS = ['All', ...LOOKING_OPTIONS] as const

export const LOOKING_HINTS: Record<LookingOption, string> = {
  'Right now': 'Free in the next hour — say what you want.',
  Hosting: 'Place ready. Be clear about the vibe.',
  Cruising: 'Out nearby and looking for a quick meet.',
  Car: 'Mobile / parked — discreet only.',
  Hotel: 'Room or lobby meet — keep it short and clear.',
  Tonight: 'Later tonight, not necessarily this minute.',
}
