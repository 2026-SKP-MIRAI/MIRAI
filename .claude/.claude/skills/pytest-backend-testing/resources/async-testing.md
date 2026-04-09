# Async Testing

## Overview

FastAPI and SQLModel use async/await extensively. Testing async code requires special considerations and tools, primarily pytest-asyncio.

## pytest-asyncio Setup

### Configuration

Your project already has pytest-asyncio configured in `conftest.py`:

```python
# conftest.py
import pytest

# Configure pytest-asyncio to auto mode
pytest_plugins = ("pytest_asyncio",)
```

### Auto Mode

With auto mode enabled, pytest-asyncio automatically handles async test functions. You still need to mark them with `@pytest.mark.asyncio`:

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result == expected
```

---

## Testing Async Functions

### Basic Async Test

```python
import pytest

@pytest.mark.asyncio
async def test_get_artist_by_id():
    # Arrange
    artist_id = "test-id"

    # Act
    result = await artist_service.get_artist(artist_id)

    # Assert
    assert result.id == artist_id
```

### Testing Async with AsyncMock

```python
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_repository_get_by_id():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = Artist(id="1")
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)

    # Act
    result = await repository.get_by_id("1")

    # Assert
    assert result.id == "1"
    mock_session.execute.assert_awaited_once()
```

---

## AsyncMock vs MagicMock

### When to Use Each

```python
# Use AsyncMock for async functions/methods
async_func = AsyncMock(return_value="result")
result = await async_func()

# Use MagicMock for sync properties/attributes
mock_obj = MagicMock()
mock_obj.property = "value"
value = mock_obj.property  # No await

# Combine them for complex objects
mock_session = AsyncMock(spec=AsyncSession)
mock_session.execute = AsyncMock(return_value=mock_result)  # Async method
mock_session.closed = False  # Sync property
```

### Common Async Patterns

```python
from unittest.mock import AsyncMock

# 1. Simple async function
mock_func = AsyncMock(return_value="result")
result = await mock_func()
assert result == "result"

# 2. Async function that raises
mock_func = AsyncMock(side_effect=ValueError("error"))
with pytest.raises(ValueError):
    await mock_func()

# 3. Async function with multiple calls
mock_func = AsyncMock(side_effect=["first", "second", "third"])
assert await mock_func() == "first"
assert await mock_func() == "second"
assert await mock_func() == "third"

# 4. Verify it was awaited
mock_func = AsyncMock()
await mock_func("arg1", "arg2")
mock_func.assert_awaited_once_with("arg1", "arg2")
```

---

## Testing Async Context Managers

### Basic Context Manager Test

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db_session():
    session = AsyncSession(engine)
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

@pytest.mark.asyncio
async def test_db_session_context_manager():
    # Act
    async with get_db_session() as session:
        # Use session
        assert session is not None
        # Session should not be closed here
        assert not session.closed

    # Session should be closed after exiting context
    # (This depends on your implementation)
```

### Mocking Async Context Managers

```python
from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_with_mocked_context_manager():
    # Create mock that supports async context manager
    mock_session = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    # Use it
    async with mock_session as session:
        await session.execute("query")

    # Verify
    mock_session.__aenter__.assert_awaited_once()
    mock_session.__aexit__.assert_awaited_once()
```

---

## Testing Async Database Operations

### Mocking SQLModel Queries

```python
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

@pytest.mark.asyncio
async def test_repository_find_all():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)

    # Mock query results
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [
        Artist(id="1", name="Artist 1"),
        Artist(id="2", name="Artist 2"),
    ]
    mock_session.execute = AsyncMock(return_value=mock_result)

    repository = ArtistRepository(mock_session)

    # Act
    results = await repository.find_all()

    # Assert
    assert len(results) == 2
    assert results[0].id == "1"
    assert results[1].id == "2"
    mock_session.execute.assert_awaited_once()
```

### Testing Transaction Management

```python
@pytest.mark.asyncio
async def test_service_transaction_commit():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()

    mock_repo = AsyncMock()
    mock_repo.create = AsyncMock(return_value=artist)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act
    await service.create_artist(dto)

    # Assert - Verify commit was called
    mock_session.commit.assert_awaited_once()
    mock_session.rollback.assert_not_awaited()

@pytest.mark.asyncio
async def test_service_transaction_rollback_on_error():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()

    mock_repo = AsyncMock()
    mock_repo.create = AsyncMock(side_effect=Exception("DB Error"))

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act & Assert
    with pytest.raises(Exception):
        await service.create_artist(dto)

    # Verify rollback was called
    mock_session.rollback.assert_awaited_once()
    mock_session.commit.assert_not_awaited()
```

---

## Testing Concurrent Async Operations

### Testing Multiple Async Calls

```python
import asyncio

@pytest.mark.asyncio
async def test_concurrent_artist_creation():
    # Arrange
    mock_session = AsyncMock()
    mock_repo = AsyncMock()
    mock_repo.create = AsyncMock(side_effect=lambda x: x)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act - Create multiple artists concurrently
    artists = [
        ArtistRequestDto(name=f"Artist {i}", bio=f"Bio {i}")
        for i in range(5)
    ]

    results = await asyncio.gather(*[
        service.create_artist(artist) for artist in artists
    ])

    # Assert
    assert len(results) == 5
    assert mock_repo.create.await_count == 5
```

### Testing asyncio.gather

```python
@pytest.mark.asyncio
async def test_gather_multiple_queries():
    # Arrange
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(side_effect=[
        Artist(id="1", name="Artist 1"),
        Artist(id="2", name="Artist 2"),
        Artist(id="3", name="Artist 3"),
    ])

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act
    results = await asyncio.gather(
        service.get_artist("1"),
        service.get_artist("2"),
        service.get_artist("3"),
    )

    # Assert
    assert len(results) == 3
    assert results[0].id == "1"
    assert results[1].id == "2"
    assert results[2].id == "3"
```

---

## Testing Async Generators

### Basic Async Generator Test

```python
async def fetch_artists_stream():
    """Async generator that yields artists."""
    for i in range(5):
        await asyncio.sleep(0)  # Simulate async operation
        yield Artist(id=str(i), name=f"Artist {i}")

@pytest.mark.asyncio
async def test_async_generator():
    # Act
    artists = []
    async for artist in fetch_artists_stream():
        artists.append(artist)

    # Assert
    assert len(artists) == 5
    assert artists[0].id == "0"
    assert artists[4].id == "4"
```

### Mocking Async Generators

```python
from unittest.mock import AsyncMock

async def mock_async_generator():
    """Helper to create mock async generator."""
    yield Artist(id="1", name="Artist 1")
    yield Artist(id="2", name="Artist 2")

@pytest.mark.asyncio
async def test_with_mocked_async_generator():
    # Arrange
    mock_stream = mock_async_generator()

    # Act
    artists = []
    async for artist in mock_stream:
        artists.append(artist)

    # Assert
    assert len(artists) == 2
```

---

## Testing Async Timeouts

### Testing with asyncio.timeout

```python
@pytest.mark.asyncio
async def test_operation_completes_within_timeout():
    # Arrange
    async def slow_operation():
        await asyncio.sleep(0.1)
        return "result"

    # Act & Assert - Should complete within 1 second
    async with asyncio.timeout(1.0):
        result = await slow_operation()
        assert result == "result"

@pytest.mark.asyncio
async def test_operation_times_out():
    # Arrange
    async def very_slow_operation():
        await asyncio.sleep(10)
        return "result"

    # Act & Assert - Should timeout
    with pytest.raises(asyncio.TimeoutError):
        async with asyncio.timeout(0.1):
            await very_slow_operation()
```

---

## Common Async Testing Patterns

### Pattern 1: Testing Async Retry Logic

```python
@pytest.mark.asyncio
async def test_retry_on_failure():
    # Arrange
    mock_func = AsyncMock(
        side_effect=[
            Exception("First failure"),
            Exception("Second failure"),
            "success"  # Third attempt succeeds
        ]
    )

    # Retry logic
    async def retry_operation(max_retries=3):
        for attempt in range(max_retries):
            try:
                return await mock_func()
            except Exception:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(0.1)

    # Act
    result = await retry_operation()

    # Assert
    assert result == "success"
    assert mock_func.await_count == 3
```

### Pattern 2: Testing Async Caching

```python
@pytest.mark.asyncio
async def test_cached_result_not_refetched():
    # Arrange
    call_count = 0

    async def expensive_operation():
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.1)
        return "result"

    cache = {}

    async def get_with_cache(key):
        if key not in cache:
            cache[key] = await expensive_operation()
        return cache[key]

    # Act
    result1 = await get_with_cache("key1")
    result2 = await get_with_cache("key1")  # Should use cache

    # Assert
    assert result1 == "result"
    assert result2 == "result"
    assert call_count == 1  # Only called once
```

### Pattern 3: Testing Async Event Handling

```python
@pytest.mark.asyncio
async def test_event_handler():
    # Arrange
    events = []

    async def event_handler(event):
        events.append(event)
        await asyncio.sleep(0)  # Simulate async processing

    # Act
    await event_handler({"type": "create", "id": "1"})
    await event_handler({"type": "update", "id": "2"})

    # Assert
    assert len(events) == 2
    assert events[0]["type"] == "create"
    assert events[1]["type"] == "update"
```

---

## Debugging Async Tests

### Common Issues

**1. Forgot @pytest.mark.asyncio:**
```python
# ❌ BAD - Missing decorator
async def test_async_function():
    result = await some_async_function()
    assert result == expected
# Error: coroutine was never awaited

# ✅ GOOD - With decorator
@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result == expected
```

**2. Using MagicMock instead of AsyncMock:**
```python
# ❌ BAD - MagicMock for async function
mock_func = MagicMock(return_value="result")
result = await mock_func()  # Error!

# ✅ GOOD - AsyncMock for async function
mock_func = AsyncMock(return_value="result")
result = await mock_func()
```

**3. Not awaiting async calls:**
```python
# ❌ BAD - Missing await
result = mock_func()  # Returns coroutine, not result

# ✅ GOOD - With await
result = await mock_func()
```

### Debug Tips

```python
# Print async operation timing
import time

@pytest.mark.asyncio
async def test_with_timing():
    start = time.time()

    result = await some_async_operation()

    duration = time.time() - start
    print(f"Operation took {duration:.2f}s")

    assert result == expected
```

---

## Async Test Fixtures

### Creating Async Fixtures

```python
import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

@pytest.fixture
async def async_db_session():
    """Async fixture for database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with AsyncSession(engine) as session:
        yield session

    await engine.dispose()

# Use in tests
@pytest.mark.asyncio
async def test_with_async_fixture(async_db_session):
    # Use the async session
    result = await async_db_session.execute(select(Artist))
    artists = result.scalars().all()
    assert isinstance(artists, list)
```

### Async Fixture Scope

```python
# Function scope (default) - new fixture for each test
@pytest.fixture
async def async_fixture():
    yield "value"

# Session scope - shared across all tests
@pytest.fixture(scope="session")
async def async_session_fixture():
    yield "shared_value"
```

---

## Best Practices

1. **Always use @pytest.mark.asyncio**: Required for async test functions
2. **Use AsyncMock for async calls**: Don't use regular MagicMock
3. **Await all async calls**: Forgot await = bugs
4. **Test concurrent operations**: Test asyncio.gather patterns
5. **Mock at async boundaries**: Mock async dependencies properly
6. **Handle async exceptions**: Test error paths in async code
7. **Clean up async resources**: Ensure sessions/connections close
8. **Be mindful of event loop**: One event loop per test (handled by pytest-asyncio)

---

## Summary Checklist

When testing async code:

- [ ] Use `@pytest.mark.asyncio` decorator
- [ ] Use `AsyncMock` for async functions
- [ ] Await all async function calls
- [ ] Mock async database sessions properly
- [ ] Test transaction commit/rollback
- [ ] Test concurrent operations if applicable
- [ ] Handle async context managers correctly
- [ ] Clean up async resources in fixtures
- [ ] Test timeout scenarios
- [ ] Verify async calls with `assert_awaited_*` methods

---

## Related Resources

- [unit-testing.md](unit-testing.md) - General unit testing patterns
- [mocking-fixtures.md](mocking-fixtures.md) - Advanced mocking techniques
- [integration-testing.md](integration-testing.md) - Testing with real async database
