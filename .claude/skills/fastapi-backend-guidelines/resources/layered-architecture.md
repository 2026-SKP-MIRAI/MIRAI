# Layered Architecture - FastAPI

## Overview

YGS backend follows a three-layer architecture pattern:

**Router → Service → Repository**

Each layer has specific responsibilities and should not be bypassed.

---

## The Three Layers

### 1. Router Layer (API/Presentation)

**Location**: `backend/api/v1/routers/`

**Responsibilities**:
- Handle HTTP requests/responses
- Request validation (via Pydantic DTOs)
- Response formatting
- HTTP status codes
- Authentication/authorization checks
- Call service layer

**What it DOES NOT do**:
- Business logic
- Direct database access
- Complex data transformations

**Example**:
```python
# backend/api/v1/routers/admin.py
from fastapi import APIRouter, Depends, status, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.db.orm import get_read_session_dependency, get_write_session_dependency
from backend.domain.admin.service import AdminService
from backend.dtos.admin import MemberDetailResponse, AdminBasicInfoUpdateRequest
from backend.error import NotFoundError

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.get("/members/{user_id}", response_model=MemberDetailResponse)
async def get_member(
    user_id: str,
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """Get member detail"""
    service = AdminService(session)
    try:
        return await service.get_member_detail(user_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/members/{user_id}/basic", response_model=MemberDetailResponse)
async def update_member_basic_info(
    user_id: str,
    dto: AdminBasicInfoUpdateRequest,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Update member basic info"""
    service = AdminService(session)
    try:
        return await service.update_member_basic_info(user_id, dto)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### 2. Service Layer (Business Logic)

**Location**: `backend/domain/{domain}/service.py`

**Responsibilities**:
- Business logic implementation
- Domain rule enforcement
- Transaction orchestration
- Call repositories for data
- Data transformation (model → DTO)
- Error handling with domain exceptions
- N+1 prevention with UserDataLoader
- Generate presigned URLs for S3 assets

**What it DOES NOT do**:
- HTTP concerns (status codes, headers)
- Direct SQL queries
- Database session management

**Example**:
```python
# backend/domain/admin/service.py
import asyncio
from typing import List
from datetime import datetime, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.domain.user.repository import UserRepository, UserDataLoader
from backend.dtos.admin import DashboardStatsResponse, MemberDetailResponse, AdminBasicInfoUpdateRequest
from backend.error import NotFoundError
from backend.utils.s3 import generate_presigned_url

class AdminService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._user_repository = UserRepository(session)
        self._data_loader = UserDataLoader(session)

    async def get_dashboard_stats(self) -> DashboardStatsResponse:
        """Get dashboard statistics with parallel queries"""
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        # Run all queries in parallel
        total, weekly, male, female = await asyncio.gather(
            self._user_repository.count_all(),
            self._user_repository.count_since(week_ago),
            self._user_repository.count_by_gender("male"),
            self._user_repository.count_by_gender("female"),
        )

        return DashboardStatsResponse(
            total_members=total,
            weekly_signups=weekly,
            male_count=male,
            female_count=female,
        )

    async def get_member_detail(self, user_id: str) -> MemberDetailResponse:
        """Get full member detail with relations"""
        user_with_relations = await self._data_loader.load_user_with_relations(
            user_id,
            load_profile=True,
            load_photos=True,
        )

        if not user_with_relations:
            raise NotFoundError(f"User {user_id} not found")

        # Generate presigned URLs for photos
        photo_urls = []
        if user_with_relations.photos:
            photo_urls = await asyncio.gather(*[
                generate_presigned_url(photo.s3_key)
                for photo in user_with_relations.photos
            ])

        return MemberDetailResponse.from_user_with_relations(
            user_with_relations,
            photo_urls=photo_urls,
        )

    async def update_member_basic_info(
        self,
        user_id: str,
        dto: AdminBasicInfoUpdateRequest,
    ) -> MemberDetailResponse:
        """Update member basic info"""
        user = await self._user_repository.get_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        # Apply updates
        update_data = dto.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)

        user.updated_at = datetime.utcnow()
        await self._user_repository.update(user)

        return await self.get_member_detail(user_id)
```

### 3. Repository Layer (Data Access)

**Location**: `backend/domain/{domain}/repository.py`

**Responsibilities**:
- Database queries (SELECT, INSERT, UPDATE, DELETE)
- Data retrieval and persistence
- Query optimization
- Return domain models
- Soft delete filtering

**What it DOES NOT do**:
- Business logic
- DTOs (works with domain models only)
- HTTP concerns
- Validation beyond database constraints

**Example**:
```python
# backend/domain/user/repository.py
from typing import List, Optional, Tuple
from sqlmodel import select, or_, func
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.domain.user.model import User
from backend.domain.shared.base_repository import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, User)

    async def find_by_phone(self, phone: str) -> Optional[User]:
        """Find user by phone number"""
        stmt = select(User).where(
            User.phone == phone,
            User.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def search_members(
        self,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[User], int]:
        """Search members with filters"""
        stmt = select(User).where(User.deleted_at.is_(None))

        if keyword:
            stmt = stmt.where(
                or_(
                    User.name.ilike(f"%{keyword}%"),
                    User.phone.ilike(f"%{keyword}%")
                )
            )
        if status:
            stmt = stmt.where(User.status == status)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar()

        # Apply pagination
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        users = list(result.scalars().all())

        return users, total

    async def count_all(self) -> int:
        """Count all active users"""
        stmt = select(func.count(User.id)).where(User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar()

    async def count_by_gender(self, gender: str) -> int:
        """Count users by gender"""
        stmt = select(func.count(User.id)).where(
            User.gender == gender,
            User.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar()
```

---

## Data Flow

### Read Operation Flow

```
1. Client Request
   ↓
2. Router validates request (Pydantic)
   ↓
3. Router calls Service
   ↓
4. Service calls Repository / UserDataLoader
   ↓
5. Repository queries database (with soft delete filter)
   ↓
6. Repository returns Model(s)
   ↓
7. Service applies business logic
   ↓
8. Service generates presigned URLs for S3 assets
   ↓
9. Service converts Model → DTO
   ↓
10. Router returns HTTP response
```

### Write Operation Flow

```
1. Client Request with DTO
   ↓
2. Router validates DTO (Pydantic + field_validator)
   ↓
3. Router calls Service with DTO
   ↓
4. Service applies business rules
   ↓
5. Service converts DTO → Model
   ↓
6. Service calls Repository with Model
   ↓
7. Repository persists to database
   ↓
8. Repository returns saved Model
   ↓
9. Service converts Model → DTO
   ↓
10. Router returns HTTP response (201 Created)
```

---

## Why This Architecture?

### Separation of Concerns
- Each layer has clear responsibilities
- Easy to test each layer independently
- Changes in one layer don't affect others

### Maintainability
- Business logic centralized in services
- Data access logic in repositories
- API contracts in routers

### Testability
- Mock services in router tests
- Mock repositories in service tests
- Test repositories against database

### Flexibility
- Swap database implementation (repository)
- Change business rules (service)
- Modify API contracts (router)

---

## YGS-Specific Patterns

### Read/Write Session Split

```python
# Read operations (GET)
session: AsyncSession = Depends(get_read_session_dependency)

# Write operations (POST/PATCH/DELETE)
session: AsyncSession = Depends(get_write_session_dependency)
```

### UserDataLoader for N+1 Prevention

```python
# In service - load user with relations in parallel
user_with_relations = await self._data_loader.load_user_with_relations(
    user_id,
    load_profile=True,
    load_photos=True,
    load_subscription=True,
)
```

### Parallel Queries with asyncio.gather

```python
# Dashboard stats - all queries run in parallel
total, weekly, male, female = await asyncio.gather(
    self._repository.count_all(),
    self._repository.count_since(week_ago),
    self._repository.count_by_gender("male"),
    self._repository.count_by_gender("female"),
)
```

### Soft Delete Pattern

```python
# Repository always filters soft-deleted records
stmt = select(User).where(
    User.id == user_id,
    User.deleted_at.is_(None)  # Exclude soft-deleted
)
```

---

## Best Practices

1. **Never bypass layers**: Always Router → Service → Repository
2. **Services own business logic**: Don't put logic in routers or repositories
3. **Repositories return models**: DTOs are for API layer only
4. **Use dependency injection**: FastAPI's Depends() for sessions
5. **Async throughout**: All layers use async/await
6. **Read/Write split**: Use appropriate session dependency
7. **One service per request**: Create service instance in each route
8. **Error handling**: Raise domain exceptions in service, handle in router/middleware
9. **UserDataLoader**: For loading user with multiple relations
10. **asyncio.gather**: For parallel independent queries
11. **Soft delete**: Always filter `deleted_at.is_(None)`
12. **ULID IDs**: Use entity prefixes for readable IDs
