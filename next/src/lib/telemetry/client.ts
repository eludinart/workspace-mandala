/** Télémétrie client — stub MVP Mandala. */
export type TelemetryEvent = {
  name: string
  feature?: string
  path?: string
  trace_id?: string
  properties?: Record<string, unknown>
}

export function track(_ev: TelemetryEvent): void {}

export async function flush(): Promise<void> {}
