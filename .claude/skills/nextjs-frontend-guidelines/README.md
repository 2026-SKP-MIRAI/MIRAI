# Next.js Frontend Guidelines Skill

## Overview

This skill provides comprehensive frontend development guidelines specifically adapted for the YGS (영영사) project's tech stack:

- **Next.js 15** with App Router
- **React 19**
- **TypeScript**
- **shadcn/ui** (Radix UI + Tailwind CSS)
- **Tailwind CSS 4**
- **Multi-method Authentication** (Firebase, Kakao OAuth, custom JWT)
- **Korean Localization**

## What This Skill Covers

1. **Component Patterns** - Server Components vs Client Components, when to use each
2. **Data Fetching** - Server Component async fetching, client-side patterns, API routes
3. **Styling** - shadcn/ui components + Tailwind CSS 4 combination
4. **Routing** - App Router file-based routing, dynamic routes, navigation
5. **Loading & Error States** - loading.tsx, error.tsx, Suspense boundaries
6. **Performance** - Server Components optimization, dynamic imports, image optimization
7. **TypeScript** - Strict typing, Next.js types, component props
8. **Authentication** - Multi-method auth with Firebase, Kakao, and custom JWT
9. **Admin Dashboard** - Member management, consultations, matching interface
10. **Common Patterns** - Forms with manual validation, modal patterns, URL-based state
11. **Korean Localization** - All UI text in Korean

## YGS-Specific Features

### Authentication System

```typescript
// Multi-method auth via AuthProvider
import { useAuth } from '@/providers/AuthProvider';

const { user, isLoading, loginWithKakao, loginWithGoogle, logout } = useAuth();
```

### API Clients

```typescript
// Main API client
import { api } from '@/lib/api';

// Admin-specific API
import { getMembers, updateMemberBasic, getDashboardStats } from '@/lib/adminApi';
```

### Constants Pattern

```typescript
// Enums with Korean labels
import { USER_STATUS_OPTIONS, getEnumLabel } from '@/constants/enums';

<Select>
  {USER_STATUS_OPTIONS.map(opt => (
    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
  ))}
</Select>
```

## Component Counts (Current)

| Category | Count | Location |
|----------|-------|----------|
| Admin Components | 27 | `src/components/admin/` |
| Auth Components | 4 | `src/components/auth/` |
| Layout Components | 2 | `src/components/layout/` |
| Match Components | 3 | `src/components/match/` |
| Landing Sections | 7 | `src/components/sections/` |
| SEO Components | 4 | `src/components/seo/` |
| UI Components | 11 | `src/components/ui/` |
| **Total** | **~60** | |

## shadcn/ui Quick Reference

### Installing Components

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Add components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add select
```

### The cn() Utility

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn("flex items-center", isActive && "bg-primary", className)}>
```

### Basic Component Usage

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
  </CardHeader>
  <CardContent>
    <Input placeholder="입력해주세요" />
    <Button>확인</Button>
  </CardContent>
</Card>
```

## Project Structure Match

The skill references YOUR actual project structure:

```
frontend/
  src/
    app/                  # Next.js App Router (referenced in skill)
      admin/              # Admin dashboard routes
      login/              # Authentication routes
      form/               # User profile form
      match/              # Matching interface
    components/
      admin/              # Admin-specific components
        modals/           # Edit modals
      auth/               # Auth components
      layout/             # Navbar, Footer
      match/              # Match cards
      sections/           # Landing page sections
      seo/                # SEO schema components
      ui/                 # shadcn/ui components
    lib/
      api.ts              # Main API client (used in examples)
      adminApi.ts         # Admin API methods
      utils.ts            # cn() utility
      serverAuth.ts       # Server-side auth (used in examples)
      firebaseAuth.ts     # Firebase integration
      kakao.ts            # Kakao SDK integration
      s3Upload.ts         # S3 upload utilities
    providers/
      AuthProvider.tsx    # Auth context provider
    types/                # TypeScript definitions
      admin.ts            # Admin types (362 lines)
      match.ts            # Match types
    constants/
      enums.ts            # Enum options with Korean labels
```

## Files Structure

```
.claude/skills/nextjs-frontend-guidelines/
  ├── skill.md                              # Main skill overview
  ├── README.md                             # This file
  └── resources/
      ├── component-patterns.md             # Server vs Client components
      ├── data-fetching.md                  # Async fetching, API routes
      ├── styling-guide.md                  # shadcn/ui + Tailwind CSS 4
      ├── file-organization.md              # Project structure
      ├── routing-guide.md                  # App Router patterns
      ├── loading-and-error-states.md       # Loading and error handling
      ├── performance.md                    # Optimization patterns
      ├── typescript-standards.md           # Type safety
      ├── common-patterns.md                # Auth, forms, uploads
      └── complete-examples.md              # Full working examples
```

## Skill Activation

The skill is configured to activate when:

### File Triggers
- Working in `frontend/src/**/*.tsx` or `frontend/src/**/*.ts`
- Files containing shadcn/ui imports, 'use client', Next.js patterns

### Prompt Triggers
- Keywords: "component", "React", "UI", "page", "Next.js", "server component", "shadcn", "styling", "admin", "auth"
- Intent patterns: Creating/editing components, styling questions, Next.js patterns

## Tech Stack Compatibility

- **Next.js 15**: All patterns use App Router
- **React 19**: Server/Client component patterns
- **shadcn/ui**: Radix UI + Tailwind CSS components
- **TypeScript**: Strict typing throughout
- **Tailwind CSS 4**: Combined with shadcn/ui
- **Your API clients**: Examples use `src/lib/api.ts` and `src/lib/adminApi.ts`
- **Your auth**: Examples use `src/providers/AuthProvider.tsx`
- **Your constants**: Examples use `src/constants/enums.ts`

## Dependencies

Core dependencies for shadcn/ui (already installed):

```bash
# Core dependencies
pnpm add clsx tailwind-merge class-variance-authority

# For forms (optional, YGS uses manual validation)
pnpm add react-hook-form @hookform/resolvers zod

# Icons (already installed)
pnpm add lucide-react
```

---

**Status**: Updated for YGS project
**Updated**: 2026-01-14
**Stack**: Next.js 15 + React 19 + shadcn/ui + Tailwind CSS 4 + Multi-auth + Korean
