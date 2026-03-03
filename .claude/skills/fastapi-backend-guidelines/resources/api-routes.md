# API Routes & Routers - FastAPI

## Router Basics

FastAPI routers organize your API endpoints by domain.

### Creating a Router

```python
# backend/api/v1/routers/admin.py
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Optional

from backend.db.orm import get_read_session_dependency, get_write_session_dependency
from backend.domain.admin.service import AdminService
from backend.dtos.admin import (
    DashboardStatsResponse,
    MemberListResponse,
    MemberDetailResponse,
    AdminBasicInfoUpdateRequest,
)
from backend.error import NotFoundError

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],  # For OpenAPI docs
)
```

### Read Operations (GET)

```python
# Dashboard stats - parallel queries
@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """Get dashboard statistics"""
    service = AdminService(session)
    return await service.get_dashboard_stats()


# List with pagination and filters
@router.get("/members", response_model=MemberListResponse)
async def list_members(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    keyword: Optional[str] = Query(default=None, min_length=1),
    status: Optional[str] = Query(default=None),
    gender: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """List members with pagination and filters"""
    service = AdminService(session)
    return await service.list_members(
        page=page,
        page_size=page_size,
        keyword=keyword,
        status=status,
        gender=gender,
    )


# Get by ID
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
```

### Write Operations (POST, PATCH, DELETE)

```python
# Create
@router.post("/consultations", response_model=ConsultationResponse, status_code=status.HTTP_201_CREATED)
async def create_consultation(
    dto: ConsultationCreateRequest,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Schedule a consultation"""
    service = AdminService(session)
    return await service.create_consultation(dto)


# Update (PATCH for partial updates)
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


# Delete (soft delete)
@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    user_id: str,
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Soft delete member"""
    service = AdminService(session)
    result = await service.soft_delete_member(user_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Member {user_id} not found")
```

## Read/Write Session Split

**IMPORTANT**: Use the correct session dependency:

```python
# Read operations (SELECT)
session: AsyncSession = Depends(get_read_session_dependency)

# Write operations (INSERT, UPDATE, DELETE)
session: AsyncSession = Depends(get_write_session_dependency)
```

## Query Parameters

```python
from fastapi import Query
from typing import Optional, List

@router.get("/members")
async def list_members(
    # Required
    status: str = Query(..., description="Status filter"),

    # Optional with default
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),

    # Optional nullable
    keyword: Optional[str] = Query(default=None, min_length=1),
    gender: Optional[str] = Query(default=None),

    # Multiple values
    statuses: Optional[List[str]] = Query(default=None),

    session: AsyncSession = Depends(get_read_session_dependency),
):
    pass
```

## Path Parameters

```python
@router.get("/members/{user_id}/photos/{photo_id}")
async def get_photo(
    user_id: str,
    photo_id: str,
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """Get specific photo for a user"""
    service = UserService(session)
    return await service.get_photo(user_id, photo_id)
```

## Request Body (DTOs)

```python
from pydantic import BaseModel, Field, field_validator

class AdminBasicInfoUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = None

    model_config = {"extra": "forbid"}  # Reject unknown fields

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid = ["pending", "approved", "rejected"]
            if v not in valid:
                raise ValueError(f"Invalid status: {v}")
        return v


@router.patch("/members/{user_id}/basic")
async def update_member(
    user_id: str,
    dto: AdminBasicInfoUpdateRequest,  # Auto-validates request body
    session: AsyncSession = Depends(get_write_session_dependency),
):
    service = AdminService(session)
    return await service.update_member_basic_info(user_id, dto)
```

## Status Codes

```python
from fastapi import status

# Success codes
@router.post("/", status_code=status.HTTP_201_CREATED)  # Created
@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)  # No content
@router.get("/", status_code=status.HTTP_200_OK)  # OK (default)

# Error codes (raised as HTTPException)
from fastapi import HTTPException

if not item:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Item not found"
    )
```

## Public vs Admin Endpoints

```python
# backend/api/v1/routers/match.py

# Public endpoint - no auth required
@router.get("/status", response_model=MatchingWindowStatusResponse)
async def get_matching_status():
    """Public endpoint for matching window status"""
    info = get_matching_window_info()
    return MatchingWindowStatusResponse(
        is_open=info["is_open"],
        next_matching_date_str=info["next_matching_date_str"],
        message=info["message"],
    )


# Public endpoint with phone verification
@router.get("/my-matches", response_model=MatchCardListResponse)
async def get_my_matches(
    phone: str = Query(..., description="Phone number for verification"),
    bypass_window: bool = Query(False, description="Admin bypass"),
    session: AsyncSession = Depends(get_read_session_dependency),
):
    """Get match cards by phone number"""
    # Validate phone format
    normalized_phone = "".join(c for c in phone if c.isdigit())
    if not re.match(r"^01[0-9]\d{7,8}$", normalized_phone):
        raise HTTPException(status_code=400, detail="Invalid phone format")

    service = MatchService(session)
    return await service.get_match_cards_by_phone(normalized_phone, bypass_window)


# Admin endpoint - requires authentication
@router.get("/members/{user_id}", response_model=MemberDetailResponse)
async def get_member(
    user_id: str,
    session: AsyncSession = Depends(get_read_session_dependency),
    # current_user: User = Depends(require_admin),  # Admin auth
):
    """Admin: Get member detail"""
    service = AdminService(session)
    return await service.get_member_detail(user_id)
```

## Registering Routers

```python
# backend/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager
from backend.middleware.error_handler import ErrorHandlerMiddleware

from backend.api.v1.routers.auth import router as auth_router
from backend.api.v1.routers.user import router as user_router
from backend.api.v1.routers.admin import router as admin_router
from backend.api.v1.routers.match import router as match_router
from backend.api.v1.routers.upload import router as upload_router
from backend.api.v1.routers.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


def create_application() -> FastAPI:
    app = FastAPI(
        title="YGS API",
        description="YGS 매칭 플랫폼 API",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Add middleware
    app.add_middleware(ErrorHandlerMiddleware)

    # Register routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(user_router)
    app.include_router(admin_router)
    app.include_router(match_router)
    app.include_router(upload_router)

    return app


app = create_application()
```

## YGS API Routes Overview

| Router | Prefix | Description |
|--------|--------|-------------|
| `auth.py` | `/api/v1/auth` | Login, signup, OAuth, token refresh |
| `user.py` | `/api/v1/users` | User profile, photos, documents |
| `admin.py` | `/api/v1/admin` | Dashboard, member management |
| `match.py` | `/api/v1/matches` | Match weeks, history, cards |
| `upload.py` | `/api/v1/upload` | S3 presigned URL generation |
| `health.py` | `/api/v1/health` | Health checks |

## Best Practices

1. **Prefix**: Use `/api/v1/{domain}` for all routes
2. **Tags**: Group related endpoints with tags for docs
3. **Response Models**: Always specify `response_model`
4. **Status Codes**: Use appropriate HTTP status codes
5. **Validation**: Use Pydantic Query/Path validators
6. **Session Dependency**: Read vs Write session split
7. **Docstrings**: Document each endpoint
8. **Async**: All route handlers must be async
9. **Error Handling**: Try/except with HTTPException
10. **Extra forbid**: Reject unknown fields in DTOs
