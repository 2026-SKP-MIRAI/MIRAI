# Complete Examples - FastAPI

## Full User Domain Example

### Model

```python
# backend/domain/user/model.py
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from ulid import ULID


def generate_user_id() -> str:
    return f"usr_{ULID()}"


def generate_photo_id() -> str:
    return f"pho_{ULID()}"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=generate_user_id, primary_key=True)
    firebase_id: Optional[str] = Field(default=None, index=True)
    kakao_id: Optional[str] = Field(default=None, index=True)
    email: Optional[str] = Field(default=None, index=True)
    phone: str = Field(unique=True, index=True)
    name: str = Field(max_length=50)
    gender: str = Field(index=True)
    birth_year: int
    status: str = Field(default="pending", index=True)
    is_admin: bool = Field(default=False)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None  # Soft delete

    # Relationships
    profile: Optional["UserProfile"] = Relationship(back_populates="user")
    photos: List["UserPhoto"] = Relationship(back_populates="user")


class UserProfile(SQLModel, table=True):
    __tablename__ = "user_profiles"

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True)
    height: Optional[int] = None
    education: Optional[str] = None
    university: Optional[str] = None
    job: Optional[str] = None
    salary_range: Optional[str] = None
    district: Optional[str] = None
    mbti: Optional[str] = None
    about_me: Optional[str] = None

    user: Optional[User] = Relationship(back_populates="profile")


class UserPhoto(SQLModel, table=True):
    __tablename__ = "user_photos"

    id: str = Field(default_factory=generate_photo_id, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    s3_key: str  # S3 key only, never URL
    thumbnail_s3_key: Optional[str] = None
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None

    user: Optional[User] = Relationship(back_populates="photos")
```

### Repository

```python
# backend/domain/user/repository.py
from typing import List, Optional, Tuple
from sqlmodel import select, or_, func
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime
import asyncio
from dataclasses import dataclass

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

    async def search_members(
        self,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        gender: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[User], int]:
        """Search members with filters and pagination"""
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


@dataclass
class UserWithRelations:
    """Container for user with loaded relations"""
    user: User
    profile: Optional[UserProfile] = None
    photos: List[UserPhoto] = None


class UserDataLoader:
    """Parallel loader to prevent N+1 queries"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def load_user_with_relations(
        self,
        user_id: str,
        load_profile: bool = False,
        load_photos: bool = False,
    ) -> Optional[UserWithRelations]:
        """Load user with optional relations in parallel"""
        queries = []
        query_names = []

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

        results = await asyncio.gather(*queries)
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

### Service

```python
# backend/domain/user/service.py
from typing import List, Optional
from datetime import datetime
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.domain.user.repository import UserRepository, UserDataLoader
from backend.domain.user.model import User, UserProfile
from backend.dtos.user import UserCreateDto, UserResponseDto, MemberDetailResponse
from backend.error import NotFoundError, ConflictError
from backend.utils.s3 import generate_presigned_url


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._repository = UserRepository(session)
        self._data_loader = UserDataLoader(session)

    async def get_user(self, user_id: str) -> UserResponseDto:
        """Get user by ID"""
        user = await self._repository.get_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")
        return UserResponseDto.from_model(user)

    async def get_user_by_phone(self, phone: str) -> Optional[UserResponseDto]:
        """Get user by phone number"""
        user = await self._repository.find_by_phone(phone)
        if not user:
            return None
        return UserResponseDto.from_model(user)

    async def create_user(self, dto: UserCreateDto) -> UserResponseDto:
        """Create new user"""
        # Business rule: Phone must be unique
        existing = await self._repository.find_by_phone(dto.phone)
        if existing:
            raise ConflictError("Phone number already registered")

        user = User(**dto.model_dump())
        created = await self._repository.create(user)
        return UserResponseDto.from_model(created)

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

    async def update_user(self, user_id: str, dto: UserUpdateDto) -> UserResponseDto:
        """Update user"""
        user = await self._repository.get_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        # Apply updates
        update_data = dto.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)

        user.updated_at = datetime.utcnow()
        await self._repository.update(user)
        return UserResponseDto.from_model(user)

    async def soft_delete_user(self, user_id: str) -> bool:
        """Soft delete user"""
        user = await self._repository.get_by_id(user_id)
        if not user:
            return False
        await self._repository.soft_delete(user)
        return True
```

### DTOs

```python
# backend/dtos/user.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

from backend.domain.user.enums import GenderEnum, UserStatusEnum


class UserCreateDto(BaseModel):
    """Create user request"""
    phone: str = Field(pattern=r'^01[0-9]\d{7,8}$')
    name: str = Field(min_length=1, max_length=50)
    gender: str
    birth_year: int = Field(ge=1950, le=2010)

    model_config = {"extra": "forbid"}

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        valid_values = [e.value for e in GenderEnum]
        if v not in valid_values:
            raise ValueError(f"Invalid gender: {v}")
        return v


class UserResponseDto(BaseModel):
    """User response"""
    id: str
    phone: str
    name: str
    gender: str
    birth_year: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    @classmethod
    def from_model(cls, model: User) -> "UserResponseDto":
        return cls(
            id=model.id,
            phone=model.phone,
            name=model.name,
            gender=model.gender,
            birth_year=model.birth_year,
            status=model.status,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    model_config = {"from_attributes": True}


class MemberDetailResponse(BaseModel):
    """Full member detail with relations"""
    id: str
    phone: str
    name: str
    gender: str
    birth_year: int
    status: str
    created_at: datetime

    # Profile info
    height: Optional[int] = None
    education: Optional[str] = None
    job: Optional[str] = None
    district: Optional[str] = None
    mbti: Optional[str] = None
    about_me: Optional[str] = None

    # Photo URLs (presigned)
    photo_urls: List[str] = Field(default_factory=list)

    @classmethod
    def from_user_with_relations(
        cls,
        data: UserWithRelations,
        photo_urls: List[str] = None,
    ) -> "MemberDetailResponse":
        return cls(
            id=data.user.id,
            phone=data.user.phone,
            name=data.user.name,
            gender=data.user.gender,
            birth_year=data.user.birth_year,
            status=data.user.status,
            created_at=data.user.created_at,
            height=data.profile.height if data.profile else None,
            education=data.profile.education if data.profile else None,
            job=data.profile.job if data.profile else None,
            district=data.profile.district if data.profile else None,
            mbti=data.profile.mbti if data.profile else None,
            about_me=data.profile.about_me if data.profile else None,
            photo_urls=photo_urls or [],
        )
```

### Router

```python
# backend/api/v1/routers/user.py
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from backend.db.orm import get_read_session_dependency, get_write_session_dependency
from backend.domain.user.service import UserService
from backend.dtos.user import UserCreateDto, UserResponseDto, MemberDetailResponse
from backend.error import NotFoundError, ConflictError

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/{user_id}", response_model=MemberDetailResponse)
async def get_user(
    user_id: str,
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """Get user detail with profile and photos"""
    service = UserService(session)
    try:
        return await service.get_member_detail(user_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/", response_model=UserResponseDto, status_code=status.HTTP_201_CREATED)
async def create_user(
    dto: UserCreateDto,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Create new user"""
    service = UserService(session)
    try:
        return await service.create_user(dto)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/{user_id}", response_model=UserResponseDto)
async def update_user(
    user_id: str,
    dto: UserUpdateDto,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Update user"""
    service = UserService(session)
    try:
        return await service.update_user(user_id, dto)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Soft delete user"""
    service = UserService(session)
    result = await service.soft_delete_user(user_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
```

### Register Router

```python
# backend/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager
from backend.api.v1.routers.user import router as user_router
from backend.middleware.error_handler import ErrorHandlerMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_application() -> FastAPI:
    app = FastAPI(title="YGS API", lifespan=lifespan)
    app.add_middleware(ErrorHandlerMiddleware)
    app.include_router(user_router)
    return app


app = create_application()
```

## This Complete Example Demonstrates

- ✅ Layered architecture (Router → Service → Repository)
- ✅ Domain-Driven Design structure
- ✅ ULID ID generation with entity prefixes
- ✅ SQLModel models with relationships
- ✅ Repository pattern with BaseRepository
- ✅ UserDataLoader for N+1 prevention
- ✅ Service layer with business logic
- ✅ Pydantic DTOs with field_validator
- ✅ FastAPI routers with dependency injection
- ✅ Read/Write session split
- ✅ Soft delete pattern
- ✅ Async/await with asyncio.gather
- ✅ Error handling with custom exceptions
- ✅ S3 presigned URLs for photos
- ✅ Pagination support
- ✅ Type hints everywhere
