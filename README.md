# Tally

End-to-end encrypted personal finance / budgeting app.

## Stack

- **Frontend**: Vite + React + TypeScript, Tailwind + shadcn/ui, TanStack Router
- **Backend**: Go (`net/http`) + PostgreSQL, Goose for migrations
- **Auth**: Supabase (auth-only — app data lives in our own Postgres, encrypted client-side)
- **Hosting**: Fly.io · **Local dev**: Tilt

## Run locally

```bash
tilt up
```

Ports: frontend `:3001`, backend `:8081`, Postgres `:5433`.
