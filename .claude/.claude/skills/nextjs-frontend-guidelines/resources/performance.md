# Performance Optimization - Next.js 15

## Server Components (Zero JS)

Default to Server Components for better performance:

```typescript
// No JavaScript sent to client
export default async function Page() {
  const data = await fetchData();
  return <StaticContent data={data} />;
}
```

## Dynamic Imports

```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>,
  ssr: false, // Disable SSR if needed
});

export function Page() {
  return <HeavyComponent />;
}
```

## Image Optimization

```typescript
import Image from 'next/image';

export function Component() {
  return (
    <Image
      src="/path/to/image.jpg"
      alt="Description"
      width={500}
      height={300}
      priority // For above-the-fold images
      quality={90}
    />
  );
}
```

## React Optimization Hooks

### useMemo

```typescript
'use client';

import { useMemo } from 'react';

export function Component({ items }) {
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  return <List items={sortedItems} />;
}
```

### useCallback

```typescript
'use client';

import { useCallback } from 'react';

export function Component() {
  const handleClick = useCallback(() => {
    // Handler logic
  }, []);

  return <ChildComponent onClick={handleClick} />;
}
```

### React.memo

```typescript
'use client';

import { memo } from 'react';

export const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  // Expensive rendering
  return <div>{data}</div>;
});
```

## Best Practices

1. **Server Components First**: Less JavaScript to client
2. **Dynamic Imports**: For heavy components
3. **Image Optimization**: Always use next/image
4. **Memoization**: Use useMemo/useCallback appropriately
5. **Code Splitting**: Automatic with Next.js routes
6. **Caching**: Use revalidate for data fetching
7. **Minimal Client JS**: Only use 'use client' when necessary
