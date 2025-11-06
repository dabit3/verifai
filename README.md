## VerifAI 

Run a deterministic EigenAI inference alongside sampled OpenAI runs to highlight how EigenAI creates a seed-controlled response you can reproduce and verify any time.

### Setup

1. Copy `.env.example` to `.env.local` and supply provider keys:
   ```
   OPENAI_API_KEY=sk-...
   EIGENAI_API_KEY=sk-...
   NEXT_PUBLIC_EIGENAI_DEFAULT_SEED=42
   ```
   Optional: adjust `OPENAI_MAX_TOKENS` / `EIGENAI_MAX_TOKENS`.

2. Install dependencies and start the dev server:
   ```bash
   pnpm install
   pnpm dev
   ```
   Visit `http://localhost:3000`.

### Features

- Side-by-side OpenAI sampling vs EigenAI seeded response
- Third EigenAI column generated from a UUID-derived seed to show variation
- Token usage details per run
- Light/dark themes with persistent toggle
- Reset action to clear state after a comparison

### Commands

- `pnpm dev` – run locally
- `pnpm lint` – lint codebase
- `pnpm build` / `pnpm start` – production build & serve

### Tech Stack

Next.js App Router, React 19, Tailwind CSS, shadcn-inspired UI components, lucide-react icons.
