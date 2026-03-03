# Mocking & Fixtures

## Overview

Mocking and fixtures are essential for writing maintainable, fast, and isolated tests. This guide covers pytest fixtures, unittest.mock, and advanced mocking patterns for FastAPI applications.

## Pytest Fixtures

### Basic Fixtures

Fixtures provide reusable test data and setup:

```python
import pytest

@pytest.fixture
def sample_artist():
    """Fixture that provides a sample artist."""
    return Artist(
        id="test-id",
        name="Test Artist",
        bio="Test bio"
    )

# Use in test
def test_artist_name(sample_artist):
    assert sample_artist.name == "Test Artist"
```

### Fixture Scope

Control how long fixtures live:

```python
# Function scope (default) - new fixture for each test
@pytest.fixture
def function_fixture():
    print("Setup")
    yield "value"
    print("Teardown")

# Class scope - shared across test class
@pytest.fixture(scope="class")
def class_fixture():
    return "shared_value"

# Module scope - shared across module
@pytest.fixture(scope="module")
def module_fixture():
    return "module_value"

# Session scope - shared across entire test session
@pytest.fixture(scope="session")
def session_fixture():
    return "session_value"
```

### Fixture Teardown

Use `yield` for cleanup:

```python
@pytest.fixture
def database_connection():
    # Setup
    conn = create_connection()

    yield conn  # Provide to test

    # Teardown (runs after test)
    conn.close()

@pytest.fixture
async def async_session():
    # Async setup
    session = AsyncSession(engine)

    yield session

    # Async teardown
    await session.close()
```

### Fixture Dependencies

Fixtures can use other fixtures:

```python
@pytest.fixture
def mock_session():
    return AsyncMock(spec=AsyncSession)

@pytest.fixture
def mock_repository(mock_session):
    return ArtistRepository(mock_session)

@pytest.fixture
def artist_service(mock_session, mock_repository):
    service = ArtistService(mock_session)
    service._repository = mock_repository
    return service

# Use in test
@pytest.mark.asyncio
async def test_with_service(artist_service):
    result = await artist_service.get_artist("1")
    # Test using the fully configured service
```

---

## Fixture Organization

### conftest.py Structure

```python
# tests/conftest.py - Global fixtures
import pytest

@pytest.fixture
def mock_session():
    """Global mock session fixture."""
    return AsyncMock(spec=AsyncSession)

# tests/unit/domain/artist/conftest.py - Domain-specific fixtures
@pytest.fixture
def sample_artist():
    """Artist-specific fixture."""
    return Artist(id="1", name="Test")

@pytest.fixture
def sample_artist_dto():
    """Artist DTO fixture."""
    return ArtistRequestDto(name="Test", bio="Bio")
```

### Autouse Fixtures

Fixtures that run automatically:

```python
@pytest.fixture(autouse=True)
def setup_logging():
    """Runs before every test automatically."""
    import logging
    logging.basicConfig(level=logging.DEBUG)

@pytest.fixture(autouse=True)
async def reset_database():
    """Runs before every async test."""
    # Reset database state
    yield
    # Cleanup after test
```

---

## unittest.mock Basics

### MagicMock

For synchronous code:

```python
from unittest.mock import MagicMock

# Create mock
mock_obj = MagicMock()

# Configure return value
mock_obj.method.return_value = "result"

# Use it
result = mock_obj.method("arg")

# Verify
assert result == "result"
mock_obj.method.assert_called_once_with("arg")
```

### AsyncMock

For asynchronous code:

```python
from unittest.mock import AsyncMock

# Create async mock
mock_func = AsyncMock(return_value="result")

# Use it
result = await mock_func("arg")

# Verify
assert result == "result"
mock_func.assert_awaited_once_with("arg")
```

### Mock Configuration

```python
# Return value
mock.method.return_value = "value"

# Side effect (different values on each call)
mock.method.side_effect = ["first", "second", "third"]

# Raise exception
mock.method.side_effect = ValueError("error")

# Custom function
mock.method.side_effect = lambda x: x * 2
```

---

## Mocking Patterns

### Pattern 1: Mocking Database Session

```python
@pytest.fixture
def mock_db_session():
    """Mock SQLModel async session."""
    mock_session = AsyncMock(spec=AsyncSession)

    # Configure common methods
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.refresh = AsyncMock()

    # Properties
    mock_session.closed = False

    return mock_session

@pytest.mark.asyncio
async def test_with_mock_session(mock_db_session):
    repository = ArtistRepository(mock_db_session)

    # Configure execute to return result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = Artist(id="1")
    mock_db_session.execute.return_value = mock_result

    # Test
    result = await repository.get_by_id("1")

    assert result.id == "1"
    mock_db_session.execute.assert_awaited_once()
```

### Pattern 2: Mocking Repository

```python
@pytest.fixture
def mock_artist_repository():
    """Mock artist repository."""
    mock_repo = AsyncMock(spec=ArtistRepository)

    # Configure methods
    mock_repo.get_by_id = AsyncMock(return_value=None)
    mock_repo.find_all = AsyncMock(return_value=[])
    mock_repo.create = AsyncMock()
    mock_repo.update = AsyncMock()
    mock_repo.delete = AsyncMock()

    return mock_repo

@pytest.mark.asyncio
async def test_service_with_mock_repo(mock_artist_repository):
    # Configure specific behavior for this test
    artist = Artist(id="1", name="Test")
    mock_artist_repository.get_by_id.return_value = artist

    # Create service with mock
    service = ArtistService(mock_session)
    service._repository = mock_artist_repository

    # Test
    result = await service.get_artist("1")

    assert result.id == "1"
    mock_artist_repository.get_by_id.assert_awaited_once_with("1")
```

### Pattern 3: Mocking External Services

```python
@pytest.fixture
def mock_s3_client():
    """Mock boto3 S3 client."""
    mock_client = MagicMock()

    # Configure S3 operations
    mock_client.upload_file = MagicMock(return_value=None)
    mock_client.generate_presigned_url = MagicMock(
        return_value="https://example.com/presigned"
    )

    return mock_client

def test_upload_to_s3(mock_s3_client, mocker):
    # Patch boto3 to return our mock
    mocker.patch("boto3.client", return_value=mock_s3_client)

    # Test code that uses S3
    upload_file_to_s3("test.jpg", "bucket")

    # Verify
    mock_s3_client.upload_file.assert_called_once()
```

---

## Advanced Mocking with pytest-mock

### Using mocker Fixture

pytest-mock provides the `mocker` fixture for cleaner mocking:

```python
def test_with_mocker(mocker):
    # Patch a function
    mock_func = mocker.patch("backend.utils.helpers.some_function")
    mock_func.return_value = "mocked"

    # Use it
    result = some_function()

    assert result == "mocked"
    mock_func.assert_called_once()

@pytest.mark.asyncio
async def test_async_with_mocker(mocker):
    # Patch async function
    mock_func = mocker.patch(
        "backend.domain.artist.service.ArtistService.get_artist",
        new_callable=AsyncMock
    )
    mock_func.return_value = ArtistResponseDto(id="1", name="Test")

    # Test
    result = await service.get_artist("1")

    assert result.id == "1"
```

### Patching Objects

```python
def test_patch_object(mocker):
    # Patch a method on an object
    service = ArtistService(mock_session)

    mocker.patch.object(
        service._repository,
        "get_by_id",
        return_value=Artist(id="1")
    )

    # Test uses patched method
    result = service.get_artist("1")
```

### Patching Classes

```python
def test_patch_class(mocker):
    # Patch entire class
    MockRepository = mocker.patch(
        "backend.domain.artist.repository.ArtistRepository"
    )

    # Configure mock instance
    mock_instance = MockRepository.return_value
    mock_instance.get_by_id = AsyncMock(return_value=Artist(id="1"))

    # Code that creates ArtistRepository will get mock
    service = ArtistService(mock_session)  # Uses MockRepository

    # Verify
    MockRepository.assert_called_once()
```

---

## Mocking Database Results

### Mocking SQLModel Query Results

```python
@pytest.mark.asyncio
async def test_repository_query():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)

    # Create mock result
    mock_result = MagicMock()

    # For single result: scalar_one_or_none()
    mock_result.scalar_one_or_none.return_value = Artist(id="1", name="Test")

    # For multiple results: scalars().all()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [
        Artist(id="1", name="Artist 1"),
        Artist(id="2", name="Artist 2"),
    ]
    mock_result.scalars.return_value = mock_scalars

    # Configure session.execute to return mock result
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Act
    repository = ArtistRepository(mock_session)
    result = await repository.get_by_id("1")

    # Assert
    assert result.id == "1"
```

### Mocking Different Query Types

```python
# 1. Get single item
mock_result = MagicMock()
mock_result.scalar_one_or_none.return_value = artist
mock_session.execute.return_value = mock_result

# 2. Get all items
mock_result = MagicMock()
mock_scalars = MagicMock()
mock_scalars.all.return_value = [artist1, artist2]
mock_result.scalars.return_value = mock_scalars
mock_session.execute.return_value = mock_result

# 3. Get first item
mock_result = MagicMock()
mock_scalars = MagicMock()
mock_scalars.first.return_value = artist
mock_result.scalars.return_value = mock_scalars
mock_session.execute.return_value = mock_result

# 4. Count
mock_result = MagicMock()
mock_result.scalar.return_value = 42
mock_session.execute.return_value = mock_result
```

---

## Mock Assertions

### Verifying Calls

```python
# Called at all
mock.method.assert_called()

# Called once
mock.method.assert_called_once()

# Called with specific arguments
mock.method.assert_called_with("arg1", "arg2")
mock.method.assert_called_once_with("arg1", "arg2")

# Called with any arguments
mock.method.assert_called()

# Not called
mock.method.assert_not_called()

# Number of calls
assert mock.method.call_count == 3

# Async versions
await mock.async_method("arg")
mock.async_method.assert_awaited()
mock.async_method.assert_awaited_once()
mock.async_method.assert_awaited_with("arg")
```

### Inspecting Call Arguments

```python
# Get all calls
calls = mock.method.call_args_list

# Get most recent call
args, kwargs = mock.method.call_args
assert args == ("arg1",)
assert kwargs == {"key": "value"}

# Check specific call
mock.method.assert_any_call("arg1")
mock.method.assert_has_calls([
    call("first"),
    call("second"),
])
```

---

## Fixture Parameterization

### Testing Multiple Scenarios

```python
@pytest.fixture(params=[
    ("valid-name", True),
    ("", False),
    (None, False),
])
def name_scenario(request):
    name, is_valid = request.param
    return name, is_valid

def test_name_validation(name_scenario):
    name, is_valid = name_scenario

    if is_valid:
        artist = Artist(id="1", name=name)
        assert artist.name == name
    else:
        with pytest.raises(ValidationError):
            Artist(id="1", name=name)
```

### Parameterized Fixtures with IDs

```python
@pytest.fixture(
    params=[
        ("artist1", "bio1"),
        ("artist2", "bio2"),
    ],
    ids=["scenario-1", "scenario-2"]
)
def artist_data(request):
    name, bio = request.param
    return {"name": name, "bio": bio}

def test_with_named_scenarios(artist_data):
    # Test runs twice with descriptive IDs
    assert artist_data["name"]
```

---

## Mocking Best Practices

### 1. Mock at the Right Level

```python
# ✅ GOOD - Mock repository when testing service
@pytest.mark.asyncio
async def test_service():
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=artist)

    service = ArtistService(mock_session)
    service._repository = mock_repo  # Mock at boundary

    result = await service.get_artist("1")

# ❌ BAD - Mocking too deep
@pytest.mark.asyncio
async def test_service():
    mock_db = AsyncMock()  # Mocking database internals
    # Too coupled to implementation
```

### 2. Don't Mock What You're Testing

```python
# ❌ BAD - Mocking the service you're testing
def test_service():
    mock_service = AsyncMock()
    mock_service.get_artist = AsyncMock(return_value=artist)

    # You're testing the mock, not the service!
    result = await mock_service.get_artist("1")

# ✅ GOOD - Testing actual service, mocking dependencies
@pytest.mark.asyncio
async def test_service():
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=artist)

    service = ArtistService(mock_session)  # Real service
    service._repository = mock_repo  # Mock dependency

    result = await service.get_artist("1")
```

### 3. Use spec for Type Safety

```python
# ✅ GOOD - Using spec prevents invalid usage
mock_session = AsyncMock(spec=AsyncSession)
mock_session.nonexistent_method()  # Raises AttributeError

# ❌ BAD - Without spec, anything goes
mock_session = AsyncMock()
mock_session.nonexistent_method()  # Allowed, but wrong
```

### 4. Reset Mocks Between Tests

```python
@pytest.fixture
def mock_service():
    mock = AsyncMock()
    yield mock
    # Automatically reset between tests

# Or manually reset
def test_1(mock_service):
    await mock_service.method()
    mock_service.method.assert_awaited_once()

def test_2(mock_service):
    # mock_service is fresh, call count is 0
    await mock_service.method()
    mock_service.method.assert_awaited_once()
```

---

## Common Pitfalls

### 1. Forgetting to Configure Mock Returns

```python
# ❌ BAD - Mock returns MagicMock by default
mock_repo = AsyncMock()
result = await mock_repo.get_by_id("1")
# result is a MagicMock, not an Artist!

# ✅ GOOD - Configure return value
mock_repo = AsyncMock()
mock_repo.get_by_id = AsyncMock(return_value=Artist(id="1"))
result = await mock_repo.get_by_id("1")
# result is an Artist
```

### 2. Not Awaiting AsyncMock

```python
# ❌ BAD - Missing await
mock_func = AsyncMock(return_value="result")
result = mock_func()  # Returns coroutine!

# ✅ GOOD - With await
result = await mock_func()  # Returns "result"
```

### 3. Mocking in Wrong Place

```python
# File: backend/domain/artist/service.py
from backend.domain.artist.repository import ArtistRepository

class ArtistService:
    def __init__(self):
        self.repo = ArtistRepository()

# ❌ BAD - Patching where it's defined
mocker.patch("backend.domain.artist.repository.ArtistRepository")

# ✅ GOOD - Patch where it's used
mocker.patch("backend.domain.artist.service.ArtistRepository")
```

---

## Summary Checklist

When using mocks and fixtures:

- [ ] Use fixtures for reusable test data
- [ ] Organize fixtures in conftest.py
- [ ] Use appropriate fixture scope
- [ ] Mock at layer boundaries
- [ ] Use AsyncMock for async functions
- [ ] Use spec parameter for type safety
- [ ] Configure mock return values explicitly
- [ ] Verify mock calls with assert_* methods
- [ ] Don't mock what you're testing
- [ ] Reset mocks between tests
- [ ] Use pytest-mock for cleaner patching

---

## Related Resources

- [unit-testing.md](unit-testing.md) - Unit testing patterns
- [async-testing.md](async-testing.md) - Async-specific mocking
- [testing-architecture.md](testing-architecture.md) - Overall testing strategy
