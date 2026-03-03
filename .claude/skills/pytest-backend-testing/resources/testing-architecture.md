# Testing Architecture

## Overview

Testing architecture for FastAPI backend follows the same layered approach as the application itself: Repository → Service → Router. Each layer has specific testing concerns and strategies.

## Three-Layer Testing Strategy

### 1. Repository Layer Testing

**What to Test:**
- Database queries (SELECT, INSERT, UPDATE, DELETE)
- Filtering and sorting logic
- Complex joins and relationships
- Transaction handling
- Error handling (unique constraints, foreign keys)

**Testing Approach:**
- Mock the AsyncSession
- Verify SQL query construction
- Test query results mapping
- Focus on data access logic

**Example:**
```python
@pytest.mark.asyncio
async def test_artist_repository_find_by_name():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = Artist(
        id="1", name="Test Artist"
    )
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)

    # Act
    result = await repository.find_by_name("Test Artist")

    # Assert
    assert result is not None
    assert result.name == "Test Artist"
    mock_session.execute.assert_awaited_once()
```

---

### 2. Service Layer Testing

**What to Test:**
- Business logic and domain rules
- Service orchestration (calling multiple repositories)
- Data transformation (model to DTO conversion)
- Error handling and validation
- Transaction management

**Testing Approach:**
- Mock repository dependencies
- Focus on business logic, not database
- Test multiple scenarios and edge cases
- Verify DTO creation

**Example:**
```python
@pytest.mark.asyncio
async def test_artist_service_create_with_duplicate_name():
    # Arrange
    mock_session = AsyncMock()
    mock_repo = AsyncMock()
    mock_repo.find_by_name = AsyncMock(return_value=existing_artist)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act & Assert
    with pytest.raises(ConflictError, match="Artist already exists"):
        await service.create_artist(ArtistRequestDto(name="Existing"))
```

---

### 3. Router Layer Testing

**What to Test:**
- HTTP request/response handling
- Request validation (Pydantic)
- Response serialization
- Authentication/authorization
- HTTP status codes
- Error response formatting

**Testing Approach:**
- Use FastAPI TestClient
- Mock service dependencies
- Test complete request/response cycle
- Verify API contracts

**Example:**
```python
def test_create_artist_endpoint_success(client, mocker):
    # Arrange
    mock_service = mocker.patch("backend.api.v1.routers.artist.ArtistService")
    mock_service.return_value.create_artist = AsyncMock(
        return_value=ArtistResponseDto(id="1", name="Test")
    )

    # Act
    response = client.post(
        "/api/v1/artists",
        json={"name": "Test", "bio": "Bio"}
    )

    # Assert
    assert response.status_code == 201
    assert response.json()["name"] == "Test"
```

---

## Test Isolation Principles

### 1. Independent Tests

Each test should run independently without relying on other tests:

```python
# ✅ GOOD - Each test is independent
@pytest.mark.asyncio
async def test_create_artist():
    artist = await service.create_artist(data)
    assert artist.id is not None

@pytest.mark.asyncio
async def test_get_artist():
    # Create artist specifically for this test
    artist = await service.create_artist(data)
    result = await service.get_artist(artist.id)
    assert result.id == artist.id

# ❌ BAD - Tests depend on execution order
artist_id = None

@pytest.mark.asyncio
async def test_create_artist():
    global artist_id
    artist = await service.create_artist(data)
    artist_id = artist.id  # Shared state!

@pytest.mark.asyncio
async def test_get_artist():
    global artist_id
    result = await service.get_artist(artist_id)  # Depends on previous test!
```

### 2. Mock at Layer Boundaries

Mock dependencies at the boundary between layers:

```python
# Testing Service Layer
@pytest.mark.asyncio
async def test_service_logic():
    # Mock the repository (layer below)
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=artist)

    service = ArtistService(mock_session)
    service._repository = mock_repo  # Inject mock

    # Test service logic in isolation
    result = await service.get_artist("id")
    assert result is not None
```

### 3. Use Fixtures for Reusable Setup

Create fixtures for common test setup:

```python
@pytest.fixture
def sample_artist():
    return Artist(id="1", name="Test", bio="Bio")

@pytest.fixture
def mock_artist_repository(sample_artist):
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=sample_artist)
    mock_repo.create = AsyncMock(return_value=sample_artist)
    return mock_repo

# Use in tests
@pytest.mark.asyncio
async def test_with_fixtures(mock_artist_repository, sample_artist):
    service = ArtistService(mock_session)
    service._repository = mock_artist_repository

    result = await service.get_artist("1")
    assert result.id == sample_artist.id
```

---

## Test Organization

### Directory Structure

```
tests/
  conftest.py                # Global fixtures
  unit/                      # Unit tests (isolated)
    domain/
      artist/
        test_artist_model.py
        test_artist_repository.py
        test_artist_service.py
      artwork/
      auth/
    middleware/
      test_error_handler.py
    utils/
      test_helpers.py

  integration/               # Integration tests (multiple layers)
    test_artist_api.py       # Full API flow tests
    test_auth_flow.py
    test_artwork_creation.py
```

### Test File Naming

- **Unit tests**: `test_{module_name}.py`
- **Integration tests**: `test_{feature}_api.py` or `test_{feature}_flow.py`
- **Test functions**: `test_{what}_{when}_{expected}`

### Test Class Organization

Group related tests using classes:

```python
class TestArtistRepository:
    """Tests for ArtistRepository."""

    @pytest.mark.asyncio
    async def test_get_by_id_success(self):
        """Test successful retrieval."""
        pass

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self):
        """Test when artist not found."""
        pass

    @pytest.mark.asyncio
    async def test_create_artist_success(self):
        """Test successful creation."""
        pass

class TestArtistService:
    """Tests for ArtistService."""
    pass
```

---

## Test Data Management

### 1. Use Factories or Builders

Create helpers for test data:

```python
def create_artist(
    id: str = "test-id",
    name: str = "Test Artist",
    bio: str | None = None
) -> Artist:
    """Factory function for creating test artists."""
    return Artist(id=id, name=name, bio=bio)

# Use in tests
def test_something():
    artist = create_artist(name="Custom Name")
    assert artist.name == "Custom Name"
```

### 2. Fixture Parameterization

Test multiple scenarios with parameterized fixtures:

```python
@pytest.fixture(params=[
    ("valid-name", True),
    ("", False),
    ("a" * 256, False),  # Too long
])
def artist_name_scenario(request):
    name, is_valid = request.param
    return name, is_valid

def test_artist_name_validation(artist_name_scenario):
    name, is_valid = artist_name_scenario
    if is_valid:
        artist = Artist(id="1", name=name)
        assert artist.name == name
    else:
        with pytest.raises(ValidationError):
            Artist(id="1", name=name)
```

---

## Database Testing Strategies

### Strategy 1: Mock Everything (Unit Tests)

```python
@pytest.mark.asyncio
async def test_repository_with_mocks():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = artist
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)
    result = await repository.get_by_id("id")
    assert result is not None
```

**Pros:**
- Fast execution
- No database setup needed
- Isolated from database changes

**Cons:**
- Doesn't test actual SQL
- May not catch database-specific issues

### Strategy 2: In-Memory Database (Integration Tests)

```python
@pytest.fixture
async def test_db_session():
    """Create in-memory SQLite database for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=True
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with AsyncSession(engine) as session:
        yield session

    await engine.dispose()

@pytest.mark.asyncio
async def test_with_real_database(test_db_session):
    repository = ArtistRepository(test_db_session)
    artist = await repository.create(Artist(id="1", name="Test"))

    result = await repository.get_by_id("1")
    assert result.id == "1"
```

**Pros:**
- Tests actual database operations
- Catches SQL errors
- Verifies relationships and constraints

**Cons:**
- Slower than mocks
- SQLite may differ from PostgreSQL
- Requires cleanup between tests

### Strategy 3: Transaction Rollback (Cleanup)

```python
@pytest.fixture
async def db_session_with_rollback(test_db_session):
    """Session that rolls back after test."""
    async with test_db_session.begin():
        yield test_db_session
        await test_db_session.rollback()
```

---

## Common Patterns

### Pattern: Testing Error Handling

```python
@pytest.mark.asyncio
async def test_service_handles_not_found():
    # Arrange
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=None)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act & Assert
    with pytest.raises(NotFoundError, match="Artist not found"):
        await service.get_artist("nonexistent-id")
```

### Pattern: Testing Validation

```python
def test_request_dto_validation():
    # Valid data
    dto = ArtistRequestDto(name="Valid Name", bio="Bio")
    assert dto.name == "Valid Name"

    # Invalid data - empty name
    with pytest.raises(ValidationError):
        ArtistRequestDto(name="", bio="Bio")

    # Invalid data - name too long
    with pytest.raises(ValidationError):
        ArtistRequestDto(name="a" * 256, bio="Bio")
```

### Pattern: Testing Async Context Managers

```python
@pytest.mark.asyncio
async def test_transaction_manager():
    mock_session = AsyncMock()

    async with transaction_manager(mock_session):
        # Do something
        pass

    # Verify commit was called
    mock_session.commit.assert_awaited_once()
```

---

## Best Practices Summary

1. **Test Each Layer Independently**: Mock dependencies, focus on layer-specific logic
2. **Use Descriptive Names**: Test names should explain what, when, and expected outcome
3. **Follow AAA Pattern**: Arrange, Act, Assert for clear test structure
4. **Mock at Boundaries**: Mock the layer directly below what you're testing
5. **Keep Tests Fast**: Unit tests should run in milliseconds
6. **Test Error Paths**: Don't just test happy paths
7. **Use Fixtures**: Reuse common setup with pytest fixtures
8. **Maintain Isolation**: Each test should be independent
9. **Organize Logically**: Group related tests, use clear directory structure
10. **Focus on Coverage**: Aim for 80%+ but prioritize critical business logic

---

## Related Resources

- [unit-testing.md](unit-testing.md) - Detailed unit testing patterns
- [integration-testing.md](integration-testing.md) - Integration test strategies
- [mocking-fixtures.md](mocking-fixtures.md) - Advanced mocking and fixtures
