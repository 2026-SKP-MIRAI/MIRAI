# Loading & Error States - Next.js 15

## Loading States

### Route-Level Loading

```typescript
// app/artists/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );
}
```

### Suspense Boundaries

```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Artists</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <ArtistList />
      </Suspense>
    </div>
  );
}
```

### Client-Side Loading

```typescript
'use client';

import { useState } from 'react';
import { CircularProgress, Button } from '@mui/material';

export function Component() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await api.doSomething();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? <CircularProgress size={20} /> : 'Click Me'}
    </Button>
  );
}
```

## Error Handling

### Route-Level Error Boundary

```typescript
// app/artists/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold text-red-600 mb-4">
        Something went wrong!
      </h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try Again
      </button>
    </div>
  );
}
```

### Client-Side Error Handling

```typescript
'use client';

import { useState } from 'react';

export function Component() {
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    try {
      await api.doSomething();
    } catch (err) {
      setError('Something went wrong');
      console.error(err);
    }
  };

  return (
    <div>
      {error && <div className="text-red-600">{error}</div>}
      <button onClick={handleAction}>Action</button>
    </div>
  );
}
```

### Not Found

```typescript
// app/artists/[id]/not-found.tsx
export default function NotFound() {
  return (
    <div className="text-center p-8">
      <h2 className="text-2xl font-bold">Artist Not Found</h2>
      <p className="text-gray-600 mt-2">
        The artist you're looking for doesn't exist.
      </p>
    </div>
  );
}

// In page component
import { notFound } from 'next/navigation';

export default async function ArtistPage({ params }) {
  const artist = await api.artists.getById(params.id);

  if (!artist) {
    notFound();
  }

  return <ArtistProfile artist={artist} />;
}
```
