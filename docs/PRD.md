# Noorul Academy PRD

## Purpose

Rebuild the current single-file Noorul Academy experience into a structured Next.js application with clearer sections, a maintainable layout, Supabase-ready configuration, and a visible work tracker.

## Status at a glance

| Area | Status | Notes |
| --- | --- | --- |
| Next.js scaffold | In progress | App Router structure is being added |
| UI split into sections | Not started | Home, courses, enrolment, and admin pages will be separated |
| Supabase env setup | In progress | Public values are documented and the secret key is reserved in env only |
| SQL migrations | In progress | Numbered files are being added under `supabase/migrations` |
| Validation | Not started | Build and lint checks will run after the scaffold lands |

## Goals

1. Turn the current HTML into a Next.js project that is easier to maintain.
1. Keep the Noorul Academy branding, course content, enrolment flow, and admin tools.
1. Add a clear home for Supabase configuration and future backend work.
1. Make progress easy to scan without opening the whole codebase.

## Scope

### In scope

- Next.js App Router project structure
- Reusable UI sections and shared styles
- Supabase environment variables and server/client config placeholders
- Numbered SQL migration files
- README and PRD/status tracking

### Out of scope for this pass

- Authentication flow implementation
- Production deployment
- Migrating live data from an existing Supabase instance

## Functional areas

### Public site

- Hero section with academy branding
- About section
- Faculty/course listings
- Enrolment form
- Footer and quick navigation

### Admin tools

- Dashboard summary cards
- Student registry
- Progress tracking with Juz status
- Poster/certificate creator preview

## Supabase plan

- `NEXT_PUBLIC_SUPABASE_PROJECT_ID` identifies the project.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` power browser-safe access.
- `SUPABASE_SECRET_KEY` stays blank in the repo and must be filled in locally.
- `SUPABASE_JWT_KID` and `SUPABASE_JWKS_URL` document JWT verification inputs.

## Deliverables

- A structured Next.js workspace
- A concise PRD with a visible work status table
- Environment placeholders for Supabase and JWT values
- Numbered migration files under `supabase/migrations/`
