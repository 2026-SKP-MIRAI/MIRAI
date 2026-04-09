# Async/Await Patterns - FastAPI

## Async Basics

FastAPI is async-first. All database operations should be async.

### Async Route Handler

```python
# backend/api/v1/routers/admin.py
@router.get("/members/{user_id}", response_model=MemberDetailResponse)
async def get_member(
    user_id: str,
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """Get member detail"""
    service = AdminService(session)
    return await service.get_member_detail(user_id)  # await async method
```

### Async Service Method

```python
# backend/domain/admin/service.py
class AdminService:
    async def get_member_detail(self, user_id: str) -> MemberDetailResponse:
        """Get full member detail with all relations"""
        user_with_relations = await self._data_loader.load_user_with_relations(
            user_id,
            load_profile=True,
            load_photos=True,
        )

        if not user_with_relations:
            raise NotFoundError(f"User {user_id} not found")

        return MemberDetailResponse.from_user_with_relations(user_with_relations)
```

### Async Repository Query

```python
# backend/domain/user/repository.py
class UserRepository:
    async def get_by_id(self, id: str) -> Optional[User]:
        stmt = select(User).where(
            User.id == id,
            User.deleted_at.is_(None)
        )
        # Await database query
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
```

## Concurrent Operations with asyncio.gather

### Parallel Dashboard Queries

```python
# backend/domain/admin/service.py
import asyncio

class AdminService:
    async def get_dashboard_stats(self) -> DashboardStatsResponse:
        """Get dashboard statistics with parallel queries"""
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # Run all stat queries in parallel using asyncio.gather
        (
            total_count,
            monthly_count,
            weekly_count,
            today_count,
            male_count,
            female_count,
            pending_count,
        ) = await asyncio.gather(
            self._user_repository.count_all(),
            self._user_repository.count_since(month_ago),
            self._user_repository.count_since(week_ago),
            self._user_repository.count_today(),
            self._user_repository.count_by_gender("male"),
            self._user_repository.count_by_gender("female"),
            self._user_repository.count_by_status("pending"),
        )

        return DashboardStatsResponse(
            total_members=total_count,
            monthly_signups=monthly_count,
            weekly_signups=weekly_count,
            today_signups=today_count,
            male_count=male_count,
            female_count=female_count,
            pending_reviews=pending_count,
        )
```

### UserDataLoader with Parallel Relation Loading

```python
# backend/domain/user/repository.py
class UserDataLoader:
    async def load_user_with_relations(
        self,
        user_id: str,
        load_profile: bool = False,
        load_lifestyle: bool = False,
        load_preference: bool = False,
        load_subscription: bool = False,
        load_photos: bool = False,
        load_documents: bool = False,
    ) -> Optional[UserWithRelations]:
        """Load user with optional relations in parallel"""

        queries = []
        query_names = []

        # Always load user
        async def load_user():
            stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()

        queries.append(load_user())
        query_names.append("user")

        if load_profile:
            async def load_profile_fn():
                stmt = select(UserProfile).where(UserProfile.user_id == user_id)
                result = await self.session.execute(stmt)
                return result.scalar_one_or_none()
            queries.append(load_profile_fn())
            query_names.append("profile")

        if load_photos:
            async def load_photos_fn():
                stmt = select(UserPhoto).where(
                    UserPhoto.user_id == user_id,
                    UserPhoto.deleted_at.is_(None)
                ).order_by(UserPhoto.display_order)
                result = await self.session.execute(stmt)
                return list(result.scalars().all())
            queries.append(load_photos_fn())
            query_names.append("photos")

        # Execute all queries in parallel
        results = await asyncio.gather(*queries)

        # Map results
        result_dict = dict(zip(query_names, results))
        user = result_dict.get("user")
        if not user:
            return None

        return UserWithRelations(
            user=user,
            profile=result_dict.get("profile"),
            photos=result_dict.get("photos", []),
        )
```

### Parallel S3 Presigned URL Generation

```python
# backend/domain/admin/service.py
import asyncio

class AdminService:
    async def get_member_detail(self, user_id: str) -> MemberDetailResponse:
        """Get member detail with parallel photo URL generation"""
        user_with_relations = await self._data_loader.load_user_with_relations(
            user_id,
            load_profile=True,
            load_photos=True,
        )

        if not user_with_relations:
            raise NotFoundError(f"User {user_id} not found")

        # Generate presigned URLs in parallel
        if user_with_relations.photos:
            photo_urls = await asyncio.gather(*[
                generate_presigned_url(photo.s3_key)
                for photo in user_with_relations.photos
            ])
        else:
            photo_urls = []

        return MemberDetailResponse.from_user_with_relations(
            user_with_relations,
            photo_urls=photo_urls,
        )
```

## Sequential Dependencies

```python
async def create_user_with_profile(self, dto: UserCreateDto) -> UserResponseDto:
    """Create user and profile sequentially (profile needs user.id)"""
    # Must run sequentially (profile depends on user.id)
    user = User(
        phone=dto.phone,
        name=dto.name,
        gender=dto.gender,
        birth_year=dto.birth_year,
    )
    await self._repository.create(user)  # Get user.id

    # Now create profile with user.id
    profile = UserProfile(
        id=user.id,
        user_id=user.id,
        height=dto.height,
        education=dto.education,
    )
    await self._profile_repository.create(profile)

    return UserResponseDto.from_model(user)
```

## Session Management

### AsyncSession Context

```python
from sqlmodel.ext.asyncio.session import AsyncSession

# Session provided by dependency injection
async def route_handler(
    session: AsyncSession = Depends(get_write_session_dependency),
):
    # Session automatically managed (commit/rollback)
    service = Service(session)
    return await service.do_work()
```

### Read/Write Session Split

```python
# Read operations (SELECT)
@router.get("/members")
async def list_members(
    session: AsyncSession = Depends(get_read_session_dependency),
):
    service = AdminService(session)
    return await service.list_members()

# Write operations (INSERT, UPDATE, DELETE)
@router.patch("/members/{user_id}")
async def update_member(
    user_id: str,
    dto: UpdateDto,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    service = AdminService(session)
    return await service.update_member(user_id, dto)
```

## Common Pitfalls

### ❌ Blocking Operations

```python
# ❌ Don't use blocking I/O in async functions
async def bad_handler():
    time.sleep(1)  # Blocks event loop!
    return "done"

# ✅ Use async alternatives
async def good_handler():
    await asyncio.sleep(1)  # Non-blocking
    return "done"
```

### ❌ Missing await

```python
# ❌ Forgot await - returns coroutine, not result
async def bad_service():
    item = self._repository.get_by_id(id)  # Missing await!
    return item  # This is a coroutine object, not User

# ✅ Always await async calls
async def good_service():
    item = await self._repository.get_by_id(id)
    return item  # This is User object
```

### ❌ Sequential when Parallel is Possible

```python
# ❌ Sequential queries - slower
async def bad_dashboard():
    total = await self._repo.count_all()
    male = await self._repo.count_by_gender("male")
    female = await self._repo.count_by_gender("female")
    return {"total": total, "male": male, "female": female}

# ✅ Parallel queries - faster
async def good_dashboard():
    total, male, female = await asyncio.gather(
        self._repo.count_all(),
        self._repo.count_by_gender("male"),
        self._repo.count_by_gender("female"),
    )
    return {"total": total, "male": male, "female": female}
```

## Best Practices

1. **Async all the way**: Route → Service → Repository
2. **await async calls**: Never forget await
3. **No blocking I/O**: Use async libraries
4. **Parallel when possible**: Use `asyncio.gather()` for independent queries
5. **Session per request**: Dependency injection
6. **Error handling**: try/except works with async
7. **Read/Write split**: Use correct session dependency
8. **UserDataLoader**: For loading user with multiple relations
9. **Sequential only when needed**: Dependencies between operations
