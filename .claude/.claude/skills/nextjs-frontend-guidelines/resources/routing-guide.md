# Routing Guide - Next.js 15 App Router

## File-Based Routing

Next.js 15 uses file-based routing in the `app/` directory.

### Basic Routes

```
app/
  page.tsx              → /
  about/
    page.tsx            → /about
  artists/
    page.tsx            → /artists
    [id]/
      page.tsx          → /artists/:id
```

### Dynamic Routes

```typescript
// app/artists/[id]/page.tsx
interface PageProps {
  params: { id: string };
}

export default async function ArtistPage({ params }: PageProps) {
  const artist = await api.artists.getById(params.id);
  return <ArtistProfile artist={artist} />;
}
```

### Catch-All Routes

```typescript
// app/docs/[...slug]/page.tsx
interface PageProps {
  params: { slug: string[] };
}

export default function DocsPage({ params }: PageProps) {
  // /docs/a/b/c → params.slug = ['a', 'b', 'c']
  return <div>Docs: {params.slug.join('/')}</div>;
}
```

## Navigation

### Client-Side (useRouter)

```typescript
'use client';

import { useRouter } from 'next/navigation';

export function Component() {
  const router = useRouter();

  return (
    <button onClick={() => router.push('/artists')}>
      Go to Artists
    </button>
  );
}
```

### Server-Side (redirect)

```typescript
import { redirect } from 'next/navigation';

export default async function Page() {
  const auth = await getAuth();

  if (!auth.isAuthenticated) {
    redirect('/login');
  }

  return <div>Protected Content</div>;
}
```

### Link Component

```typescript
import Link from 'next/link';

export function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/artists">Artists</Link>
      <Link href="/about">About</Link>
    </nav>
  );
}
```

## Layouts

```typescript
// app/layout.tsx (Root Layout)
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx (Nested Layout)
export default function DashboardLayout({ children }) {
  return (
    <div>
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

## Route Groups

```
app/
  (marketing)/
    page.tsx            → /
    about/
      page.tsx          → /about
  (app)/
    dashboard/
      page.tsx          → /dashboard
```

Route groups organize files without affecting URL structure.
