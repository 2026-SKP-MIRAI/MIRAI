# DTOs & Validation - Pydantic

## DTOs (Data Transfer Objects)

DTOs define API contracts using Pydantic v2.

### Request DTO with field_validator

```python
# backend/dtos/admin.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

from backend.domain.user.enums import (
    UserStatusEnum,
    GenderEnum,
    EducationEnum,
    SalaryRangeEnum,
)


class AdminBasicInfoUpdateRequest(BaseModel):
    """Update user basic info (admin action)"""
    name: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=15)
    status: Optional[str] = None
    gender: Optional[str] = None

    # Reject unknown fields
    model_config = {"extra": "forbid"}

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_values = [e.value for e in UserStatusEnum]
            if v not in valid_values:
                raise ValueError(f"Invalid status: {v}. Valid: {valid_values}")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_values = [e.value for e in GenderEnum]
            if v not in valid_values:
                raise ValueError(f"Invalid gender: {v}. Valid: {valid_values}")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            # Remove non-digits and validate Korean phone format
            digits = "".join(c for c in v if c.isdigit())
            if not digits.startswith("01") or len(digits) < 10:
                raise ValueError("Invalid phone number format")
            return digits
        return v
```

### Response DTO with from_model

```python
# backend/dtos/admin.py
from datetime import datetime
from typing import Optional, List

class MemberSummaryResponse(BaseModel):
    """Member summary for list view"""
    id: str
    name: str
    phone: str
    gender: str
    birth_year: int
    status: str
    created_at: datetime

    # Optional profile info
    height: Optional[int] = None
    education: Optional[str] = None
    job: Optional[str] = None
    district: Optional[str] = None

    # Photo URL (presigned)
    photo_url: Optional[str] = None

    @classmethod
    def from_model(
        cls,
        user: User,
        profile: Optional[UserProfile] = None,
        photo_url: Optional[str] = None,
    ) -> "MemberSummaryResponse":
        """Convert domain model to DTO"""
        return cls(
            id=user.id,
            name=user.name,
            phone=user.phone,
            gender=user.gender,
            birth_year=user.birth_year,
            status=user.status,
            created_at=user.created_at,
            height=profile.height if profile else None,
            education=profile.education if profile else None,
            job=profile.job if profile else None,
            district=profile.district if profile else None,
            photo_url=photo_url,
        )

    model_config = {"from_attributes": True}


class MemberListResponse(BaseModel):
    """Paginated member list"""
    members: List[MemberSummaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
```

### Complex Request DTO with Profile Update

```python
# backend/dtos/admin.py
class AdminProfileUpdateRequest(BaseModel):
    """Update user profile (admin action)"""
    height: Optional[int] = Field(None, ge=100, le=250)
    education: Optional[str] = None
    university: Optional[str] = Field(None, max_length=100)
    job: Optional[str] = Field(None, max_length=100)
    salary_range: Optional[str] = None
    district: Optional[str] = Field(None, max_length=50)
    mbti: Optional[str] = Field(None, max_length=4)
    about_me: Optional[str] = Field(None, max_length=1000)
    profile_appeal: Optional[str] = Field(None, max_length=500)

    model_config = {"extra": "forbid"}

    @field_validator("education")
    @classmethod
    def validate_education(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_values = [e.value for e in EducationEnum]
            if v not in valid_values:
                raise ValueError(f"Invalid education: {v}. Valid: {valid_values}")
        return v

    @field_validator("salary_range")
    @classmethod
    def validate_salary_range(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_values = [e.value for e in SalaryRangeEnum]
            if v not in valid_values:
                raise ValueError(f"Invalid salary_range: {v}. Valid: {valid_values}")
        return v

    @field_validator("mbti")
    @classmethod
    def validate_mbti(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.upper()
            valid_types = [
                "INTJ", "INTP", "ENTJ", "ENTP",
                "INFJ", "INFP", "ENFJ", "ENFP",
                "ISTJ", "ISFJ", "ESTJ", "ESFJ",
                "ISTP", "ISFP", "ESTP", "ESFP",
            ]
            if v not in valid_types:
                raise ValueError(f"Invalid MBTI type: {v}")
            return v
        return v
```

## Validation Patterns

### Field Constraints

```python
from pydantic import Field, field_validator

class UserCreateDto(BaseModel):
    # Length constraints
    name: str = Field(min_length=1, max_length=50)

    # Number constraints
    birth_year: int = Field(ge=1950, le=2010)
    height: Optional[int] = Field(None, ge=100, le=250)

    # Phone pattern (Korean mobile)
    phone: str = Field(pattern=r'^01[0-9]\d{7,8}$')

    # Custom validator
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
```

### Enum Validation Pattern

```python
# backend/dtos/match.py
from backend.domain.user.enums import MatchCategoryEnum

class MatchHistoryCreateRequest(BaseModel):
    week_id: str
    candidate_user_id: Optional[str] = None
    target_user_id: Optional[str] = None
    category: MatchCategoryEnum = Field(
        default=MatchCategoryEnum.INTRO,
        description="Match category: intro or extra",
    )
    bidirectional: bool = Field(
        default=False,
        description="양방향 매칭 여부",
    )
```

### model_validator for Cross-Field Validation

```python
from pydantic import model_validator

class MatchWeekCreateRequest(BaseModel):
    year: int = Field(ge=2020, le=2100)
    week_number: int = Field(ge=1, le=53)
    label: str = Field(max_length=50)
    start_time: datetime
    end_time: datetime

    @model_validator(mode='after')
    def check_dates(self) -> 'MatchWeekCreateRequest':
        if self.end_time <= self.start_time:
            raise ValueError('end_time must be after start_time')
        return self
```

## Nested DTOs

```python
# backend/dtos/match.py
class MatchUserSummary(BaseModel):
    """Nested DTO for user info in match context"""
    user_id: Optional[str] = None
    firebase_id: Optional[str] = None
    name: Optional[str] = None
    gender: Optional[GenderEnum] = None
    phone: Optional[str] = None


class MatchHistoryResponse(BaseModel):
    """Match history with nested user info"""
    id: str
    week_id: Optional[str] = None

    # Nested DTOs
    candidate: MatchUserSummary
    target: MatchUserSummary

    category: MatchCategoryEnum
    matched_at: datetime
    target_selected: bool
    created_at: datetime
    updated_at: datetime
```

## Dashboard Stats DTO

```python
# backend/dtos/admin.py
class DashboardStatsResponse(BaseModel):
    """Dashboard statistics"""
    total_members: int = Field(description="Total registered members")
    monthly_signups: int = Field(description="Signups in last 30 days")
    weekly_signups: int = Field(description="Signups in last 7 days")
    today_signups: int = Field(description="Signups today")
    male_count: int = Field(description="Total male members")
    female_count: int = Field(description="Total female members")
    pending_reviews: int = Field(description="Members pending review")


class GenderRatioResponse(BaseModel):
    """Gender ratio for charts"""
    male_count: int
    female_count: int
    male_percentage: float
    female_percentage: float


class WeeklyTrendItem(BaseModel):
    """Single week trend data point"""
    week_start: datetime
    week_label: str
    count: int


class WeeklyTrendResponse(BaseModel):
    """Weekly registration trend"""
    data: List[WeeklyTrendItem]
```

## Usage in Routes

```python
@router.patch("/members/{user_id}/basic", response_model=MemberDetailResponse)
async def update_member_basic_info(
    user_id: str,
    dto: AdminBasicInfoUpdateRequest,  # Auto-validates request body
    session: AsyncSession = Depends(get_write_session_dependency),
):
    """Update member basic info"""
    service = AdminService(session)
    return await service.update_member_basic_info(user_id, dto)
```

## Best Practices

1. **Separate Request/Response**: Different DTOs for input/output
2. **field_validator**: Use for enum and custom validation
3. **model_config = {"extra": "forbid"}**: Reject unknown fields
4. **from_model method**: Convert models to response DTOs
5. **Type hints**: Explicit types on all fields
6. **Field descriptions**: Document with Field(description=...)
7. **No business logic**: DTOs are data containers only
8. **Nested DTOs**: Use for complex nested data structures
9. **model_validator**: Use for cross-field validation
10. **Enum types**: Use domain enums directly or validate strings
