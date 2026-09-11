// Decorative fallback stills + chin copy for hero-cards-transition.
// Cycled when authored cards run out so the 12-tile wall stays full.
// Files sit next to this module; URLs resolve from import.meta.url.
export const POSTERS = [
  { slug: 'hud-trapped', title: 'HUD: Trapped', author: 'Lily Snow', date: '2024-03-26' },
  { slug: 'turmoil', title: 'Turmoil', author: 'Marcus Vega', date: '2024-04-12' },
  { slug: 'night-silhouettes', title: 'Night Silhouettes', author: 'Aria Chen', date: '2024-02-18' },
  { slug: 'hazy-recollections', title: 'Hazy Recollections', author: 'James Wright', date: '2024-05-04' },
  { slug: 'lonely-highway', title: 'Lonely Highway', author: 'Sofia Reyes', date: '2024-01-22' },
  { slug: 'wanderer', title: 'Wanderer', author: 'Theo Park', date: '2024-06-09' },
  { slug: 'midnight-journey', title: 'Midnight Journey', author: 'Nora Vance', date: '2024-03-15' },
  { slug: 'cryogenic-battles', title: 'Cryogenic Battles', author: 'Kai Mori', date: '2024-04-28' },
  { slug: 'shadowy-figure', title: 'Shadowy Figure', author: 'Eva Lin', date: '2024-05-19' },
  { slug: 'delivery', title: 'Delivery', author: 'Owen Hart', date: '2024-02-07' },
];

export const posterUrl = (slug) => new URL(`./${slug}.webp`, import.meta.url).href;
