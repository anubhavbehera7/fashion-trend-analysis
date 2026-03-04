# Frontend Service (Next.js 14)

Fashion trend analytics dashboard built with Next.js 14 App Router, TypeScript, TailwindCSS, and Recharts.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main dashboard with stats, charts, top trends |
| `/trends` | Full trends list with sort controls |
| `/upload` | Image upload interface |

## Features

- **Server Components** for initial data fetching (no client-side waterfall)
- **Client Components** for interactive charts (Recharts)
- **Responsive design** via TailwindCSS
- **Real-time charts** with Recharts BarChart/LineChart
- **Dark theme** throughout

## Development

```bash
npm install
npm run dev   # http://localhost:3000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | http://localhost:3000 | API Gateway URL |
| NEXT_PUBLIC_ML_URL | http://localhost:8000 | ML Analysis URL |

## Architecture

Uses Next.js 14 App Router with the hybrid rendering model:
- Server Components fetch data at request time (no client JS)
- Client Components handle interactivity (charts, forms)
- `next: { revalidate: 60 }` for ISR (Incremental Static Regeneration)
