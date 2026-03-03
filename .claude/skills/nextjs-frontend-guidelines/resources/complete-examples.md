# Complete Examples - Next.js 15

## Full Server Component Example

```typescript
// app/artists/page.tsx
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { ArtistCard } from '@/components/artist/ArtistCard';
import type { Artist } from '@/types/artist';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artists - Little-Boy',
  description: 'Browse our collection of talented artists',
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function ArtistsPage() {
  // Fetch data directly on the server
  const artists: Artist[] = await api.artists.getAll();

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Artists</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </div>
    </div>
  );
}
```

## Full Client Component Example

```typescript
// components/artist/ArtistFilters.tsx
'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ArtistFiltersProps {
  onFilterChange: (filters: FilterState) => void;
}

interface FilterState {
  search: string;
  category: string;
  sortBy: string;
}

export function ArtistFilters({ onFilterChange }: ArtistFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    sortBy: 'name',
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, search: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  const handleCategoryChange = useCallback((value: string) => {
    const newFilters = { ...filters, category: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  const handleReset = useCallback(() => {
    const defaultFilters = { search: '', category: 'all', sortBy: 'name' };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  }, [onFilterChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <Input
        placeholder="Search artists..."
        value={filters.search}
        onChange={handleSearchChange}
        className="flex-1"
      />

      <Select value={filters.category} onValueChange={handleCategoryChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="painting">Painting</SelectItem>
          <SelectItem value="sculpture">Sculpture</SelectItem>
          <SelectItem value="digital">Digital Art</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" onClick={handleReset}>
        Reset Filters
      </Button>
    </div>
  );
}
```

## API Route Example

```typescript
// app/api/artists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    // Get search params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch artists (from database, external API, etc.)
    const artists = await fetchArtistsFromDatabase({ page, limit });

    return NextResponse.json({
      success: true,
      data: artists,
      page,
      limit,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const auth = await getAuth({ cookies: cookieStore });

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate and create artist
    const newArtist = await createArtist(body);

    return NextResponse.json(
      { success: true, data: newArtist },
      { status: 201 }
    );
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create artist' },
      { status: 500 }
    );
  }
}
```

## Form with react-hook-form + zod + shadcn/ui

```typescript
// components/artist/CreateArtistForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const artistSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  category: z.string().min(1, 'Please select a category'),
});

type ArtistFormValues = z.infer<typeof artistSchema>;

export function CreateArtistForm() {
  const router = useRouter();
  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(artistSchema),
    defaultValues: {
      name: '',
      email: '',
      bio: '',
      category: '',
    },
  });

  async function onSubmit(values: ArtistFormValues) {
    try {
      await api.artists.create(values);
      router.push('/artists');
    } catch (error) {
      console.error('Failed to create artist:', error);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Artist</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Artist name" {...field} />
                  </FormControl>
                  <FormDescription>
                    The artist's display name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="artist@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="painting">Painting</SelectItem>
                      <SelectItem value="sculpture">Sculpture</SelectItem>
                      <SelectItem value="digital">Digital Art</SelectItem>
                      <SelectItem value="photography">Photography</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biography</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about the artist..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Artist
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

## Page with Suspense Boundaries

```typescript
// app/artists/[id]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { ArtworkList } from '@/components/artwork/ArtworkList';

interface PageProps {
  params: { id: string };
}

// Loading skeleton for artworks
function ArtworksSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <Skeleton className="h-48 w-full rounded-t-lg" />
          <CardContent className="pt-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Async component for artworks
async function ArtistArtworks({ artistId }: { artistId: string }) {
  const artworks = await api.artworks.getByArtist(artistId);
  return <ArtworkList artworks={artworks} />;
}

export default async function ArtistDetailPage({ params }: PageProps) {
  const artist = await api.artists.getById(params.id);

  if (!artist) {
    notFound();
  }

  return (
    <div className="container py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-3xl">{artist.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{artist.bio}</p>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-6">Artworks</h2>

      <Suspense fallback={<ArtworksSkeleton />}>
        <ArtistArtworks artistId={params.id} />
      </Suspense>
    </div>
  );
}
```

## Complete Feature Example

```
src/
  components/
    artist/
      ArtistCard.tsx          # Card component for artist display
      ArtistProfile.tsx       # Server component for profile
      ArtistFilters.tsx       # Client component for filters
      CreateArtistForm.tsx    # Form with react-hook-form

  app/
    artists/
      page.tsx                # Server component - list page
      [id]/
        page.tsx              # Server component - detail page
      new/
        page.tsx              # Create artist page
      loading.tsx             # Loading UI
      error.tsx               # Error UI

  types/
    artist.ts                 # TypeScript types

  lib/
    api.ts                    # API client with artist methods
    utils.ts                  # cn() utility
```

## ArtistCard Component

```typescript
// components/artist/ArtistCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Artist } from '@/types/artist';
import { cn } from '@/lib/utils';

interface ArtistCardProps {
  artist: Artist;
  className?: string;
}

export function ArtistCard({ artist, className }: ArtistCardProps) {
  return (
    <Link href={`/artists/${artist.id}`}>
      <Card className={cn(
        "overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1",
        className
      )}>
        {artist.imageUrl && (
          <div className="aspect-square relative">
            <Image
              src={artist.imageUrl}
              alt={artist.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {artist.name}
            <Badge variant="secondary">{artist.category}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {artist.bio}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

## Loading UI

```typescript
// app/artists/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function Loading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-10 w-48 mb-8" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <Skeleton className="aspect-square w-full" />
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

## Error UI

```typescript
// app/artists/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="container py-8 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We encountered an error while loading this page. Please try again.
          </p>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

This structure provides:
- Server-side data fetching and rendering
- Client-side interactivity where needed
- Type safety throughout
- Proper error and loading states
- Clean separation of concerns
- shadcn/ui components for consistent design
- Tailwind CSS for custom styling
