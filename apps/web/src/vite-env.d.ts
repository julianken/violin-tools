/// <reference types="vite/client" />

// Brings Vite's `ImportMeta`/`ImportMetaEnv` augmentation into scope so
// `import.meta.env.DEV` (the synchronous dev/prod flag default — #176, flags.ts)
// type-checks. The app reads no other `import.meta.env` keys today; this single
// reference is the standard Vite ambient-types entry point.
