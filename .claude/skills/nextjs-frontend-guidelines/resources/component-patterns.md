# Component Patterns - Next.js 15

## Server Components vs Client Components

### Server Components (Default)

**When to use:**
- Static content that doesn't change
- Data fetching from APIs or databases
- No interactivity needed
- SEO-critical content

**Characteristics:**
- No `'use client'` directive
- Can be async functions
- Fetch data directly
- Zero JavaScript sent to client
- Cannot use hooks (useState, useEffect, etc.)
- Cannot use browser APIs
- Cannot use event handlers

```typescript
// Server Component (no 'use client')
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Artist } from '@/types/artist';

interface ArtistProfileProps {
  artistId: string;
}

export default async function ArtistProfile({ artistId }: ArtistProfileProps) {
  // Fetch data directly - this runs on the server
  const artist: Artist = await api.artists.getById(artistId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{artist.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{artist.bio}</p>
      </CardContent>
    </Card>
  );
}
```

### Client Components

**When to use:**
- State management (useState)
- Effects (useEffect)
- Event handlers (onClick, onChange, etc.)
- Browser APIs (localStorage, window, etc.)
- Custom hooks
- Context providers

**Characteristics:**
- Must have `'use client'` at the top of the file
- Can use all React hooks
- Can use browser APIs
- Sends JavaScript to the client
- Interactive elements

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

interface CommentFormProps {
  artworkId: string;
  onSubmit?: () => void;
}

export function CommentForm({ artworkId, onSubmit }: CommentFormProps) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await api.comments.create({ artworkId, text: comment });
      setComment('');
      onSubmit?.();
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setLoading(false);
    }
  }, [artworkId, comment, onSubmit]);

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment..."
        className="min-h-[100px]"
      />
      <Button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </Button>
    </div>
  );
}
```

## Component Structure Pattern

### Recommended Order

```typescript
'use client'; // Only if needed

// 1. Imports
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/types/user';

// 2. Types/Interfaces
interface MyComponentProps {
  userId: string;
  className?: string;
  onUpdate?: (user: User) => void;
}

// 3. Component Function
export function MyComponent({ userId, className, onUpdate }: MyComponentProps) {
  // 4. State
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // 5. Hooks (useCallback, useMemo, useEffect, custom hooks)
  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const user = await api.users.getById(userId);
      setData(user);
      onUpdate?.(user);
    } finally {
      setLoading(false);
    }
  }, [userId, onUpdate]);

  // 6. Render
  return (
    <Card className={cn("p-4", className)}>
      <CardContent>
        <Button onClick={fetchUser} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch User'}
        </Button>
        {data && <p className="mt-4 text-muted-foreground">{data.name}</p>}
      </CardContent>
    </Card>
  );
}
```

## Mixing Server and Client Components

### Pattern: Server Component with Client Child

```typescript
// app/artists/page.tsx (Server Component)
import { ArtistList } from '@/components/artist/ArtistList'; // Server
import { ArtistFilters } from '@/components/artist/ArtistFilters'; // Client
import { api } from '@/lib/api';

export default async function ArtistsPage() {
  // Fetch data on server
  const artists = await api.artists.getAll();

  return (
    <div className="container py-8">
      {/* Client Component for interactive filters */}
      <ArtistFilters />

      {/* Server Component for static list */}
      <ArtistList artists={artists} />
    </div>
  );
}
```

### Pattern: Passing Data from Server to Client

```typescript
// Server Component
import { ClientComponent } from './ClientComponent';

export default async function ServerPage() {
  const data = await fetch('...');

  // Pass data as props to Client Component
  return <ClientComponent initialData={data} />;
}

// ClientComponent.tsx
'use client';

interface ClientComponentProps {
  initialData: DataType;
}

export function ClientComponent({ initialData }: ClientComponentProps) {
  const [data, setData] = useState(initialData);
  // ... client-side logic
}
```

## Performance Patterns

### Dynamic Imports

For heavy Client Components, use dynamic imports:

```typescript
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load with loading state
const HeavyChart = dynamic(
  () => import('@/components/charts/HeavyChart'),
  {
    loading: () => <Skeleton className="h-[400px] w-full" />,
    ssr: false, // Disable SSR if component uses browser APIs
  }
);

export function Dashboard() {
  return (
    <div className="space-y-4">
      <HeavyChart data={...} />
    </div>
  );
}
```

### React.memo for Expensive Components

```typescript
'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ExpensiveListProps {
  items: Item[];
}

export const ExpensiveList = memo(function ExpensiveList({ items }: ExpensiveListProps) {
  // Expensive rendering logic
  return (
    <div className="grid gap-4">
      {items.map(item => (
        <Card key={item.id}>
          <CardContent className="pt-6">
            {item.name}
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
```

## Common Patterns

### useCallback for Event Handlers

Always use `useCallback` for event handlers passed to child components:

```typescript
'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

export function Parent() {
  const [count, setCount] = useState(0);

  // Wrapped in useCallback
  const handleClick = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  return <Child onClick={handleClick} />;
}
```

### Form Handling with shadcn/ui

```typescript
'use client';

import { useState, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Handle submission
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

## TypeScript Patterns

### Component Props with JSDoc

```typescript
interface ButtonProps {
  /** The text to display on the button */
  label: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function CustomButton({ label, onClick, loading = false, className }: ButtonProps) {
  return (
    <Button onClick={onClick} disabled={loading} className={className}>
      {loading ? 'Loading...' : label}
    </Button>
  );
}
```

### Extracting Types

```typescript
// types/artist.ts
export interface Artist {
  id: string;
  name: string;
  bio: string;
  artworks: Artwork[];
}

// Component
import type { Artist } from '@/types/artist';

interface ArtistCardProps {
  artist: Artist;
  className?: string;
}
```

### Using cn() for className Props

```typescript
import { cn } from '@/lib/utils';

interface ComponentProps {
  className?: string;
  children: React.ReactNode;
}

export function Component({ className, children }: ComponentProps) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border",
      className
    )}>
      {children}
    </div>
  );
}
```

## Best Practices

1. **Default to Server Components**: Only use Client Components when you need interactivity
2. **Keep Client Components Small**: Extract non-interactive parts to Server Components
3. **Pass Data Down**: Fetch in Server Components, pass to Client Components via props
4. **Use Callbacks**: Wrap event handlers in `useCallback` to prevent re-renders
5. **Type Everything**: Explicit types for props, state, and return values
6. **Named Exports**: Use named exports for components (easier to search and refactor)
7. **Async Server Components**: Take advantage of async/await in Server Components
8. **Error Boundaries**: Wrap Client Components with error.tsx for graceful failures
9. **Always accept className**: Components should accept `className` prop for customization
10. **Use cn() for class merging**: Always use `cn()` when combining classes
