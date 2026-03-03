# FastAPI Backend Guidelines Skill

## Overview

This skill provides comprehensive backend development guidelines adapted specifically for your YGS (영영사/Youngyeolsa) project's tech stack:

- **FastAPI** (async Python framework)
- **SQLModel + SQLAlchemy** (ORM)
- **Python 3.12.3** (exact version)
- **PostgreSQL** with asyncpg
- **Domain-Driven Design** architecture
- **Layered Architecture** (Router → Service → Repository)
- **ULID** for ID generation with prefixes
- **Firebase + Kakao OAuth** authentication

## What This Skill Covers

1. **Layered Architecture** - Router → Service → Repository pattern
2. **API Routes & Routers** - FastAPI router patterns, dependency injection
3. **Database & ORM** - SQLModel models, async queries, session management
4. **Domain-Driven Design** - Domain organization, separation of concerns
5. **Service Layer** - Business logic, orchestration, domain rules
6. **Repository Pattern** - Data access layer, BaseRepository extension, UserDataLoader
7. **DTOs & Validation** - Pydantic DTOs, request/response validation with field_validator
8. **Async/Await Patterns** - Async best practices, asyncio.gather for parallel queries
9. **Error Handling** - Custom exceptions, middleware error handling
10. **Complete Examples** - Full CRUD domain implementation

## YGS-Specific Patterns

### ID Generation with ULID
```python
from ulid import ULID

def generate_user_id() -> str:
    return f"usr_{ULID()}"  # usr_01HQ5K3NXYZ...

def generate_match_history_id() -> str:
    return f"mh_{ULID()}"   # mh_01HQ5K3NXYZ...
```

**Entity Prefixes:**
- `usr_` - User
- `doc_` - UserDocument
- `pho_` - UserPhoto
- `sub_` - UserSubscription
- `aud_` - UserAccessAudit
- `mw_` - MatchWeek
- `mh_` - MatchHistory
- `mf_` - MatchFeedback
- `cs_` - ConsultSchedule

### Read/Write Session Separation
```python
# Read operations (GET requests)
@router.get("/{user_id}")
async def get_user(
    session: AsyncSession = Depends(get_read_session_dependency),
): ...

# Write operations (POST/PATCH/DELETE)
@router.post("")
async def create_user(
    session: AsyncSession = Depends(get_write_session_dependency),
): ...
```

### N+1 Prevention with UserDataLoader
```python
# Parallel query loading for user with relations
user_with_relations = await self._data_loader.load_user_with_relations(
    user_id,
    load_profile=True,
    load_photos=True,
    load_documents=True,
)
```

### DTO Validation with field_validator
```python
class AdminBasicInfoUpdateRequest(BaseModel):
    status: Optional[str] = Field(None)

    model_config = {"extra": "forbid"}  # Reject unknown fields

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_values = [e.value for e in UserStatusEnum]
            if v not in valid_values:
                raise ValueError(f"Invalid: {v}")
        return v
```

## Skill Activation

The skill is configured to activate when:

### File Triggers
- Working in `backend/backend/**/*.py`
- Files containing FastAPI imports, async patterns, SQLModel, repositories

### Prompt Triggers
- Keywords: "backend", "FastAPI", "service", "repository", "router", "async", "SQLModel", "domain", "dto"
- Intent patterns: Creating/editing routes, services, repositories, database queries

### Enforcement
- **Type**: Domain (suggests, doesn't block)
- **Priority**: High
- The skill will suggest itself when working on backend code

## Project Structure Match

The skill references YOUR actual project structure:

```
backend/
  backend/
    main.py                    # FastAPI app with lifespan

    api/v1/routers/            # Your routers
      admin.py                 # Dashboard, members, matching (950+ lines)
      auth.py                  # Login, signup, Firebase, Kakao OAuth
      match.py                 # Match weeks, history, cards
      user.py                  # User CRUD, photos, documents
      upload.py                # S3 presigned URLs

    domain/                    # Your domains
      user/
        model.py               # User, UserProfile, UserLifestyle, etc.
        repository.py          # UserRepository, UserDataLoader
        service.py             # UserService
        enums.py               # All domain enums
      auth/
        service.py             # AuthService (JWT, Firebase, Kakao)
      admin/
        service.py             # AdminService
        matching_service.py    # Compatibility scoring
      match/
        model.py               # MatchWeek, MatchHistory, MatchFeedback
        service.py             # MatchService
      llm/
        matching_service.py    # LLM-enhanced matching
      shared/
        base_repository.py     # Generic BaseRepository

    dtos/                      # Your DTOs
      admin.py                 # Dashboard, member update DTOs
      auth.py                  # OAuth DTOs
      match.py                 # Match DTOs
      user.py                  # User DTOs
      llm_match.py             # LLM matching DTOs

    db/
      orm.py                   # Read/Write session management with caching

    error/
      __init__.py              # AppException hierarchy
```

## Integration Status

✅ Skill directory created: `.claude/skills/fastapi-backend-guidelines/`
✅ Main skill.md updated for YGS patterns
✅ 10 resource files with FastAPI patterns
✅ YGS-specific patterns documented:
  - ULID ID generation with prefixes
  - Read/Write session separation
  - UserDataLoader for N+1 prevention
  - Firebase/Kakao OAuth
  - field_validator patterns
  - Soft delete with deleted_at

## Tech Stack Compatibility

✅ **FastAPI**: All patterns use FastAPI routers and dependencies
✅ **SQLModel + SQLAlchemy**: Query patterns and model definitions
✅ **Async/await**: All examples use async throughout
✅ **Python 3.12.3**: Type hints and modern Python patterns
✅ **PostgreSQL + asyncpg**: Async database operations
✅ **Domain-Driven Design**: Matches your domain organization
✅ **Layered Architecture**: Router → Service → Repository pattern
✅ **Pydantic v2**: DTOs with field_validator
✅ **ULID**: ID generation with entity prefixes
✅ **Your session management**: Uses `get_read_session_dependency()` and `get_write_session_dependency()`

## Key YGS Domains

| Domain | Description | Key Models |
|--------|-------------|------------|
| `user` | User management | User, UserProfile, UserLifestyle, UserPreference, UserDocument, UserPhoto, UserSubscription, UserAccessAudit |
| `auth` | Authentication | JWT tokens, Firebase social auth, Kakao OAuth |
| `admin` | Admin dashboard | ConsultSchedule, member management, statistics |
| `match` | Matching system | MatchWeek, MatchHistory, MatchFeedback |
| `llm` | LLM matching | Gemini-enhanced compatibility analysis |

## Files Created

```
.claude/skills/fastapi-backend-guidelines/
  ├── skill.md                              # Main skill overview
  ├── README.md                             # This file
  └── resources/
      ├── layered-architecture.md           # Router → Service → Repository
      ├── api-routes.md                     # FastAPI routers & endpoints
      ├── database-orm.md                   # SQLModel queries & models
      ├── domain-driven-design.md           # Domain organization
      ├── service-layer.md                  # Business logic layer
      ├── repository-pattern.md             # Data access layer
      ├── dtos-validation.md                # Pydantic DTOs
      ├── async-patterns.md                 # Async/await best practices
      ├── error-handling.md                 # Custom exceptions
      └── complete-examples.md              # Full CRUD implementation
```

## Core Principles Covered

1. **Layered Architecture**: Never bypass layers (Router → Service → Repository)
2. **Domain-Driven Design**: Organize by domain, not by type
3. **Async Everything**: Use async/await throughout the stack
4. **Repository Pattern**: All data access through repositories
5. **Service Layer**: Business logic in services, not routers
6. **DTOs for API**: Use Pydantic DTOs for request/response
7. **Type Hints**: Explicit types on all functions
8. **Error Handling**: Custom exceptions mapped to HTTP
9. **Read/Write Split**: Separate sessions for different operations
10. **Dependency Injection**: Use FastAPI's Depends()
11. **ULID IDs**: Entity prefixes for readable IDs
12. **Soft Delete**: deleted_at instead of hard deletes
13. **N+1 Prevention**: UserDataLoader with asyncio.gather

---

**Status**: ✅ Fully integrated with YGS-specific patterns
**Updated**: 2026-01-14
**Project**: YGS (영영사/Youngyeolsa) - 전문 매칭 플랫폼
