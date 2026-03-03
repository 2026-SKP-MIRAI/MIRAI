# Service Layer - FastAPI

## Service Pattern

Services contain business logic and orchestrate repositories.

### UserService Example

```python
# backend/domain/user/service.py
from typing import List, Optional
from datetime import datetime
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.domain.user.repository import UserRepository, UserDataLoader
from backend.domain.user.model import User, UserProfile, UserPhoto
from backend.dtos.user import (
    UserCreateDto,
    UserResponseDto,
    MemberDetailResponse,
    MemberListResponse,
)
from backend.error import NotFoundError, ValidationError, ConflictError
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
        """Create new user with business validation"""
        # Business rule: Phone must be unique
        existing = await self._repository.find_by_phone(dto.phone)
        if existing:
            raise ConflictError("Phone number already registered")

        user = User(**dto.model_dump())
        created = await self._repository.create(user)
        return UserResponseDto.from_model(created)
```

### AdminService with Complex Logic

```python
# backend/domain/admin/service.py
import asyncio
from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.domain.user.repository import UserRepository, UserDataLoader
from backend.domain.admin.repository import ConsultScheduleRepository
from backend.dtos.admin import (
    DashboardStatsResponse,
    MemberListResponse,
    MemberDetailResponse,
    AdminBasicInfoUpdateRequest,
)
from backend.error import NotFoundError, ValidationError
from backend.utils.s3 import generate_presigned_url

class AdminService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._user_repository = UserRepository(session)
        self._consult_repository = ConsultScheduleRepository(session)
        self._data_loader = UserDataLoader(session)

    async def get_dashboard_stats(self) -> DashboardStatsResponse:
        """Get dashboard statistics with parallel queries"""
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # Run all stat queries in parallel
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

    async def get_member_detail(self, user_id: str) -> MemberDetailResponse:
        """Get full member detail with all relations"""
        # Use data loader for parallel relation loading
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

        # Generate presigned URLs for photos
        photo_urls = []
        for photo in user_with_relations.photos:
            url = await generate_presigned_url(photo.s3_key)
            photo_urls.append(url)

        return MemberDetailResponse.from_user_with_relations(
            user_with_relations,
            photo_urls=photo_urls,
        )

    async def update_member_basic_info(
        self,
        user_id: str,
        dto: AdminBasicInfoUpdateRequest,
    ) -> MemberDetailResponse:
        """Update member basic info (admin action)"""
        user = await self._user_repository.get_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        # Apply updates from DTO (only non-None fields)
        update_data = dto.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)

        user.updated_at = datetime.utcnow()
        await self._user_repository.update(user)

        return await self.get_member_detail(user_id)
```

## Service Responsibilities

1. **Business Logic**: Implement domain rules
2. **Validation**: Business-level validation (beyond DTO)
3. **Orchestration**: Coordinate multiple repositories
4. **Transformation**: Model ↔ DTO conversion
5. **Error Handling**: Raise domain exceptions
6. **Presigned URLs**: Generate S3 URLs for photos/documents

## AuthService with Firebase & Kakao

```python
# backend/domain/auth/service.py
from typing import Optional
from datetime import datetime
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.domain.user.repository import UserRepository
from backend.domain.user.model import User
from backend.dtos.auth import (
    LoginRequest,
    LoginResponse,
    KakaoLoginRequest,
    FirebaseLoginRequest,
)
from backend.error import UnauthorizedError, NotFoundError, UserNotFoundSignupRequiredError
from backend.utils.firebase import verify_firebase_token, create_custom_token
from backend.utils.password import verify_password
from backend.core.config import settings
import jwt

class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._user_repository = UserRepository(session)

    async def login_with_phone(self, dto: LoginRequest) -> LoginResponse:
        """Login with phone and password"""
        user = await self._user_repository.find_by_phone(dto.phone)
        if not user:
            raise UnauthorizedError("Invalid credentials")

        if not verify_password(dto.password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")

        tokens = self._generate_tokens(user)
        return LoginResponse(**tokens, user=UserResponseDto.from_model(user))

    async def login_with_firebase(self, dto: FirebaseLoginRequest) -> LoginResponse:
        """Login with Firebase ID token"""
        # Verify Firebase token
        decoded = await verify_firebase_token(dto.id_token)
        firebase_id = decoded["uid"]

        # Find user by Firebase ID
        user = await self._user_repository.find_by_firebase_id(firebase_id)
        if not user:
            # Signup required - raise special exception with Firebase info
            raise UserNotFoundSignupRequiredError(
                message="User not found, signup required",
                firebase_id=firebase_id,
                email=decoded.get("email"),
            )

        tokens = self._generate_tokens(user)
        return LoginResponse(**tokens, user=UserResponseDto.from_model(user))

    async def login_with_kakao(self, dto: KakaoLoginRequest) -> LoginResponse:
        """Login with Kakao access token"""
        # Validate Kakao token and get user info
        kakao_user = await self._validate_kakao_token(dto.access_token)
        kakao_id = str(kakao_user["id"])

        # Find user by Kakao ID
        user = await self._user_repository.find_by_kakao_id(kakao_id)
        if not user:
            raise UserNotFoundSignupRequiredError(
                message="User not found, signup required",
                kakao_id=kakao_id,
            )

        # Create Firebase custom token for client
        firebase_token = await create_custom_token(user.firebase_id)

        tokens = self._generate_tokens(user)
        return LoginResponse(
            **tokens,
            user=UserResponseDto.from_model(user),
            firebase_custom_token=firebase_token,
        )

    def _generate_tokens(self, user: User) -> dict:
        """Generate JWT access and refresh tokens"""
        now = datetime.utcnow()

        access_payload = {
            "sub": user.id,
            "type": "access",
            "exp": now + timedelta(minutes=60),
            "iat": now,
        }
        refresh_payload = {
            "sub": user.id,
            "type": "refresh",
            "exp": now + timedelta(days=30),
            "iat": now,
        }

        return {
            "access_token": jwt.encode(access_payload, settings.JWT_SECRET_KEY),
            "refresh_token": jwt.encode(refresh_payload, settings.JWT_SECRET_KEY),
        }
```

## Multi-Repository Service Pattern

```python
class MatchService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._match_repository = MatchHistoryRepository(session)
        self._user_repository = UserRepository(session)
        self._week_repository = MatchWeekRepository(session)

    async def create_match(
        self,
        dto: MatchHistoryCreateRequest
    ) -> MatchHistoryResponse:
        """Create match with cross-domain validation"""
        # Verify week exists
        week = await self._week_repository.get_by_id(dto.week_id)
        if not week:
            raise NotFoundError("Match week not found")

        # Verify candidate user exists
        if dto.candidate_user_id:
            candidate = await self._user_repository.get_by_id(dto.candidate_user_id)
            if not candidate:
                raise NotFoundError("Candidate user not found")

        # Verify target user exists
        if dto.target_user_id:
            target = await self._user_repository.get_by_id(dto.target_user_id)
            if not target:
                raise NotFoundError("Target user not found")

        # Create match
        match = MatchHistory(**dto.model_dump())
        created = await self._match_repository.create(match)

        return MatchHistoryResponse.from_model(created)
```

## Best Practices

1. **One service per domain**: UserService for user domain
2. **Inject session**: Accept AsyncSession in constructor
3. **Return DTOs**: Never return models directly to router
4. **Raise exceptions**: Use domain exceptions for errors
5. **Business rules**: Enforce in service, not repository
6. **Parallel queries**: Use `asyncio.gather()` for independent queries
7. **Data loader**: Use UserDataLoader for loading user relations
8. **Presigned URLs**: Generate S3 URLs in service, not repository
