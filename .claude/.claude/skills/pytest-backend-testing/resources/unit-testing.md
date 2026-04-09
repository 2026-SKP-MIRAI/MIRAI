# Unit Testing

## Overview

Unit tests focus on testing individual functions, methods, or classes in isolation. They should be fast, independent, and test a single unit of functionality.

## Unit Test Characteristics

### Fast
- Execute in milliseconds
- No database connections
- No network calls
- No file I/O

### Isolated
- Test one thing at a time
- Mock all dependencies
- No shared state between tests
- Independent of test execution order

### Focused
- Test single responsibility
- Clear arrange-act-assert structure
- One assertion concept per test

---

## AAA Pattern (Arrange-Act-Assert)

### Structure

Every unit test should follow the AAA pattern:

```python
@pytest.mark.asyncio
async def test_create_artist_success():
    # Arrange - Set up test data and mocks
    mock_session = AsyncMock(spec=AsyncSession)
    mock_repo = AsyncMock()
    mock_repo.create = AsyncMock(return_value=artist_model)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    request_dto = ArtistRequestDto(name="Test", bio="Bio")

    # Act - Execute the code under test
    result = await service.create_artist(request_dto)

    # Assert - Verify the outcome
    assert result.name == "Test"
    assert result.bio == "Bio"
    mock_repo.create.assert_awaited_once()
```

### Benefits
- **Readability**: Clear structure makes tests easy to understand
- **Maintainability**: Easy to modify and debug
- **Documentation**: Tests serve as usage examples

---

## Testing Repository Layer

### Basic Repository Test

```python
from unittest.mock import AsyncMock, MagicMock
from sqlmodel.ext.asyncio.session import AsyncSession

@pytest.mark.asyncio
async def test_get_by_id_returns_artist():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    expected_artist = Artist(id="test-id", name="Test Artist")

    # Mock the execute result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = expected_artist
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)

    # Act
    result = await repository.get_by_id("test-id")

    # Assert
    assert result is not None
    assert result.id == "test-id"
    assert result.name == "Test Artist"
    mock_session.execute.assert_awaited_once()
```

### Testing Query Construction

```python
@pytest.mark.asyncio
async def test_find_by_name_constructs_correct_query():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)

    # Act
    await repository.find_by_name("Test Artist")

    # Assert
    # Verify execute was called with a select statement
    mock_session.execute.assert_awaited_once()
    call_args = mock_session.execute.call_args[0][0]
    # You can verify the query structure here
    assert str(call_args).lower().__contains__("select")
```

### Testing Error Cases

```python
@pytest.mark.asyncio
async def test_get_by_id_returns_none_when_not_found():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)

    # Act
    result = await repository.get_by_id("nonexistent-id")

    # Assert
    assert result is None
```

---

## Testing Service Layer

### Basic Service Test

```python
@pytest.mark.asyncio
async def test_get_artist_success():
    # Arrange
    mock_session = AsyncMock()
    mock_repo = AsyncMock()

    artist_model = Artist(id="1", name="Test", bio="Bio")
    mock_repo.get_by_id = AsyncMock(return_value=artist_model)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act
    result = await service.get_artist("1")

    # Assert
    assert result.id == "1"
    assert result.name == "Test"
    mock_repo.get_by_id.assert_awaited_once_with("1")
```

### Testing Business Logic

```python
@pytest.mark.asyncio
async def test_create_artist_validates_unique_name():
    # Arrange
    mock_session = AsyncMock()
    mock_repo = AsyncMock()

    # Simulate existing artist with same name
    existing_artist = Artist(id="existing", name="Existing Artist")
    mock_repo.find_by_name = AsyncMock(return_value=existing_artist)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    request_dto = ArtistRequestDto(name="Existing Artist", bio="Bio")

    # Act & Assert
    with pytest.raises(ConflictError, match="Artist.*already exists"):
        await service.create_artist(request_dto)

    # Verify create was NOT called
    mock_repo.create.assert_not_awaited()
```

### Testing Data Transformation

```python
@pytest.mark.asyncio
async def test_get_artist_returns_dto():
    # Arrange
    mock_session = AsyncMock()
    mock_repo = AsyncMock()

    artist_model = Artist(id="1", name="Test", bio="Bio")
    mock_repo.get_by_id = AsyncMock(return_value=artist_model)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act
    result = await service.get_artist("1")

    # Assert
    # Verify it's a DTO, not the model
    from backend.dtos.artist import ArtistResponseDto
    assert isinstance(result, ArtistResponseDto)
    assert result.id == artist_model.id
    assert result.name == artist_model.name
```

### Testing Error Handling

```python
@pytest.mark.asyncio
async def test_get_artist_raises_not_found_error():
    # Arrange
    mock_session = AsyncMock()
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=None)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act & Assert
    with pytest.raises(NotFoundError) as exc_info:
        await service.get_artist("nonexistent")

    assert "not found" in str(exc_info.value).lower()
```

---

## Testing Models and DTOs

### Testing Model Creation

```python
def test_artist_model_creation():
    # Act
    artist = Artist(
        id="test-id",
        name="Test Artist",
        bio="Test bio"
    )

    # Assert
    assert artist.id == "test-id"
    assert artist.name == "Test Artist"
    assert artist.bio == "Test bio"
```

### Testing DTO Validation

```python
from pydantic import ValidationError

def test_artist_request_dto_validates_name():
    # Valid name
    dto = ArtistRequestDto(name="Valid Name", bio="Bio")
    assert dto.name == "Valid Name"

    # Empty name should fail
    with pytest.raises(ValidationError) as exc_info:
        ArtistRequestDto(name="", bio="Bio")

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("name",) for e in errors)

def test_artist_request_dto_validates_name_length():
    # Name too long (> 255 chars)
    long_name = "a" * 256

    with pytest.raises(ValidationError) as exc_info:
        ArtistRequestDto(name=long_name, bio="Bio")

    errors = exc_info.value.errors()
    assert any("max_length" in str(e) for e in errors)
```

### Testing Custom Validators

```python
def test_artist_dto_custom_validator():
    # Arrange
    class ArtistDto(BaseModel):
        name: str

        @field_validator('name')
        def name_must_not_be_whitespace(cls, v):
            if not v.strip():
                raise ValueError('Name cannot be only whitespace')
            return v.strip()

    # Valid name
    dto = ArtistDto(name="  Test  ")
    assert dto.name == "Test"  # Trimmed

    # Only whitespace should fail
    with pytest.raises(ValidationError):
        ArtistDto(name="   ")
```

---

## Testing Utility Functions

### Pure Functions

```python
from backend.utils.slug import create_slug

def test_create_slug_converts_to_lowercase():
    assert create_slug("Hello World") == "hello-world"

def test_create_slug_replaces_spaces():
    assert create_slug("Hello   World") == "hello-world"

def test_create_slug_removes_special_chars():
    assert create_slug("Hello@World!") == "helloworld"

def test_create_slug_handles_unicode():
    assert create_slug("Café") == "cafe"
```

### Functions with Side Effects

```python
from unittest.mock import patch, mock_open

def test_write_file():
    # Arrange
    mock_file = mock_open()

    # Act
    with patch("builtins.open", mock_file):
        write_data_to_file("test.txt", "data")

    # Assert
    mock_file.assert_called_once_with("test.txt", "w")
    mock_file().write.assert_called_once_with("data")
```

---

## Test Organization Patterns

### Using Test Classes

Group related tests with classes:

```python
class TestArtistRepository:
    """Test suite for ArtistRepository."""

    @pytest.fixture
    def mock_session(self):
        """Fixture for mocked session, reused by all tests."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def repository(self, mock_session):
        """Fixture for repository instance."""
        return ArtistRepository(mock_session)

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, repository, mock_session):
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = Artist(id="1")
        mock_session.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await repository.get_by_id("1")

        # Assert
        assert result.id == "1"

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, repository, mock_session):
        # Similar test...
        pass
```

### Parametrized Tests

Test multiple scenarios with one test function:

```python
@pytest.mark.parametrize("input_name,expected_slug", [
    ("Hello World", "hello-world"),
    ("UPPERCASE", "uppercase"),
    ("special@chars!", "specialchars"),
    ("  spaces  ", "spaces"),
])
def test_create_slug_various_inputs(input_name, expected_slug):
    assert create_slug(input_name) == expected_slug
```

### Shared Fixtures

Create reusable fixtures in conftest.py:

```python
# conftest.py
import pytest

@pytest.fixture
def sample_artist():
    return Artist(id="test-id", name="Test Artist", bio="Bio")

@pytest.fixture
def sample_artist_dto():
    return ArtistRequestDto(name="Test Artist", bio="Bio")

# test_artist_service.py
def test_with_shared_fixture(sample_artist):
    assert sample_artist.name == "Test Artist"
```

---

## Common Mocking Patterns

### Mocking Async Functions

```python
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_async_function():
    # Create async mock
    mock_func = AsyncMock(return_value="result")

    # Call it
    result = await mock_func("arg")

    # Assert
    assert result == "result"
    mock_func.assert_awaited_once_with("arg")
```

### Mocking Classes

```python
from unittest.mock import MagicMock

def test_mock_class():
    # Mock the class
    MockClass = MagicMock()
    mock_instance = MockClass.return_value

    # Configure mock instance
    mock_instance.method.return_value = "result"

    # Use it
    instance = MockClass()
    result = instance.method("arg")

    # Assert
    assert result == "result"
    mock_instance.method.assert_called_once_with("arg")
```

### Mocking Attributes

```python
def test_mock_attributes():
    # Create mock with attributes
    mock_obj = MagicMock()
    mock_obj.attribute = "value"
    mock_obj.method.return_value = "result"

    # Use it
    assert mock_obj.attribute == "value"
    assert mock_obj.method() == "result"
```

---

## Best Practices

### 1. One Assertion Concept Per Test

```python
# ✅ GOOD - Tests one thing
def test_create_slug_converts_to_lowercase():
    assert create_slug("HELLO") == "hello"

def test_create_slug_replaces_spaces():
    assert create_slug("hello world") == "hello-world"

# ❌ BAD - Tests multiple things
def test_create_slug():
    assert create_slug("HELLO") == "hello"
    assert create_slug("hello world") == "hello-world"
    assert create_slug("hello@world") == "helloworld"
```

### 2. Descriptive Test Names

```python
# ✅ GOOD - Clear what, when, expected
def test_get_artist_when_not_found_raises_not_found_error():
    pass

def test_create_artist_with_duplicate_name_raises_conflict_error():
    pass

# ❌ BAD - Vague
def test_get_artist():
    pass

def test_error():
    pass
```

### 3. Don't Test Implementation Details

```python
# ✅ GOOD - Tests behavior
@pytest.mark.asyncio
async def test_create_artist_saves_to_database():
    # Act
    result = await service.create_artist(dto)

    # Assert - Verify it was saved (behavior)
    mock_repo.create.assert_awaited_once()
    assert result.id is not None

# ❌ BAD - Tests implementation
@pytest.mark.asyncio
async def test_create_artist_calls_repository_create_method():
    # Too focused on how it's done, not what it does
    pass
```

### 4. Test Error Cases

```python
# Always test both success and failure
@pytest.mark.asyncio
async def test_get_artist_success():
    mock_repo.get_by_id = AsyncMock(return_value=artist)
    result = await service.get_artist("1")
    assert result is not None

@pytest.mark.asyncio
async def test_get_artist_not_found():
    mock_repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(NotFoundError):
        await service.get_artist("nonexistent")
```

### 5. Keep Tests Simple

```python
# ✅ GOOD - Simple and clear
@pytest.mark.asyncio
async def test_create_artist():
    mock_repo.create = AsyncMock(return_value=artist)
    result = await service.create_artist(dto)
    assert result.name == dto.name

# ❌ BAD - Too complex
@pytest.mark.asyncio
async def test_create_artist_complex():
    # Too much setup, multiple operations, unclear what's being tested
    for i in range(10):
        dto = create_dto(f"Artist {i}")
        result = await service.create_artist(dto)
        if i % 2 == 0:
            assert result.name.startswith("Artist")
        # ... more complex logic
```

---

## Common Pitfalls

### 1. Not Isolating Tests

```python
# ❌ BAD - Shared state between tests
global_artist = None

def test_create():
    global global_artist
    global_artist = create_artist()

def test_get():
    # Depends on test_create running first!
    assert global_artist is not None
```

### 2. Testing Too Much

```python
# ❌ BAD - Testing framework code, not your code
def test_pydantic_validation():
    # Don't test that Pydantic validates - test YOUR validation logic
    with pytest.raises(ValidationError):
        ArtistDto(name=None)  # Pydantic handles this, not your code
```

### 3. Mocking What You're Testing

```python
# ❌ BAD - Mocking the thing you're testing
def test_service():
    mock_service = AsyncMock()
    mock_service.get_artist = AsyncMock(return_value=artist)

    # You're testing the mock, not the actual service!
    result = await mock_service.get_artist("1")
    assert result == artist
```

---

## Summary Checklist

When writing unit tests:

- [ ] Test one unit of functionality
- [ ] Mock all external dependencies
- [ ] Follow AAA pattern
- [ ] Use descriptive test names
- [ ] Test both success and error cases
- [ ] Keep tests simple and focused
- [ ] Ensure tests are fast (<100ms)
- [ ] Make tests independent
- [ ] Don't test implementation details
- [ ] Use fixtures for reusable setup

---

## Related Resources

- [testing-architecture.md](testing-architecture.md) - Overall testing strategy
- [mocking-fixtures.md](mocking-fixtures.md) - Advanced mocking techniques
- [async-testing.md](async-testing.md) - Async-specific patterns
