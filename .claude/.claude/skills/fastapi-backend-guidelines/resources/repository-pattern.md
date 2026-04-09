# Repository Pattern - FastAPI

## Repository Pattern

Repositories encapsulate all database access for a domain.

### BaseRepository

YGS has a generic BaseRepository:

```python
# backend/domain/shared/base_repository.py
from typing import Generic, TypeVar, Optional, List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime

T = TypeVar("T")

class BaseRepository(Generic[T]):
    def __init__(self, session: AsyncSession, model_class: type[T]):
        self.session = session
        self.model_class = model_class

    async def get_by_id(self, id: str) -> Optional[T]:
        """Get by ID, excluding soft-deleted"""
        stmt = select(self.model_class).where(
            self.model_class.id == id,
            self.model_class.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, entity: T) -> T:
        """Create new entity"""
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def update(self, entity: T) -> T:
        """Update entity"""
        entity.updated_at = datetime.utcnow()
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def soft_delete(self, entity: T) -> T:
        """Soft delete entity (set deleted_at)"""
        entity.deleted_at = datetime.utcnow()
        self.session.add(entity)
        await self.session.flush()
        return entity
```

### UserRepository with Domain-Specific Methods

```python
# backend/domain/user/repository.py
from typing import List, Optional, Tuple
from sqlmodel import select, or_, func
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from backend.domain.user.model import User, UserProfile, UserPhoto
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

    async def find_by_firebase_id(self, firebase_id: str) -> Optional[User]:
        """Find user by Firebase ID"""
        stmt = select(User).where(
            User.firebase_id == firebase_id,
            User.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_kakao_id(self, kakao_id: str) -> Optional[User]:
        """Find user by Kakao ID"""
        stmt = select(User).where(
            User.kakao_id == kakao_id,
            User.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def search_members(
        self,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        gender: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[User], int]:
        """Search members with filters and pagination"""
        # Build base query
        stmt = select(User).where(User.deleted_at.is_(None))

        # Apply filters
        if keyword:
            stmt = stmt.where(
                or_(
                    User.name.ilike(f"%{keyword}%"),
                    User.phone.ilike(f"%{keyword}%")
                )
            )
        if status:
            stmt = stmt.where(User.status == status)
        if gender:
            stmt = stmt.where(User.gender == gender)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar()

        # Apply pagination
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        users = list(result.scalars().all())

        return users, total
```

## UserDataLoader for N+1 Prevention

YGS uses UserDataLoader pattern with `asyncio.gather` to prevent N+1 queries:

```python
# backend/domain/user/repository.py
import asyncio
from typing import Optional
from dataclasses import dataclass

@dataclass
class UserWithRelations:
    """Container for user with loaded relations"""
    user: User
    profile: Optional[UserProfile] = None
    lifestyle: Optional[UserLifestyle] = None
    preference: Optional[UserPreference] = None
    subscription: Optional[UserSubscription] = None
    photos: List[UserPhoto] = None
    documents: List[UserDocument] = None

class UserDataLoader:
    """Parallel loader to prevent N+1 queries"""

    def __init__(self, session: AsyncSession):
        self.session = session

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

        # Build list of queries to run in parallel
        queries = []
        query_names = []

        # Always load user
        async def load_user():
            stmt = select(User).where(
                User.id == user_id,
                User.deleted_at.is_(None)
            )
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

        if load_lifestyle:
            async def load_lifestyle_fn():
                stmt = select(UserLifestyle).where(UserLifestyle.user_id == user_id)
                result = await self.session.execute(stmt)
                return result.scalar_one_or_none()
            queries.append(load_lifestyle_fn())
            query_names.append("lifestyle")

        if load_preference:
            async def load_preference_fn():
                stmt = select(UserPreference).where(UserPreference.user_id == user_id)
                result = await self.session.execute(stmt)
                return result.scalar_one_or_none()
            queries.append(load_preference_fn())
            query_names.append("preference")

        if load_subscription:
            async def load_subscription_fn():
                stmt = select(UserSubscription).where(
                    UserSubscription.user_id == user_id,
                    UserSubscription.deleted_at.is_(None)
                )
                result = await self.session.execute(stmt)
                return result.scalar_one_or_none()
            queries.append(load_subscription_fn())
            query_names.append("subscription")

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

        if load_documents:
            async def load_documents_fn():
                stmt = select(UserDocument).where(
                    UserDocument.user_id == user_id,
                    UserDocument.deleted_at.is_(None)
                )
                result = await self.session.execute(stmt)
                return list(result.scalars().all())
            queries.append(load_documents_fn())
            query_names.append("documents")

        # Execute all queries in parallel
        results = await asyncio.gather(*queries)

        # Map results to named dict
        result_dict = dict(zip(query_names, results))

        # Check if user exists
        user = result_dict.get("user")
        if not user:
            return None

        return UserWithRelations(
            user=user,
            profile=result_dict.get("profile"),
            lifestyle=result_dict.get("lifestyle"),
            preference=result_dict.get("preference"),
            subscription=result_dict.get("subscription"),
            photos=result_dict.get("photos", []),
            documents=result_dict.get("documents", []),
        )
```

### Using UserDataLoader in Service

```python
# backend/domain/user/service.py
class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._repository = UserRepository(session)
        self._data_loader = UserDataLoader(session)

    async def get_member_detail(self, user_id: str) -> MemberDetailResponse:
        """Get full member detail with all relations"""
        # Single call loads everything in parallel
        user_with_relations = await self._data_loader.load_user_with_relations(
            user_id,
            load_profile=True,
            load_lifestyle=True,
            load_preference=True,
            load_subscription=True,
            load_photos=True,
            load_documents=True,
        )

        if not user_with_relations:
            raise NotFoundError(f"User {user_id} not found")

        return MemberDetailResponse.from_user_with_relations(user_with_relations)
```

## Repository Responsibilities

1. **Database queries**: All SELECT/INSERT/UPDATE/DELETE
2. **Query optimization**: Efficient queries with indexes
3. **Return models**: Always return domain models
4. **No business logic**: Pure data access only
5. **No DTOs**: Work with models only
6. **Soft delete awareness**: Always filter `deleted_at.is_(None)`

## Best Practices

1. **Extend BaseRepository**: Reuse common CRUD operations
2. **Domain-specific methods**: Add methods for domain queries
3. **Return models**: Never return DTOs
4. **Async queries**: All methods async
5. **Type hints**: Explicit return types
6. **No transactions**: Repository doesn't commit/rollback
7. **Use UserDataLoader**: For loading multiple relations in parallel
8. **Soft delete filter**: Include `deleted_at.is_(None)` in all queries
