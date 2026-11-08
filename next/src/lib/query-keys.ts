/** Clés TanStack Query — toujours scopées par lieu quand les données le sont. */

export const queryKeys = {
  placeEvents: (slug: string) => ['place-events', slug] as const,
  placePosts: (slug: string) => ['place-posts', slug] as const,
  myCommunities: () => ['my-communities'] as const,
}
