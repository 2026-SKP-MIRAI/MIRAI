# File Organization - YGS Next.js 15

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Home/Landing page (/)
│   ├── layout.tsx              # Root layout with metadata
│   ├── loading.tsx             # Root loading UI
│   ├── error.tsx               # Root error UI
│   ├── robots.ts               # SEO robots
│   ├── sitemap.ts              # SEO sitemap
│   │
│   ├── admin/                  # Admin dashboard (protected)
│   │   ├── page.tsx            # Dashboard (stats, charts)
│   │   ├── layout.tsx          # Admin layout with sidebar + auth
│   │   ├── loading.tsx         # Admin loading UI
│   │   ├── error.tsx           # Admin error UI
│   │   ├── members/
│   │   │   ├── page.tsx        # Member list with pagination
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Member detail (6 tabs)
│   │   ├── consultations/
│   │   │   └── page.tsx        # Consultation management
│   │   ├── matching/
│   │   │   └── page.tsx        # Matching interface
│   │   └── couples/
│   │       └── page.tsx        # Couple management
│   │
│   ├── login/                  # Authentication
│   │   ├── page.tsx            # Login page
│   │   └── kakao-callback/
│   │       └── page.tsx        # Kakao OAuth callback
│   │
│   ├── form/
│   │   └── page.tsx            # User profile form
│   │
│   ├── match/
│   │   └── page.tsx            # Matching interface
│   │
│   ├── buy/
│   │   └── page.tsx            # Membership purchase
│   │
│   └── api/                    # API Routes
│       └── auth/
│           └── session/
│               └── route.ts    # Token sync endpoint (POST/DELETE)
│
├── components/                 # React components (~60 total)
│   ├── admin/                  # Admin components (27)
│   │   ├── DashboardStats.tsx  # Stats cards
│   │   ├── RegistrationTrendChart.tsx  # Line chart
│   │   ├── GenderRatioChart.tsx        # Pie chart
│   │   ├── ReferralSourcesChart.tsx    # Bar chart
│   │   ├── AdminSidebar.tsx    # Navigation sidebar
│   │   ├── AdminHeader.tsx     # Header with user info
│   │   ├── MemberFilters.tsx   # Search + filter UI
│   │   ├── MemberTable.tsx     # Paginated table
│   │   ├── MemberBasicInfo.tsx # Basic info display
│   │   ├── MemberProfileTab.tsx
│   │   ├── MemberLifestyleTab.tsx
│   │   ├── MemberPreferenceTab.tsx
│   │   ├── MemberSubscriptionTab.tsx
│   │   ├── MemberDocumentsTab.tsx
│   │   ├── MemberSelector.tsx  # Member search/select
│   │   ├── ConsultationList.tsx
│   │   ├── ConsultationFormModal.tsx
│   │   ├── ConsultationCalendar.tsx
│   │   ├── CandidateList.tsx   # Matching candidates
│   │   ├── MatchComparisonCard.tsx
│   │   ├── CoupleCard.tsx
│   │   ├── MatchingFilters.tsx
│   │   ├── ScoreBreakdown.tsx
│   │   └── modals/             # Edit modals
│   │       ├── BasicInfoEditModal.tsx
│   │       ├── ProfileEditModal.tsx
│   │       ├── LifestyleEditModal.tsx
│   │       ├── PreferenceEditModal.tsx
│   │       ├── SubscriptionEditModal.tsx
│   │       └── PhotoEditModal.tsx
│   │
│   ├── auth/                   # Auth components (4)
│   │   ├── LoginForm.tsx       # Social login buttons + error handling
│   │   ├── SignupForm.tsx      # Phone signup with validation
│   │   ├── SocialLoginButton.tsx # Generic social button
│   │   └── KakaoLoginButton.tsx  # Kakao-specific button
│   │
│   ├── layout/                 # Layout components (2)
│   │   ├── Navbar.tsx          # Responsive nav with auth
│   │   └── Footer.tsx          # Simple footer
│   │
│   ├── match/                  # Match components (3)
│   │   ├── MatchCard.tsx       # Card with image carousel
│   │   ├── MatchCardDetailModal.tsx  # Detail modal
│   │   └── MatchCardList.tsx   # Card grid
│   │
│   ├── sections/               # Landing page sections (7)
│   │   ├── Hero.tsx            # Hero with background image
│   │   ├── Problem.tsx         # Problem statement
│   │   ├── SocialProof.tsx     # Testimonials
│   │   ├── Process.tsx         # How it works
│   │   ├── Founder.tsx         # Founder info
│   │   ├── Pricing.tsx         # Pricing plans
│   │   └── ContactForm.tsx     # Contact form
│   │
│   ├── seo/                    # SEO schema components (4)
│   │   ├── OrganizationSchema.tsx
│   │   ├── ServiceSchema.tsx
│   │   ├── FAQSchema.tsx
│   │   └── WebSiteSchema.tsx
│   │
│   └── ui/                     # shadcn/ui components (11)
│       ├── button.tsx          # CVA variants
│       ├── input.tsx           # Simple wrapper
│       ├── card.tsx            # Card with sub-components
│       ├── dialog.tsx          # Radix Dialog wrapper
│       ├── select.tsx          # Radix Select wrapper
│       ├── textarea.tsx        # Simple wrapper
│       ├── checkbox.tsx        # Radix Checkbox wrapper
│       ├── badge.tsx           # Status badges
│       ├── alert.tsx           # Alert messages
│       ├── skeleton.tsx        # Loading skeletons
│       └── image-upload.tsx    # Custom file upload
│
├── lib/                        # Core utilities (8 files)
│   ├── api.ts                  # Main API client (361 lines)
│   │                           # - Token management
│   │                           # - Auto-refresh on 401
│   │                           # - Generic methods
│   ├── adminApi.ts             # Admin-specific API methods
│   │                           # - Dashboard stats
│   │                           # - Member CRUD
│   │                           # - Consultations
│   │                           # - Matching
│   ├── serverAuth.ts           # Server-side auth validation
│   ├── firebaseAuth.ts         # Firebase SDK integration
│   ├── firebase.ts             # Firebase config
│   ├── kakao.ts                # Kakao SDK integration
│   ├── s3Upload.ts             # S3 upload utilities
│   └── utils.ts                # cn() helper
│
├── providers/                  # Context providers
│   └── AuthProvider.tsx        # Auth state context
│                               # - Multi-method auth
│                               # - Signup required flow
│                               # - Auto-initialize from tokens
│
├── types/                      # TypeScript definitions
│   ├── index.ts                # Common types
│   ├── admin.ts                # Admin types (362 lines)
│   │                           # - Dashboard types
│   │                           # - Member types
│   │                           # - Consultation types
│   │                           # - Update request types
│   └── match.ts                # Match types
│
├── constants/                  # Constants & enums
│   └── enums.ts                # Enum options with Korean labels
│                               # - USER_STATUS_OPTIONS
│                               # - GENDER_OPTIONS
│                               # - Helper functions
│
├── fonts/                      # Custom fonts
│   └── PretendardVariable.woff2
│
└── middleware.ts               # Route protection middleware
```

## Component Organization

### Feature-Based (Recommended)

Group related components by feature/domain:

```
components/
├── admin/              # Admin dashboard components
│   ├── DashboardStats.tsx
│   ├── MemberTable.tsx
│   └── modals/         # Sub-feature grouping
├── auth/               # Authentication components
├── match/              # Matching interface components
├── sections/           # Landing page sections
├── seo/                # SEO-related components
├── layout/             # App-wide layout components
└── ui/                 # shadcn/ui base components
```

### shadcn/ui Components

All shadcn/ui components go in `src/components/ui/`:

```
components/ui/
├── button.tsx          # Button with variants (CVA)
├── card.tsx            # Card with CardHeader, CardContent, etc.
├── input.tsx           # Input with className merge
├── dialog.tsx          # Dialog with DialogContent, DialogHeader, etc.
├── select.tsx          # Select with SelectTrigger, SelectContent, etc.
└── ...
```

**DO NOT** modify ui/ components directly. Create wrapper components if needed.

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `MemberTable.tsx` |
| Utilities | camelCase | `serverAuth.ts` |
| Types | camelCase | `admin.ts` |
| Constants | camelCase | `enums.ts` |
| App routes | lowercase | `page.tsx`, `layout.tsx` |
| API routes | lowercase | `route.ts` |

## Import Patterns

### Absolute Imports (Preferred)

```typescript
// Always use @/ for project imports
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { AdminMember } from '@/types/admin';
import { USER_STATUS_OPTIONS } from '@/constants/enums';
```

### Relative Imports (Same Directory Only)

```typescript
// Only for same directory or immediate children
import { MemberRow } from './MemberRow';
import { BasicInfoEditModal } from './modals/BasicInfoEditModal';
```

### Type Imports

```typescript
// Use 'type' keyword for type-only imports
import type { AdminMember, MemberFilter } from '@/types/admin';
import type { Metadata } from 'next';
```

## Best Practices

1. **Feature Grouping**: Keep related components together
2. **Consistent Naming**: PascalCase for components, camelCase for utilities
3. **Index Exports**: NOT used in this project (direct imports preferred)
4. **Separate Concerns**: Server Components, Client Components, utilities
5. **Type Colocation**: Types can live in the types/ directory
6. **Constants Centralization**: All enums in constants/enums.ts
7. **API Separation**: Main API in api.ts, admin in adminApi.ts
8. **Modal Organization**: Group related modals in modals/ subdirectory
