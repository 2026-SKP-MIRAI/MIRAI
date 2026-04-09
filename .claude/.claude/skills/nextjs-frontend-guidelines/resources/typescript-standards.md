# TypeScript Standards - Next.js 15

## Strict Mode

Your project should have strict TypeScript enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Component Props

```typescript
interface ComponentProps {
  /** The user's name */
  name: string;
  /** Optional callback function */
  onUpdate?: (value: string) => void;
  /** Loading state */
  loading?: boolean;
}

export function Component({ name, onUpdate, loading = false }: ComponentProps) {
  return <div>{name}</div>;
}
```

## Type Imports

```typescript
// ✅ Use type imports
import type { User } from '@/types/user';
import type { SxProps, Theme } from '@mui/material';

// ❌ Avoid mixing
import { User } from '@/types/user';
```

## Next.js Types

```typescript
import type { Metadata } from 'next';
import type { NextRequest } from 'next/server';

export const metadata: Metadata = {
  title: 'Page Title',
};

export async function GET(request: NextRequest) {
  // ...
}
```

## Page Props

```typescript
interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function Page({ params, searchParams }: PageProps) {
  return <div>{params.id}</div>;
}
```

## API Response Types

```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Usage
const response: ApiResponse<User> = await api.users.get(id);
```

## Event Handlers

```typescript
'use client';

import type { FormEvent, ChangeEvent } from 'react';

export function Form() {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Best Practices

1. **Explicit Types**: Always type function parameters and returns
2. **Type Imports**: Use `import type` for types
3. **Interfaces**: Use interfaces for object shapes
4. **No any**: Use `unknown` if type is truly unknown
5. **JSDoc**: Document complex types and props
6. **Utility Types**: Use Partial, Pick, Omit when appropriate
