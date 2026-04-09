# Common Patterns - YGS Next.js 15

## Authentication

### AuthProvider Pattern (Primary Method)

YGS uses a centralized AuthProvider for client-side auth state:

```typescript
'use client';

import { useAuth } from '@/providers/AuthProvider';

export function MyComponent() {
  const {
    user,              // Current user info
    isLoading,         // Auth initialization loading
    isAuthenticated,   // Boolean check
    signupRequired,    // Signup data if needed
    loginWithKakao,    // Kakao OAuth login
    loginWithGoogle,   // Google Firebase login
    loginWithKakaoFirebase, // Kakao via Firebase
    completeSignup,    // Complete signup flow
    clearSignupRequired,
    login,             // Manual login
    logout,            // Logout
    refreshUser,       // Refresh user data
  } = useAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <LoginPrompt />;

  return <div>환영합니다, {user?.nickname}님</div>;
}
```

### Server-Side Auth Check

For protected routes (layouts):

```typescript
// app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerSession } from '@/lib/serverAuth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await getServerSession(cookieStore);

  if (!session.isAuthenticated) {
    redirect('/login');
  }

  // Check admin claim from JWT
  if (!session.isAdmin) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### Hydration Protection Pattern

Prevent hydration mismatches with auth-dependent content:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';

export function Navbar() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="flex items-center justify-between h-16 px-6">
      <Logo />

      {/* Auth-dependent content only after mount */}
      {mounted && !isLoading ? (
        isAuthenticated ? (
          <UserMenu user={user} />
        ) : (
          <Button onClick={() => router.push('/login')}>로그인</Button>
        )
      ) : (
        // Placeholder to prevent layout shift
        <div className="w-[72px] h-10" />
      )}
    </nav>
  );
}
```

---

## File Upload to S3

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadToS3, compressImage } from '@/lib/s3Upload';
import { Loader2 } from 'lucide-react';

export function FileUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Optional: compress image before upload
      const compressed = await compressImage(file);
      const s3Key = await uploadToS3(compressed);
      console.log('업로드 완료:', s3Key);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }, [file]);

  return (
    <div className="space-y-4">
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button onClick={handleUpload} disabled={uploading || !file}>
        {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {uploading ? '업로드 중...' : '업로드'}
      </Button>
    </div>
  );
}
```

---

## Form Handling

### Manual State Management (YGS Primary Pattern)

YGS uses manual state management with field-level validation:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { GENDER_OPTIONS } from '@/constants/enums';

interface FormData {
  phone: string;
  name: string;
  gender: string;
  birthYear: string;
}

interface FormErrors {
  phone?: string;
  name?: string;
  gender?: string;
  birthYear?: string;
}

export function SignupForm() {
  const [formData, setFormData] = useState<FormData>({
    phone: '',
    name: '',
    gender: '',
    birthYear: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Phone number auto-formatting
  const formatPhoneNumber = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!/^010-\d{4}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = '올바른 전화번호 형식이 아닙니다. (010-0000-0000)';
    }
    if (formData.name.length < 2) {
      newErrors.name = '이름은 2자 이상이어야 합니다.';
    }
    if (!formData.gender) {
      newErrors.gender = '성별을 선택해주세요.';
    }
    if (!formData.birthYear) {
      newErrors.birthYear = '출생연도를 선택해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    const formattedValue = field === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    // Clear error on input
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await api.post('/api/v1/auth/signup', formData);
      // Handle success
    } catch (err) {
      if (err instanceof Error) {
        setErrors({ phone: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Phone */}
      <div className="space-y-2">
        <label className="text-sm font-medium">전화번호</label>
        <Input
          value={formData.phone}
          onChange={e => handleInputChange('phone', e.target.value)}
          placeholder="010-0000-0000"
          className={cn(errors.phone && 'border-red-500')}
        />
        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">이름</label>
        <Input
          value={formData.name}
          onChange={e => handleInputChange('name', e.target.value)}
          placeholder="이름을 입력해주세요"
          className={cn(errors.name && 'border-red-500')}
        />
        {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <label className="text-sm font-medium">성별</label>
        <Select value={formData.gender} onValueChange={v => handleInputChange('gender', v)}>
          <SelectTrigger className={cn(errors.gender && 'border-red-500')}>
            <SelectValue placeholder="성별 선택" />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.gender && <p className="text-sm text-red-500">{errors.gender}</p>}
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? '처리 중...' : '가입하기'}
      </Button>
    </form>
  );
}
```

---

## URL-Based State (Pagination/Filtering)

```typescript
'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MemberFilter } from '@/types/admin';

export function useMemberFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse current filters from URL
  const filters: MemberFilter = {
    status: searchParams.get('status') || '',
    gender: searchParams.get('gender') || '',
    search: searchParams.get('search') || '',
    skip: Number(searchParams.get('skip')) || 0,
    limit: Number(searchParams.get('limit')) || 20,
  };

  // Update URL with new filters
  const updateURL = useCallback((newFilters: Partial<MemberFilter>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...newFilters };

    if (merged.status) params.set('status', merged.status);
    if (merged.gender) params.set('gender', merged.gender);
    if (merged.search) params.set('search', merged.search);
    if (merged.skip) params.set('skip', String(merged.skip));
    if (merged.limit !== 20) params.set('limit', String(merged.limit));

    router.push(`/admin/members${params.toString() ? `?${params}` : ''}`);
  }, [filters, router]);

  // Reset filters
  const resetFilters = useCallback(() => {
    router.push('/admin/members');
  }, [router]);

  return { filters, updateURL, resetFilters };
}

// Usage in component
export function MemberFilters() {
  const { filters, updateURL, resetFilters } = useMemberFilters();

  return (
    <div className="flex gap-4">
      <Input
        value={filters.search}
        onChange={e => updateURL({ search: e.target.value, skip: 0 })}
        placeholder="검색..."
      />
      <Select
        value={filters.status || 'all'}
        onValueChange={v => updateURL({ status: v === 'all' ? '' : v, skip: 0 })}
      >
        {/* options */}
      </Select>
      <Button variant="outline" onClick={resetFilters}>
        초기화
      </Button>
    </div>
  );
}
```

---

## Dialog/Modal Pattern

### Edit Modal (YGS Pattern)

```typescript
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateMemberBasic } from '@/lib/adminApi';
import { Loader2 } from 'lucide-react';
import type { MemberDetail, BasicInfoUpdateRequest } from '@/types/admin';

interface BasicInfoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (member: MemberDetail) => void;
  member: MemberDetail;
}

export function BasicInfoEditModal({
  isOpen,
  onClose,
  onSuccess,
  member,
}: BasicInfoEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    status: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: member.name,
        status: member.status,
      });
      setError('');
    }
  }, [isOpen, member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Only send changed fields
      const changes: BasicInfoUpdateRequest = {};
      if (formData.name !== member.name) changes.name = formData.name;
      if (formData.status !== member.status) changes.status = formData.status;

      // Skip if no changes
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }

      const result = await updateMemberBasic(member.id, changes);
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>기본 정보 수정</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">이름</label>
            <Input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">상태</label>
            <Select
              value={formData.status}
              onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Select with Constants

```typescript
'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USER_STATUS_OPTIONS, GENDER_OPTIONS } from '@/constants/enums';

export function FilterSelect() {
  const [status, setStatus] = useState<string>('');
  const [gender, setGender] = useState<string>('');

  return (
    <div className="flex gap-4">
      {/* Status Select */}
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="상태 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          {USER_STATUS_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Gender Select */}
      <Select value={gender} onValueChange={setGender}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="성별" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          {GENDER_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

---

## Loading Button Pattern

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps {
  children: React.ReactNode;
  onClick: () => Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
}

export function LoadingButton({ children, onClick, variant, className }: LoadingButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      className={className}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
```

---

## Error Handling Pattern

### API Error Class

```typescript
// lib/api.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

// Usage in component
try {
  await api.post('/endpoint', data);
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      // Unauthorized - redirect to login
      router.push('/login');
    } else if (err.status === 409) {
      // Conflict - duplicate entry
      setError('이미 등록된 정보입니다.');
    } else if (err.status === 404) {
      // Not found
      setError('데이터를 찾을 수 없습니다.');
    } else {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    }
  } else if (err instanceof Error) {
    setError(err.message);
  } else {
    setError('알 수 없는 오류가 발생했습니다.');
  }
}
```

### Social Login Error Handling

```typescript
const handleSocialLogin = async (provider: 'kakao' | 'google') => {
  try {
    setLoadingProvider(provider);
    await loginFn();

    if (signupRequired) {
      onSignupRequired?.();
    } else {
      router.push(redirectTo);
    }
  } catch (err) {
    if (err instanceof Error) {
      // Silent failures for user cancellations
      if (err.message.includes('popup-closed-by-user')) return;
      if (err.message.includes('cancelled')) return;

      // Show specific error messages
      setError(getErrorMessage(provider, err));
    } else {
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
    }
  } finally {
    setLoadingProvider(null);
  }
};

function getErrorMessage(provider: string, error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('network')) {
    return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
  }
  if (msg.includes('auth/account-exists')) {
    return '이미 다른 방법으로 가입된 계정입니다.';
  }

  const providerName = provider === 'kakao' ? '카카오' : '구글';
  return `${providerName} 로그인에 실패했습니다. 다시 시도해주세요.`;
}
```

---

## Skeleton Loading Pattern

```typescript
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Table skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// Card grid skeleton
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Stats skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <CardGridSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}
```

---

## Status Badge Pattern

```typescript
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getEnumLabel, USER_STATUS_OPTIONS } from '@/constants/enums';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_review: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-600',
  withdrawn: 'bg-gray-100 text-gray-500',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(statusColors[status] || 'bg-gray-100', className)}>
      {getEnumLabel(USER_STATUS_OPTIONS, status)}
    </Badge>
  );
}
```
