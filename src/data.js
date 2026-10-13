export const categories = [
  { name: 'All projects', icon: 'grid' },
  { name: 'Web', icon: 'globe' },
  { name: 'AI & ML', icon: 'sparkles' },
  { name: 'Roblox', icon: 'box' },
  { name: 'Open Source', icon: 'code' },
  { name: 'Mobile', icon: 'smartphone' },
  { name: 'Games', icon: 'gamepad' },
  { name: 'Developer Tools', icon: 'terminal' },
];

export const creators = [
  { id: 'nova', name: 'Alex Morgan', handle: 'novacodes', role: 'Full-stack engineer', avatar: 'AM', color: '#a686fd', followers: 1284 },
  { id: 'pixel', name: 'Maya Chen', handle: 'mayamakes', role: 'Creative developer', avatar: 'MC', color: '#f3a77a', followers: 2401 },
  { id: 'wren', name: 'Jordan Lee', handle: 'wrenlabs', role: 'AI tinkerer', avatar: 'JL', color: '#73c9d7', followers: 918 },
  { id: 'silly', name: 'SillyDev', handle: 'sillydev', role: 'Roblox & Luau developer', avatar: 'SD', color: '#abefba', followers: 785 },
  { id: 'lena', name: 'Lena Ortiz', handle: 'lenabuilds', role: 'Indie game maker', avatar: 'LO', color: '#f9cf80', followers: 1740 },
  { id: 'kai', name: 'Kai Rivers', handle: 'kaicreates', role: 'Product designer', avatar: 'KR', color: '#94adf0', followers: 1072 },
];

export const seedProjects = [
  { id: 'p1', title: 'Orbit UI', tagline: 'The component library that just gets out of your way.', description: 'A beautifully minimal collection of accessible UI components for modern web apps. Includes themes, motion, and copy-paste examples. Built for makers who care about the details.', category: 'Web', tags: ['React', 'TypeScript', 'UI Kit'], creatorId: 'nova', likes: 842, views: 12480, comments: 38, daysAgo: 1, theme: 'orbit', featured: true },
  { id: 'p2', title: 'Neural Notes', tagline: 'A second brain that actually remembers.', description: 'An experimental AI-assisted personal knowledge base with semantic search, backlink mapping, and offline-first note organization.', category: 'AI & ML', tags: ['AI', 'Python', 'Open Source'], creatorId: 'wren', likes: 614, views: 8940, comments: 24, daysAgo: 2, theme: 'neural', featured: true },
  { id: 'p3', title: 'Pixel Paradise', tagline: 'A tiny world, a thousand possibilities.', description: 'A cozy multiplayer pixel-art playground where people can design miniature worlds together. Built with a love for retro games and creativity.', category: 'Games', tags: ['Canvas', 'Multiplayer', 'Indie'], creatorId: 'pixel', likes: 523, views: 7720, comments: 41, daysAgo: 3, theme: 'pixel', featured: false },
  { id: 'p4', title: 'Luau Playground', tagline: 'Write, experiment, and learn Luau from your browser.', description: 'A developer-focused playground for Luau editing and learning, with intelligent completions, quick examples, and a clean code editing experience.', category: 'Roblox', tags: ['Luau', 'Roblox', 'Editor'], creatorId: 'silly', likes: 492, views: 6500, comments: 29, daysAgo: 1, theme: 'luau', featured: false },
  { id: 'p5', title: 'Motion Lab', tagline: 'A playground for impossible web animations.', description: 'A collection of smooth interactions, animation studies, and micro-interactions. Discover new ways to make interfaces feel alive.', category: 'Web', tags: ['Animation', 'CSS', 'Design'], creatorId: 'kai', likes: 455, views: 6130, comments: 17, daysAgo: 4, theme: 'motion', featured: false },
  { id: 'p6', title: 'Terminally', tagline: 'Make your terminal feel like home.', description: 'An opinionated terminal toolkit with portable presets, thoughtful shortcuts, and a customizable command palette.', category: 'Developer Tools', tags: ['CLI', 'Productivity', 'Rust'], creatorId: 'nova', likes: 388, views: 5200, comments: 19, daysAgo: 5, theme: 'terminal', featured: false },
  { id: 'p7', title: 'Pocket Atlas', tagline: 'The world in your pocket, without the noise.', description: 'An offline-first travel journal and map bookmark app with privacy-conscious location storage.', category: 'Mobile', tags: ['Flutter', 'Maps', 'Offline'], creatorId: 'lena', likes: 344, views: 4900, comments: 12, daysAgo: 2, theme: 'atlas', featured: false },
  { id: 'p8', title: 'Open Canvas', tagline: 'Create together, from anywhere.', description: 'A collaborative real-time canvas for quick diagrams, mood boards, and brainstorming sessions. Keyboard friendly and fully open source.', category: 'Open Source', tags: ['Collaborative', 'WebSocket', 'Canvas'], creatorId: 'pixel', likes: 337, views: 4120, comments: 23, daysAgo: 6, theme: 'canvas', featured: false },
  { id: 'p9', title: 'Data Garden', tagline: 'Watch your data come to life.', description: 'Turn CSV files and JSON into meaningful interactive visualizations. No complicated configuration required.', category: 'Developer Tools', tags: ['Visualization', 'Data', 'JavaScript'], creatorId: 'wren', likes: 295, views: 3840, comments: 9, daysAgo: 3, theme: 'garden', featured: false },
  { id: 'p10', title: 'Skyward', tagline: 'An atmospheric adventure above the clouds.', description: 'A small exploration game about flying through forgotten floating islands and solving environmental puzzles.', category: 'Games', tags: ['Godot', 'Indie', '3D'], creatorId: 'lena', likes: 281, views: 3790, comments: 16, daysAgo: 7, theme: 'skyward', featured: false },
  { id: 'p11', title: 'Nexus Sync', tagline: 'Better collaboration for Roblox creators.', description: 'An experiment in collaborative Roblox Studio workflows, history tracking, and cross-device development tools.', category: 'Roblox', tags: ['Studio', 'Collaboration', 'Luau'], creatorId: 'silly', likes: 264, views: 3160, comments: 21, daysAgo: 8, theme: 'nexus', featured: false },
  { id: 'p12', title: 'Color Theory', tagline: 'Find your next favorite palette in seconds.', description: 'An accessible palette generator with contrast audits and exportable design tokens.', category: 'Open Source', tags: ['Design', 'Accessibility', 'CSS'], creatorId: 'kai', likes: 218, views: 2980, comments: 11, daysAgo: 5, theme: 'color', featured: false },
];
