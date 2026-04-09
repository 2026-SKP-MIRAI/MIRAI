# Data Fetching - Next.js 15

## Overview

Next.js 15 provides multiple ways to fetch data. Choose based on your use case:

1. **Server Components** (Recommended): Fetch data directly in async components
2. **Client-Side Fetching**: Use in Client Components for dynamic data
3. **API Routes**: For external API calls or complex server logic
4. **Server Actions**: For mutations and form submissions

---

## Server Component Data Fetching (Recommended)

### Basic Pattern

```typescript
// app/artists/page.tsx
import { api } from '@/lib/api';
import type { Artist } from '@/types/artist';

export default async function ArtistsPage() {
  // Fetch directly in the component
  const artists: Artist[] = await api.artists.getAll();

  return (
    <div>
      {artists.map(artist => (
        <div key={artist.id}>{artist.name}</div>
      ))}
    </div>
  );
}
```

### With Error Handling

```typescript
export default async function ArtistsPage() {
  try {
    const artists = await api.artists.getAll();
    return <ArtistList artists={artists} />;
  } catch (error) {
    console.error('Failed to fetch artists:', error);
    return <ErrorDisplay message="Failed to load artists" />;
  }
}
```

### Parallel Data Fetching

```typescript
export default async function DashboardPage() {
  // Fetch multiple data sources in parallel
  const [artists, artworks, exhibitions] = await Promise.all([
    api.artists.getAll(),
    api.artworks.getAll(),
    api.exhibitions.getAll(),
  ]);

  return (
    <Dashboard
      artists={artists}
      artworks={artworks}
      exhibitions={exhibitions}
    />
  );
}
```

### With Caching

```typescript
// Revalidate every 60 seconds
export const revalidate = 60;

export default async function ArtistsPage() {
  const artists = await api.artists.getAll();
  return <ArtistList artists={artists} />;
}
```

Or per-request:

```typescript
export default async function ArtistsPage() {
  const artists = await fetch('https://api.example.com/artists', {
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  }).then(res => res.json());

  return <ArtistList artists={artists} />;
}
```

### No Caching (Always Fresh)

```typescript
export default async function ArtistsPage() {
  const artists = await fetch('https://api.example.com/artists', {
    cache: 'no-store', // Always fetch fresh data
  }).then(res => res.json());

  return <ArtistList artists={artists} />;
}
```

---

## Client-Side Data Fetching

### Basic Pattern with useState

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Artist } from '@/types/artist';

export function ArtistList() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArtists() {
      try {
        const data = await api.artists.getAll();
        setArtists(data);
      } catch (err) {
        setError('Failed to fetch artists');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchArtists();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {artists.map(artist => (
        <div key={artist.id}>{artist.name}</div>
      ))}
    </div>
  );
}
```

### With Custom Hook

```typescript
// hooks/useArtists.ts
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Artist } from '@/types/artist';

export function useArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.artists.getAll()
      .then(setArtists)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { artists, loading, error };
}

// Component usage
'use client';

import { useArtists } from '@/hooks/useArtists';

export function ArtistList() {
  const { artists, loading, error } = useArtists();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* render artists */}</div>;
}
```

---

## API Routes

### Creating API Routes

```typescript
// app/api/artists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    // Optional: Check authentication
    const auth = await getAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch data (from database, external API, etc.)
    const artists = await fetchArtistsFromDatabase();

    return NextResponse.json({ artists });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newArtist = await createArtist(body);

    return NextResponse.json({ artist: newArtist }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to create artist' },
      { status: 500 }
    );
  }
}
```

### Dynamic API Routes

```typescript
// app/api/artists/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artistId = params.id;
  const artist = await fetchArtistById(artistId);

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  return NextResponse.json({ artist });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artistId = params.id;
  const body = await request.json();

  const updatedArtist = await updateArtist(artistId, body);

  return NextResponse.json({ artist: updatedArtist });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artistId = params.id;
  await deleteArtist(artistId);

  return NextResponse.json({ success: true }, { status: 204 });
}
```

---

## Server Actions

### Basic Server Action

```typescript
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export async function createArtist(formData: FormData) {
  const name = formData.get('name') as string;
  const bio = formData.get('bio') as string;

  try {
    const artist = await api.artists.create({ name, bio });

    // Revalidate the artists page to show new data
    revalidatePath('/artists');

    return { success: true, artist };
  } catch (error) {
    console.error('Failed to create artist:', error);
    return { success: false, error: 'Failed to create artist' };
  }
}
```

### Using Server Actions in Forms

```typescript
'use client';

import { useCallback, useState } from 'react';
import { Box, TextField, Button } from '@mui/material';
import { createArtist } from './actions';

export function ArtistForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createArtist(formData);

    if (result.success) {
      setMessage('Artist created successfully!');
      e.currentTarget.reset();
    } else {
      setMessage(result.error || 'Failed to create artist');
    }

    setLoading(false);
  }, []);

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <TextField name="name" label="Name" required fullWidth />
      <TextField name="bio" label="Bio" multiline rows={4} fullWidth />
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Artist'}
      </Button>
      {message && <div>{message}</div>}
    </Box>
  );
}
```

### Server Action with redirect

```typescript
'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export async function createArtist(formData: FormData) {
  const artist = await api.artists.create({
    name: formData.get('name') as string,
    bio: formData.get('bio') as string,
  });

  // Redirect to the new artist page
  redirect(`/artists/${artist.id}`);
}
```

---

## Data Fetching Patterns

Your project supports **two patterns** for data fetching:

### Pattern 1: Centralized API Client (Recommended for Complex Requests)

**Use `@/lib/api` for:**
- Type-safe API calls
- Complex requests with authentication
- Centralized error handling
- Consistent request formatting

```typescript
// Server Component
import { api } from '@/lib/api';

export default async function Page() {
  const artists = await api.artists.getAll();
  return <ArtistList artists={artists} />;
}

// Client Component
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.artists.getAll().then(setData);
  }, []);

  return <div>{/* render */}</div>;
}
```

### Pattern 2: Direct Fetch (Acceptable for Simple Public Endpoints)

**Use direct `fetch()` with `little_boy_server_endpoint` for:**
- Simple GET requests
- Public endpoints without authentication
- Quick prototyping

```typescript
import { little_boy_server_endpoint } from '@/const/endpoint';

export default async function Page() {
  const response = await fetch(`${little_boy_server_endpoint}/api/v1/artists/tags/`);
  const tags = await response.json();
  return <TagList tags={tags} />;
}
```

**When to use which:**
- ✅ API Client: Authenticated requests, complex operations, need type safety
- ✅ Direct Fetch: Public endpoints, simple GET requests, rapid prototyping

---

## Authentication with Server Auth

For authenticated requests on the server:

```typescript
// app/protected/page.tsx
import { cookies } from 'next/headers';
import { getAuth } from '@/lib/serverAuth';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const cookieStore = await cookies();
  const auth = await getAuth({ cookies: cookieStore });

  if (!auth.isAuthenticated) {
    redirect('/login');
  }

  // User is authenticated, fetch protected data
  const userData = await api.users.getProfile(auth.userId);

  return <UserProfile user={userData} />;
}
```

---

## Best Practices

1. **Prefer Server Components**: Fetch data in Server Components when possible
2. **Use API Client**: Always use your centralized API client (`@/lib/api`)
3. **Handle Errors**: Always wrap data fetching in try/catch
4. **Loading States**: Show loading UI while data is being fetched
5. **Parallel Fetching**: Use `Promise.all()` for independent data sources
6. **Caching**: Use `revalidate` for data that can be cached
7. **Type Safety**: Always type your data with TypeScript interfaces
8. **Server Actions**: Use for mutations and form submissions
9. **Authentication**: Use `getAuth()` from `src/lib/serverAuth` for protected routes
10. **Revalidation**: Use `revalidatePath()` after mutations to refresh data
