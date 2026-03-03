# Styling Guide - shadcn/ui + Tailwind CSS 4

## Overview

Your project uses a modern styling approach:
- **shadcn/ui**: Pre-built, accessible components with Tailwind styling
- **Tailwind CSS 4**: Utility-first CSS framework
- **cn() utility**: Class merging with clsx + tailwind-merge

---

## shadcn/ui Styling

### What is shadcn/ui?

shadcn/ui is NOT a component library in the traditional sense. It's a collection of reusable components that you copy and paste into your project. This means:

- Components live in YOUR codebase (`src/components/ui/`)
- You own the code and can customize it freely
- No external npm package dependency for components
- Built on Radix UI primitives for accessibility
- Styled with Tailwind CSS

### Installing shadcn/ui

```bash
# Initialize shadcn/ui in your project
npx shadcn@latest init

# Add individual components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add select
npx shadcn@latest add skeleton
```

### Component Location

All shadcn/ui components go in `src/components/ui/`:

```
src/components/ui/
  button.tsx
  card.tsx
  input.tsx
  dialog.tsx
  form.tsx
  select.tsx
  skeleton.tsx
  alert.tsx
  badge.tsx
  ...
```

---

## The cn() Utility (CRITICAL)

The `cn()` utility is essential for shadcn/ui. It merges class names intelligently.

### Setup

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Usage

```typescript
import { cn } from '@/lib/utils';

// Basic usage
<div className={cn("flex items-center", className)}>

// Conditional classes
<div className={cn(
  "flex items-center gap-2 p-4",
  isActive && "bg-primary text-primary-foreground",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>

// Combining variants
<Button className={cn(
  "w-full",
  size === "lg" && "h-12 text-lg"
)}>
```

### Why cn() is Important

```typescript
// WITHOUT cn() - classes may conflict
<div className={`p-4 ${className}`}>  // If className has p-2, both apply

// WITH cn() - later classes override earlier ones
<div className={cn("p-4", className)}>  // p-2 from className wins
```

---

## shadcn/ui Component Variants

### Button Variants

```typescript
import { Button } from '@/components/ui/button';

// Default (primary)
<Button>Click me</Button>

// Variants
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// Custom styling
<Button className="w-full bg-blue-600 hover:bg-blue-700">
  Custom Button
</Button>
```

### Card Component

```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

<Card className="w-[350px]">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Input Component

```typescript
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="grid w-full max-w-sm items-center gap-1.5">
  <Label htmlFor="email">Email</Label>
  <Input type="email" id="email" placeholder="Email" />
</div>
```

### Dialog Component

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Description of what this dialog does.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      {/* Dialog content */}
    </div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Select Component

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

---

## Tailwind CSS 4

### Utility Classes

```typescript
export function Component() {
  return (
    <div className="flex items-center gap-4 p-4 bg-background rounded-lg border">
      <img
        src="..."
        alt="..."
        className="w-16 h-16 rounded-full object-cover"
      />
      <div className="flex-1">
        <h3 className="text-lg font-bold text-foreground">Title</h3>
        <p className="text-sm text-muted-foreground">Description</p>
      </div>
    </div>
  );
}
```

### Responsive Classes

```typescript
<div className="
  flex flex-col       /* Mobile: column layout */
  md:flex-row         /* Tablet+: row layout */
  gap-4 md:gap-6      /* Different gaps */
  p-4 md:p-8          /* Different padding */
">
  Content
</div>
```

### shadcn/ui Color Tokens

shadcn/ui uses CSS custom properties for theming:

```typescript
// Primary colors
<div className="bg-primary text-primary-foreground">Primary</div>

// Secondary colors
<div className="bg-secondary text-secondary-foreground">Secondary</div>

// Muted/subtle
<div className="bg-muted text-muted-foreground">Muted</div>

// Accent
<div className="bg-accent text-accent-foreground">Accent</div>

// Destructive (errors, delete actions)
<div className="bg-destructive text-destructive-foreground">Destructive</div>

// Background and foreground
<div className="bg-background text-foreground">Default</div>

// Border and input
<div className="border border-border">Bordered</div>
<Input className="border-input" />

// Card
<div className="bg-card text-card-foreground">Card</div>
```

---

## When to Use What

### Use shadcn/ui Components when:
- Building UI elements (buttons, cards, dialogs, forms)
- Need accessible, well-designed components
- Want consistent design across the app
- Need interactive elements (dropdowns, modals)

### Use Tailwind Classes when:
- Layout (flex, grid, positioning)
- Spacing (padding, margin, gap)
- Typography (font size, weight, color)
- Customizing shadcn/ui components
- One-off styling needs

### Combine Both:
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function FeatureCard() {
  return (
    {/* Tailwind for layout */}
    <div className="flex flex-col gap-4 p-6">
      {/* shadcn/ui for components */}
      <Card>
        <CardContent className="pt-6">
          {/* Custom Tailwind styling */}
          <h2 className="text-2xl font-bold mb-4">Feature</h2>
          <p className="text-muted-foreground mb-4">Description</p>
          <Button className="w-full">Learn More</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Common Patterns

### Responsive Card Grid

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CardGrid({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle>{item.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Form Layout

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Form() {
  return (
    <form className="flex flex-col gap-4 max-w-md mx-auto">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Enter your name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="Enter your email" />
      </div>
      <Button type="submit" className="mt-4">
        Submit
      </Button>
    </form>
  );
}
```

### Responsive Sidebar Layout

```typescript
export function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/40">
        {/* Sidebar content */}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
```

### Loading State with Skeleton

```typescript
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-[200px]" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[80%]" />
      </CardContent>
    </Card>
  );
}
```

---

## Dark Mode Support

shadcn/ui has built-in dark mode support through CSS custom properties:

```typescript
// In your globals.css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* ... other light mode variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... other dark mode variables */
  }
}
```

Components automatically adapt to the current theme.

---

## Best Practices

1. **Always use cn()**: For conditional or merged class names
2. **Use semantic tokens**: `bg-primary` instead of `bg-blue-500`
3. **Component-first**: Prefer shadcn/ui components over raw HTML
4. **Customize via className**: Add Tailwind classes to shadcn/ui components
5. **Responsive design**: Use Tailwind responsive prefixes (sm:, md:, lg:)
6. **Keep components in ui/**: All shadcn/ui components go in `src/components/ui/`
7. **Don't modify ui/ directly**: Create wrapper components if you need different defaults
8. **Use proper spacing tokens**: gap-4, p-4, mb-4 etc. for consistency
