# Database & ORM - SQLModel + SQLAlchemy

## YGS Database Setup

YGS uses SQLModel with SQLAlchemy ORM and asyncpg for PostgreSQL async access.

### ID Generation with ULID

All entities use ULID with entity prefixes for readable, sortable IDs:

```python
# backend/domain/user/model.py
from ulid import ULID

def generate_user_id() -> str:
    return f"usr_{ULID()}"  # usr_01HQ5K3NXYZ...

def generate_document_id() -> str:
    return f"doc_{ULID()}"  # doc_01HQ5K3NXYZ...

def generate_photo_id() -> str:
    return f"pho_{ULID()}"  # pho_01HQ5K3NXYZ...

# Entity Prefixes:
# usr_ - User
# doc_ - UserDocument
# pho_ - UserPhoto
# sub_ - UserSubscription
# aud_ - UserAccessAudit
# mw_  - MatchWeek
# mh_  - MatchHistory
# mf_  - MatchFeedback
# cs_  - ConsultSchedule
```

### User Model (SQLModel)

```python
# backend/domain/user/model.py
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=generate_user_id, primary_key=True)
    firebase_id: Optional[str] = Field(default=None, index=True)
    kakao_id: Optional[str] = Field(default=None, index=True)
    email: Optional[str] = Field(default=None, index=True)
    phone: str = Field(unique=True, index=True)
    name: str = Field(max_length=50)
    gender: str = Field(index=True)  # GenderEnum value
    birth_year: int
    status: str = Field(default="pending", index=True)  # UserStatusEnum
    is_admin: bool = Field(default=False)

    # Soft delete
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None  # Soft delete marker

    # Relationships (one-to-one)
    profile: Optional["UserProfile"] = Relationship(back_populates="user")
    lifestyle: Optional["UserLifestyle"] = Relationship(back_populates="user")
    preference: Optional["UserPreference"] = Relationship(back_populates="user")
    subscription: Optional["UserSubscription"] = Relationship(back_populates="user")

    # Relationships (one-to-many)
    photos: List["UserPhoto"] = Relationship(back_populates="user")
    documents: List["UserDocument"] = Relationship(back_populates="user")
```

### Related Models

```python
class UserProfile(SQLModel, table=True):
    __tablename__ = "user_profiles"

    id: str = Field(primary_key=True)  # Same as user_id
    user_id: str = Field(foreign_key="users.id", unique=True)
    height: Optional[int] = None
    education: Optional[str] = None  # EducationEnum
    university: Optional[str] = None
    job: Optional[str] = None
    salary_range: Optional[str] = None  # SalaryRangeEnum
    district: Optional[str] = None
    mbti: Optional[str] = None
    about_me: Optional[str] = None
    profile_appeal: Optional[str] = None

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

## Read/Write Session Separation

YGS uses separate database connections for read and write operations:

```python
# backend/db/orm.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession
from contextlib import asynccontextmanager
from weakref import WeakKeyDictionary
import asyncio

# Cache engines per event loop (for notebook/multi-loop support)
_read_engines: WeakKeyDictionary = WeakKeyDictionary()
_write_engines: WeakKeyDictionary = WeakKeyDictionary()

def get_read_engine():
    loop = asyncio.get_event_loop()
    if loop not in _read_engines:
        _read_engines[loop] = create_async_engine(
            settings.POSTGRES_READ_URL,
            pool_size=15,
            max_overflow=25,
            pool_recycle=3600,
        )
    return _read_engines[loop]

def get_write_engine():
    loop = asyncio.get_event_loop()
    if loop not in _write_engines:
        _write_engines[loop] = create_async_engine(
            settings.POSTGRES_WRITE_URL,
            pool_size=15,
            max_overflow=25,
            pool_recycle=3600,
        )
    return _write_engines[loop]

@asynccontextmanager
async def get_read_session():
    """Read session for SELECT queries (for manual use with async with)"""
    Session = get_read_sessionmaker()
    async with Session() as session:
        yield session

@asynccontextmanager
async def get_write_session():
    """Write session for INSERT/UPDATE/DELETE (for manual use with async with)"""
    Session = get_write_sessionmaker()
    async with Session() as session:
        yield session

# FastAPI Dependencies
# NOTE: Using try/finally with safe close to avoid IllegalStateChangeError
# when client disconnects during request processing
async def get_read_session_dependency():
    Session = get_read_sessionmaker()
    session = Session()
    try:
        yield session
    finally:
        try:
            await session.close()
        except Exception as e:
            # Log but don't raise - session may be in invalid state if client disconnected
            logger.debug(f"Session close failed (likely client disconnect): {e}")

async def get_write_session_dependency():
    Session = get_write_sessionmaker()
    session = Session()
    try:
        yield session
    finally:
        try:
            await session.close()
        except Exception as e:
            # Log but don't raise - session may be in invalid state if client disconnected
            logger.debug(f"Session close failed (likely client disconnect): {e}")
```

> **WARNING**: Do NOT use `async with Session() as sess: yield sess` in FastAPI
> dependency functions. This pattern causes `IllegalStateChangeError` when clients
> disconnect mid-request because the session's `close()` is called while still
> in an intermediate state.

## Queries with SQLModel

### Basic Queries with Soft Delete

```python
from sqlmodel import select

# Get by ID (excluding soft-deleted)
stmt = select(User).where(
    User.id == user_id,
    User.deleted_at.is_(None)  # Exclude soft-deleted
)
result = await session.execute(stmt)
user = result.scalar_one_or_none()

# Get all active users
stmt = select(User).where(User.deleted_at.is_(None))
result = await session.execute(stmt)
users = result.scalars().all()

# Filter by status
stmt = select(User).where(
    User.status == "approved",
    User.deleted_at.is_(None)
)
result = await session.execute(stmt)
approved = result.scalars().all()
```

### Complex Queries

```python
from sqlmodel import select, or_, and_
from sqlalchemy import func

# Multiple conditions
stmt = select(User).where(
    and_(
        User.status == "approved",
        User.gender == "male",
        User.deleted_at.is_(None)
    )
)

# OR conditions with search
stmt = select(User).where(
    and_(
        or_(
            User.name.ilike(f"%{keyword}%"),
            User.phone.ilike(f"%{keyword}%")
        ),
        User.deleted_at.is_(None)
    )
)

# Ordering
stmt = select(User).order_by(User.created_at.desc())

# Pagination
stmt = select(User).offset(offset).limit(limit)

# Count
stmt = select(func.count(User.id)).where(User.deleted_at.is_(None))
result = await session.execute(stmt)
count = result.scalar()
```

### Joins with Related Tables

```python
# Join User with Profile
from sqlalchemy.orm import selectinload

stmt = (
    select(User)
    .options(selectinload(User.profile))
    .where(User.id == user_id)
)
result = await session.execute(stmt)
user = result.scalar_one_or_none()
# Access: user.profile.height, user.profile.education

# Load multiple relationships
stmt = (
    select(User)
    .options(
        selectinload(User.profile),
        selectinload(User.photos),
        selectinload(User.subscription)
    )
    .where(User.id == user_id)
)
```

## CRUD Operations

### Create with ULID

```python
user = User(
    phone="01012345678",
    name="김철수",
    gender="male",
    birth_year=1990,
    status="pending"
)
# id automatically generated: usr_01HQ5K3NXYZ...
session.add(user)
await session.commit()
await session.refresh(user)
```

### Read with Soft Delete Check

```python
stmt = select(User).where(
    User.id == user_id,
    User.deleted_at.is_(None)
)
result = await session.execute(stmt)
user = result.scalar_one_or_none()
```

### Update

```python
stmt = select(User).where(User.id == user_id)
result = await session.execute(stmt)
user = result.scalar_one_or_none()

if user:
    user.name = "김영희"
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)
```

### Soft Delete

```python
# YGS uses soft delete - set deleted_at instead of actual deletion
stmt = select(User).where(User.id == user_id)
result = await session.execute(stmt)
user = result.scalar_one_or_none()

if user:
    user.deleted_at = datetime.utcnow()
    session.add(user)
    await session.commit()
```

## Transactions

```python
async def create_user_with_profile(session: AsyncSession, dto: UserCreateDto):
    # All operations in same session = same transaction
    user = User(
        phone=dto.phone,
        name=dto.name,
        gender=dto.gender,
        birth_year=dto.birth_year
    )
    session.add(user)
    await session.flush()  # Get user.id without committing

    profile = UserProfile(
        id=user.id,
        user_id=user.id,
        height=dto.height,
        education=dto.education
    )
    session.add(profile)

    await session.commit()  # Commits all changes atomically
    return user
```

## Best Practices

1. **ULID IDs**: Use entity prefixes for readable IDs
2. **Soft Delete**: Always check `deleted_at.is_(None)` in queries
3. **Read/Write Split**: Use correct session dependency
4. **Async all the way**: Use AsyncSession, await all queries
5. **Refresh after commit**: Get DB-generated values
6. **Index frequently queried columns**: `index=True`
7. **Unique constraints**: `unique=True` for phone, email
8. **Flush before using IDs**: Use `flush()` to get generated IDs
9. **S3 Keys Only**: Store S3 keys, not URLs (generate presigned URLs on demand)
