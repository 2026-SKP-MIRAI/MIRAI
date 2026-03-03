# Domain-Driven Design - FastAPI

## Domain Organization

Each domain follows this structure:

```
backend/domain/{domain}/
  __init__.py
  model.py         # SQLModel database models
  repository.py    # Data access layer
  service.py       # Business logic layer
  enums.py         # Domain-specific enums (if needed)
```

## YGS Domains

Current domains in the YGS project:

| Domain | Description | Key Models |
|--------|-------------|------------|
| **user** | User management | User, UserProfile, UserLifestyle, UserPreference, UserDocument, UserPhoto, UserSubscription, UserAccessAudit |
| **auth** | Authentication | JWT tokens, Firebase social auth, Kakao OAuth |
| **admin** | Admin dashboard | ConsultSchedule, statistics, member management |
| **match** | Matching system | MatchWeek, MatchHistory, MatchFeedback |
| **llm** | LLM integration | Gemini-enhanced compatibility analysis |
| **shared** | Shared utilities | BaseRepository, common helpers |

## Domain Structure Example

### User Domain

```
backend/domain/user/
  __init__.py
  model.py         # User, UserProfile, UserLifestyle, UserPreference,
                   # UserDocument, UserPhoto, UserSubscription, UserAccessAudit
  repository.py    # UserRepository, UserDataLoader
  service.py       # UserService
  enums.py         # GenderEnum, UserStatusEnum, EducationEnum, etc.
```

### Match Domain

```
backend/domain/match/
  __init__.py
  model.py         # MatchWeek, MatchHistory, MatchFeedback
  repository.py    # MatchWeekRepository, MatchHistoryRepository
  service.py       # MatchService
```

### Admin Domain

```
backend/domain/admin/
  __init__.py
  model.py         # ConsultSchedule
  repository.py    # ConsultScheduleRepository
  service.py       # AdminService
  matching_service.py  # Compatibility scoring
```

## Creating a New Domain

1. **Create directory**: `backend/domain/newdomain/`

2. **Create model.py**: Database models with ULID IDs
```python
# backend/domain/newdomain/model.py
from sqlmodel import SQLModel, Field
from datetime import datetime
from ulid import ULID

def generate_newdomain_id() -> str:
    return f"nd_{ULID()}"  # Use appropriate prefix

class NewEntity(SQLModel, table=True):
    __tablename__ = "new_entities"

    id: str = Field(default_factory=generate_newdomain_id, primary_key=True)
    # fields...
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None  # Soft delete
```

3. **Create repository.py**: Data access
```python
# backend/domain/newdomain/repository.py
from backend.domain.shared.base_repository import BaseRepository
from backend.domain.newdomain.model import NewEntity

class NewEntityRepository(BaseRepository[NewEntity]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, NewEntity)

    # Domain-specific queries...
```

4. **Create service.py**: Business logic
```python
# backend/domain/newdomain/service.py
from backend.domain.newdomain.repository import NewEntityRepository
from backend.dtos.newdomain import NewEntityCreateDto, NewEntityResponseDto
from backend.error import NotFoundError

class NewEntityService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._repository = NewEntityRepository(session)

    async def get_entity(self, entity_id: str) -> NewEntityResponseDto:
        entity = await self._repository.get_by_id(entity_id)
        if not entity:
            raise NotFoundError(f"Entity {entity_id} not found")
        return NewEntityResponseDto.from_model(entity)
```

5. **Create DTOs**: `backend/dtos/newdomain.py`
```python
# backend/dtos/newdomain.py
from pydantic import BaseModel, Field, field_validator

class NewEntityCreateDto(BaseModel):
    # request fields...
    model_config = {"extra": "forbid"}

class NewEntityResponseDto(BaseModel):
    id: str
    # response fields...

    @classmethod
    def from_model(cls, model) -> "NewEntityResponseDto":
        return cls(id=model.id, ...)
```

6. **Create router**: `backend/api/v1/routers/newdomain.py`
```python
# backend/api/v1/routers/newdomain.py
from fastapi import APIRouter, Depends
from backend.db.orm import get_read_session_dependency

router = APIRouter(prefix="/api/v1/newdomain", tags=["newdomain"])

@router.get("/{entity_id}")
async def get_entity(
    entity_id: str,
    session: AsyncSession = Depends(get_read_session_dependency),
):
    service = NewEntityService(session)
    return await service.get_entity(entity_id)
```

7. **Register router**: Add to `main.py`
```python
# backend/main.py
from backend.api.v1.routers.newdomain import router as newdomain_router

app.include_router(newdomain_router)
```

## Domain Independence

- Domains should be as independent as possible
- Share common code through `shared` domain
- Avoid circular dependencies
- Use DTOs for inter-domain communication

## Cross-Domain Communication

When one service needs data from another domain:

```python
# backend/domain/match/service.py
class MatchService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._match_repository = MatchHistoryRepository(session)
        self._user_repository = UserRepository(session)  # From user domain

    async def create_match(self, dto: MatchCreateDto) -> MatchResponse:
        # Validate user exists (cross-domain check)
        user = await self._user_repository.get_by_id(dto.user_id)
        if not user:
            raise NotFoundError("User not found")

        # Create match in this domain
        match = MatchHistory(**dto.model_dump())
        return await self._match_repository.create(match)
```

## Shared Domain

The `shared` domain contains:

```
backend/domain/shared/
  __init__.py
  base_repository.py  # Generic BaseRepository[T]
```

```python
# backend/domain/shared/base_repository.py
from typing import Generic, TypeVar, Optional
from sqlmodel import select
from datetime import datetime

T = TypeVar("T")

class BaseRepository(Generic[T]):
    def __init__(self, session: AsyncSession, model_class: type[T]):
        self.session = session
        self.model_class = model_class

    async def get_by_id(self, id: str) -> Optional[T]:
        stmt = select(self.model_class).where(
            self.model_class.id == id,
            self.model_class.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def update(self, entity: T) -> T:
        entity.updated_at = datetime.utcnow()
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def soft_delete(self, entity: T) -> T:
        entity.deleted_at = datetime.utcnow()
        self.session.add(entity)
        await self.session.flush()
        return entity
```

## Enums Pattern

```python
# backend/domain/user/enums.py
from enum import Enum

class GenderEnum(str, Enum):
    MALE = "male"
    FEMALE = "female"

class UserStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class EducationEnum(str, Enum):
    HIGH_SCHOOL = "high_school"
    COLLEGE = "college"
    UNIVERSITY = "university"
    GRADUATE = "graduate"

class MatchCategoryEnum(str, Enum):
    INTRO = "intro"
    EXTRA = "extra"
```

## Best Practices

1. **Single responsibility**: Each domain has one clear purpose
2. **Encapsulation**: Hide implementation details
3. **Consistent structure**: All domains follow same pattern
4. **Shared utilities**: Use `shared` domain for common code
5. **Clear boundaries**: Minimize cross-domain dependencies
6. **ULID IDs**: Use entity-specific prefixes
7. **Soft delete**: Use `deleted_at` timestamp
8. **Enums**: Define in domain's `enums.py`
9. **DTOs**: Keep in `backend/dtos/{domain}.py`
10. **Routers**: Keep in `backend/api/v1/routers/{domain}.py`
