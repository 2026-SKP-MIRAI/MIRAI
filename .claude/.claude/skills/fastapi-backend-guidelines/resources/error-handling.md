# Error Handling - FastAPI

## Custom Exceptions

YGS defines domain-specific exceptions:

```python
# backend/error/__init__.py

class AppException(Exception):
    """Base exception for all application errors"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    """Resource not found (HTTP 404)"""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ValidationError(AppException):
    """Validation failed (HTTP 400)"""
    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, status_code=400)


class UnauthorizedError(AppException):
    """Unauthorized access (HTTP 401)"""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status_code=401)


class ForbiddenError(AppException):
    """Forbidden access (HTTP 403)"""
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status_code=403)


class ConflictError(AppException):
    """Resource conflict (HTTP 409)"""
    def __init__(self, message: str = "Conflict"):
        super().__init__(message, status_code=409)


class UserNotFoundSignupRequiredError(AppException):
    """Special exception for OAuth flows requiring signup"""
    def __init__(
        self,
        message: str = "User not found, signup required",
        firebase_id: str = None,
        kakao_id: str = None,
        email: str = None,
    ):
        super().__init__(message, status_code=404)
        self.firebase_id = firebase_id
        self.kakao_id = kakao_id
        self.email = email
```

## Using Exceptions in Services

```python
# backend/domain/user/service.py
from backend.error import NotFoundError, ValidationError, ConflictError

class UserService:
    async def get_user(self, user_id: str) -> UserResponseDto:
        """Get user by ID"""
        user = await self._repository.get_by_id(user_id)

        # Raise domain exception
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        return UserResponseDto.from_model(user)

    async def create_user(self, dto: UserCreateDto) -> UserResponseDto:
        """Create user with business validation"""
        # Check for duplicate phone
        existing = await self._repository.find_by_phone(dto.phone)
        if existing:
            raise ConflictError("Phone number already registered")

        # Business validation
        if dto.birth_year > 2010:
            raise ValidationError("User must be at least 14 years old")

        user = User(**dto.model_dump())
        return await self._repository.create(user)


# backend/domain/auth/service.py
from backend.error import UnauthorizedError, UserNotFoundSignupRequiredError

class AuthService:
    async def login_with_firebase(self, dto: FirebaseLoginRequest) -> LoginResponse:
        """Firebase login with signup redirect"""
        decoded = await verify_firebase_token(dto.id_token)
        firebase_id = decoded["uid"]

        user = await self._user_repository.find_by_firebase_id(firebase_id)
        if not user:
            # Special exception carries OAuth info for signup
            raise UserNotFoundSignupRequiredError(
                message="User not found, signup required",
                firebase_id=firebase_id,
                email=decoded.get("email"),
            )

        return self._generate_login_response(user)

    async def verify_token(self, token: str) -> User:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise UnauthorizedError("Token has expired")
        except jwt.InvalidTokenError:
            raise UnauthorizedError("Invalid token")

        user = await self._user_repository.get_by_id(payload["sub"])
        if not user:
            raise UnauthorizedError("User not found")

        return user
```

## Exception Handlers (Recommended)

> **WARNING**: Do NOT use `BaseHTTPMiddleware` for error handling. It conflicts with
> FastAPI's dependency injection and causes `IllegalStateChangeError` with SQLAlchemy
> async sessions. Use `@app.exception_handler` decorators instead.

```python
# backend/middleware/error_handler.py
import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, IntegrityError

from backend.error import (
    AppException,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    UserNotFoundSignupRequiredError,
    ValidationError,
)

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers to the FastAPI app."""

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        logger.info(f"Not found: {request.url} - {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": exc.message},
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        logger.info(f"Validation error: {request.url} - {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": exc.message},
        )

    @app.exception_handler(UnauthorizedError)
    async def unauthorized_handler(
        request: Request, exc: UnauthorizedError
    ) -> JSONResponse:
        logger.info(f"Unauthorized: {request.url} - {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": exc.message},
        )

    @app.exception_handler(UserNotFoundSignupRequiredError)
    async def signup_required_handler(
        request: Request, exc: UserNotFoundSignupRequiredError
    ) -> JSONResponse:
        logger.info(f"User not found, signup required: {request.url}")
        content: dict[str, str] = {
            "detail": exc.message,
            "error_code": "USER_NOT_FOUND_SIGNUP_REQUIRED",
        }
        if exc.firebase_email is not None:
            content["firebase_email"] = exc.firebase_email
        if exc.firebase_name is not None:
            content["firebase_name"] = exc.firebase_name
        if exc.firebase_provider is not None:
            content["firebase_provider"] = exc.firebase_provider

        return JSONResponse(
            status_code=452,
            content=content,
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
        logger.warning(f"Forbidden: {request.url} - {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": exc.message},
        )

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
        logger.info(f"Conflict: {request.url} - {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": exc.message},
        )

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        logger.error(f"Application error: {request.url} - {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": exc.message},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(
        request: Request, exc: IntegrityError
    ) -> JSONResponse:
        logger.warning(f"Database integrity error: {request.url} - {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Database constraint violation"},
        )

    @app.exception_handler(DBAPIError)
    async def dbapi_error_handler(request: Request, exc: DBAPIError) -> JSONResponse:
        if "ConnectionDoesNotExistError" in str(exc) or "connection was closed" in str(
            exc
        ):
            logger.debug(f"Client disconnected during request: {request.url}")
            return JSONResponse(status_code=499, content={"detail": "Client Closed Request"})

        logger.exception(f"Database error during request to {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Database error"},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception(
            f"Unexpected error during request to {request.url}: {exc}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
```

## Registering Exception Handlers

```python
# backend/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager
from backend.middleware.error_handler import register_exception_handlers

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown

def create_application() -> FastAPI:
    app = FastAPI(
        title="YGS API",
        lifespan=lifespan,
    )

    # Register exception handlers (NOT middleware!)
    register_exception_handlers(app)

    # Register routers
    app.include_router(auth_router)
    app.include_router(user_router)
    app.include_router(admin_router)
    app.include_router(match_router)

    return app

app = create_application()
```

## Why NOT BaseHTTPMiddleware?

`BaseHTTPMiddleware` uses an internal streaming pattern that conflicts with
FastAPI's dependency injection lifecycle. When using SQLAlchemy async sessions:

```
# This causes IllegalStateChangeError:
# Method 'close()' can't be called here; method '_connection_for_bind()'
# is already in progress

class ErrorHandlerMiddleware(BaseHTTPMiddleware):  # DON'T DO THIS
    async def dispatch(self, request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            return JSONResponse(...)
```

The problem occurs because:
1. `call_next()` uses internal streams to process the request
2. When an exception occurs during dependency cleanup (session.close())
3. The middleware tries to handle it while the session is still in an intermediate state

**Solution**: Use `@app.exception_handler` decorators which integrate properly with
FastAPI's request lifecycle.

## FastAPI HTTPException (For Simple Cases)

For simple cases in routers, you can use HTTPException directly:

```python
from fastapi import HTTPException, status

@router.get("/{id}")
async def get_item(id: str):
    item = await get_item_from_db(id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    return item
```

However, **prefer domain exceptions** in services for consistency.

## Router-Level Exception Handling

```python
# backend/api/v1/routers/admin.py
from fastapi import APIRouter, HTTPException
from backend.error import NotFoundError, ForbiddenError

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.get("/members/{user_id}")
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
    except ForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e))
```

## Validation Errors (Pydantic)

Pydantic automatically handles validation and returns 422:

```python
from pydantic import BaseModel, field_validator
from backend.domain.user.enums import UserStatusEnum

class AdminBasicInfoUpdateRequest(BaseModel):
    status: Optional[str] = None

    model_config = {"extra": "forbid"}  # Reject unknown fields

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_values = [e.value for e in UserStatusEnum]
            if v not in valid_values:
                raise ValueError(f"Invalid status: {v}. Valid: {valid_values}")
        return v
```

When validation fails, FastAPI returns:
```json
{
  "detail": [
    {
      "loc": ["body", "status"],
      "msg": "Invalid status: xyz. Valid: ['pending', 'approved', 'rejected']",
      "type": "value_error"
    }
  ]
}
```

## Best Practices

1. **Exception handlers**: Use `@app.exception_handler` (NOT `BaseHTTPMiddleware`)
2. **Domain exceptions**: Use custom exceptions in services
3. **Specific errors**: NotFoundError, ValidationError, ConflictError, etc.
4. **HTTP mapping**: Handlers convert to HTTP responses
5. **Logging**: Log unexpected errors with context
6. **Consistent format**: Same error response structure
7. **Special exceptions**: Use UserNotFoundSignupRequiredError for OAuth flows
8. **Pydantic validation**: Let Pydantic handle DTO validation
9. **Extra forbid**: Use `model_config = {"extra": "forbid"}` to reject unknown fields
10. **Avoid middleware**: Never use `BaseHTTPMiddleware` with async DB sessions
