# Integration Testing

## Overview

Integration tests verify that multiple components work together correctly. Unlike unit tests that isolate individual units, integration tests test the interaction between layers, services, and external systems.

**IMPORTANT:** YOU MUST USE A DEDICATED TEST DATABASE (PostgreSQL) FOR INTEGRATION TESTS, NOT PRODUCTION DATABASE.
- Local: Use docker-compose to run PostgreSQL test database on port 5433
- CI: GitHub Actions provides PostgreSQL service container on port 5432

## Integration vs Unit Tests

### Comparison

| Aspect           | Unit Tests            | Integration Tests     |
| ---------------- | --------------------- | --------------------- |
| **Scope**        | Single function/class | Multiple components   |
| **Dependencies** | All mocked            | Some/none mocked      |
| **Speed**        | Fast (milliseconds)   | Slower (seconds)      |
| **Database**     | Mocked                | PostgreSQL test DB    |
| **Network**      | Mocked                | May use real services |
| **Focus**        | Logic correctness     | Component interaction |
| **Quantity**     | Many (100s)           | Fewer (10s)           |

### When to Use Each

```python
# Unit Test - Test service logic with mocked repository
@pytest.mark.asyncio
async def test_create_artist_service_unit():
    mock_repo = AsyncMock()
    mock_repo.create = AsyncMock(return_value=artist)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    result = await service.create_artist(dto)
    assert result.name == dto.name

# Integration Test - Test service + repository + database
@pytest.mark.asyncio
async def test_create_artist_service_integration(test_db):
    # Real repository, real database
    session = test_db
    service = ArtistService(session)

    result = await service.create_artist(dto)

    # Verify in database
    saved = await session.get(Artist, result.id)
    assert saved.name == dto.name
```

---

## Integration Test Structure

### Directory Organization

```
tests/
  unit/                     # Unit tests
    domain/
      artist/
        test_artist_repository.py
        test_artist_service.py

  integration/              # Integration tests
    test_artist_api.py      # API endpoint tests
    test_artist_flow.py     # Full workflow tests
    test_auth_flow.py
    conftest.py             # Integration fixtures
```

---

## Database Integration Testing

### Recommended Strategy: PostgreSQL Test Database

**Use a real PostgreSQL test database for integration tests.** This ensures compatibility with production and tests PostgreSQL-specific features (ARRAY, JSONB, etc.).

#### Setup Test Database

**Local Development (docker-compose):**
```bash
cd backend
docker-compose up test-db  # Starts PostgreSQL on port 5433
```

**GitHub Actions CI:**
The workflow automatically provides PostgreSQL service container on port 5432.

#### Implementation:

```python
import os
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# Get test database URL from environment or use default
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://test_user:test_password@localhost:5433/test_qwarty"
)

@pytest.fixture(scope="session")
async def test_engine() -> AsyncEngine:
    """
    PostgreSQL test database engine.

    Local: postgresql+asyncpg://test_user:test_password@localhost:5433/test_qwarty
    CI:    postgresql+asyncpg://test_user:test_password@localhost:5432/test_qwarty
    """
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,  # Verify connections before using
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield engine

    # Cleanup - Drop all tables after all tests
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

    await engine.dispose()

@pytest.fixture(scope="function")
async def db_session(test_engine: AsyncEngine):
    """
    Database session with automatic rollback.

    Each test gets a fresh session that rolls back all changes,
    ensuring test isolation using PostgreSQL transaction rollback.
    """
    connection = await test_engine.connect()
    transaction = await connection.begin()

    async with AsyncSession(bind=connection, expire_on_commit=False) as session:
        yield session

    # Rollback transaction (cleanup - reverts all changes)
    await transaction.rollback()
    await connection.close()

# Use in tests
@pytest.mark.asyncio
async def test_with_postgresql(db_session):
    repository = ArtistRepository(db_session)

    # Create artist
    artist = Artist(id="1", name="Test", bio="Bio")
    created = await repository.create(artist)

    # Verify it was saved
    retrieved = await repository.get_by_id("1")
    assert retrieved.name == "Test"
    # Transaction will be rolled back after test
```

### Running Tests

**Local (with docker-compose):**
```bash
# Start test database
cd backend
docker-compose up -d test-db

# Run integration tests
pytest tests/integration/ -v

# Stop test database
docker-compose down
```

**CI (GitHub Actions):**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: test_qwarty
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Run integration tests
    env:
      TEST_DATABASE_URL: postgresql+asyncpg://test_user:test_password@localhost:5432/test_qwarty
    run: pytest tests/integration/ -v
```

---

## Testing API Routes (FastAPI)

### Using TestClient

```python
from fastapi.testclient import TestClient
from backend.main import create_application

@pytest.fixture
def client():
    """FastAPI test client."""
    app = create_application()
    return TestClient(app)

def test_create_artist_endpoint(client):
    # Act
    response = client.post(
        "/api/v1/artists",
        json={"name": "Test Artist", "bio": "Test bio"}
    )

    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Artist"
    assert "id" in data

def test_get_artist_endpoint(client):
    # Arrange - Create artist first
    create_response = client.post(
        "/api/v1/artists",
        json={"name": "Test", "bio": "Bio"}
    )
    artist_id = create_response.json()["id"]

    # Act
    response = client.get(f"/api/v1/artists/{artist_id}")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == artist_id
    assert data["name"] == "Test"
```

### Testing with Authentication

```python
@pytest.fixture
def authenticated_client(client):
    """Client with authentication token."""
    # Login to get token
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "password"}
    )
    token = response.json()["access_token"]

    # Add token to client
    client.headers = {"Authorization": f"Bearer {token}"}
    return client

def test_protected_endpoint(authenticated_client):
    response = authenticated_client.get("/api/v1/artists/me")
    assert response.status_code == 200
```

### Testing Error Responses

```python
def test_create_artist_with_invalid_data(client):
    # Empty name
    response = client.post(
        "/api/v1/artists",
        json={"name": "", "bio": "Bio"}
    )

    assert response.status_code == 422  # Validation error
    data = response.json()
    assert "detail" in data

def test_get_nonexistent_artist(client):
    response = client.get("/api/v1/artists/nonexistent-id")

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()
```

---

## Testing Complete Workflows

### Full User Journey

```python
@pytest.mark.asyncio
async def test_artist_creation_workflow(client, test_db):
    """Test complete artist creation workflow."""
    # 1. Create artist
    create_response = client.post(
        "/api/v1/artists",
        json={"name": "New Artist", "bio": "Artist bio"}
    )
    assert create_response.status_code == 201
    artist_id = create_response.json()["id"]

    # 2. Retrieve artist
    get_response = client.get(f"/api/v1/artists/{artist_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "New Artist"

    # 3. Update artist
    update_response = client.put(
        f"/api/v1/artists/{artist_id}",
        json={"name": "Updated Artist", "bio": "New bio"}
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Artist"

    # 4. Verify in database
    artist = await test_db.get(Artist, artist_id)
    assert artist.name == "Updated Artist"

    # 5. Delete artist
    delete_response = client.delete(f"/api/v1/artists/{artist_id}")
    assert delete_response.status_code == 204

    # 6. Verify deletion
    get_deleted = client.get(f"/api/v1/artists/{artist_id}")
    assert get_deleted.status_code == 404
```

### Multi-Service Integration

```python
@pytest.mark.asyncio
async def test_artist_artwork_relationship(client, test_db):
    """Test integration between artist and artwork services."""
    # 1. Create artist
    artist_response = client.post(
        "/api/v1/artists",
        json={"name": "Artist", "bio": "Bio"}
    )
    artist_id = artist_response.json()["id"]

    # 2. Create artwork for artist
    artwork_response = client.post(
        "/api/v1/artworks",
        json={
            "title": "Artwork",
            "artist_id": artist_id,
            "price": 1000
        }
    )
    assert artwork_response.status_code == 201
    artwork_id = artwork_response.json()["id"]

    # 3. Get artist's artworks
    artworks_response = client.get(
        f"/api/v1/artists/{artist_id}/artworks"
    )
    assert artworks_response.status_code == 200
    artworks = artworks_response.json()
    assert len(artworks) == 1
    assert artworks[0]["id"] == artwork_id

    # 4. Try to delete artist (should fail - has artworks)
    delete_response = client.delete(f"/api/v1/artists/{artist_id}")
    assert delete_response.status_code == 409  # Conflict
```

---

## Testing External Services

### Mocking External APIs

```python
import respx
from httpx import Response

@pytest.mark.asyncio
@respx.mock
async def test_fetch_external_artist_data():
    """Test integration with external API (mocked)."""
    # Mock external API
    respx.get("https://api.example.com/artists/123").mock(
        return_value=Response(
            200,
            json={"id": "123", "name": "External Artist"}
        )
    )

    # Test service that calls external API
    service = ExternalArtistService()
    result = await service.fetch_artist("123")

    assert result["name"] == "External Artist"
```

### Testing S3 Integration

```python
from moto import mock_s3
import boto3

@pytest.fixture
def s3_bucket():
    """Mock S3 bucket for testing."""
    with mock_s3():
        # Create test bucket
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-bucket")

        yield s3

def test_upload_to_s3(s3_bucket):
    """Test S3 upload integration."""
    from backend.utils.s3 import upload_file

    # Upload file
    upload_file("test.jpg", "test-bucket", "uploads/test.jpg")

    # Verify file was uploaded
    response = s3_bucket.get_object(
        Bucket="test-bucket",
        Key="uploads/test.jpg"
    )
    assert response["Body"].read() == b"file content"
```

---

## Database Testing Patterns

### Testing Transactions

```python
@pytest.mark.asyncio
async def test_transaction_rollback_on_error(test_db):
    """Test that transaction rolls back on error."""
    service = ArtistService(test_db)

    # Attempt to create artist that will fail
    try:
        async with test_db.begin():
            await service.create_artist(dto)
            # Simulate error
            raise Exception("Intentional error")
    except Exception:
        pass

    # Verify artist was not saved
    artists = await service.get_all_artists()
    assert len(artists) == 0
```

### Testing Relationships

```python
@pytest.mark.asyncio
async def test_artist_artworks_relationship(test_db):
    """Test database relationship between artist and artworks."""
    # Create artist
    artist = Artist(id="1", name="Test")
    test_db.add(artist)
    await test_db.commit()

    # Create artworks
    artwork1 = Artwork(id="a1", title="Work 1", artist_id="1")
    artwork2 = Artwork(id="a2", title="Work 2", artist_id="1")
    test_db.add(artwork1)
    test_db.add(artwork2)
    await test_db.commit()

    # Refresh to load relationships
    await test_db.refresh(artist)

    # Verify relationship
    assert len(artist.artworks) == 2
    assert artist.artworks[0].title == "Work 1"
```

### Testing Unique Constraints

```python
@pytest.mark.asyncio
async def test_unique_constraint_violation(test_db):
    """Test database unique constraint."""
    # Create first artist
    artist1 = Artist(id="1", name="Artist", email="test@test.com")
    test_db.add(artist1)
    await test_db.commit()

    # Try to create second artist with same email
    artist2 = Artist(id="2", name="Artist 2", email="test@test.com")
    test_db.add(artist2)

    # Should raise integrity error
    with pytest.raises(IntegrityError):
        await test_db.commit()
```

---

## Testing Middleware

### Error Handler Middleware

```python
def test_error_handler_middleware(client):
    """Test that error handler middleware works."""
    # Trigger an error
    response = client.get("/api/v1/artists/trigger-error")

    # Verify error response format
    assert response.status_code == 500
    data = response.json()
    assert "detail" in data
    assert "error" in data["detail"].lower()
```

### Authentication Middleware

```python
def test_authentication_middleware(client):
    """Test authentication middleware."""
    # Without token
    response = client.get("/api/v1/protected")
    assert response.status_code == 401

    # With invalid token
    client.headers = {"Authorization": "Bearer invalid"}
    response = client.get("/api/v1/protected")
    assert response.status_code == 401

    # With valid token
    client.headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.get("/api/v1/protected")
    assert response.status_code == 200
```

---

## Performance Integration Tests

### Testing Query Performance

```python
@pytest.mark.performance
@pytest.mark.asyncio
async def test_artist_list_performance(test_db):
    """Test that artist list query is performant."""
    # Create many artists
    for i in range(1000):
        artist = Artist(id=f"id-{i}", name=f"Artist {i}")
        test_db.add(artist)
    await test_db.commit()

    # Measure query time
    import time
    start = time.time()

    repository = ArtistRepository(test_db)
    artists = await repository.find_all(limit=100)

    duration = time.time() - start

    # Assert performance
    assert len(artists) == 100
    assert duration < 0.5  # Should complete in < 500ms
```

---

## Best Practices

### 1. Keep Tests Independent

```python
# ✅ GOOD - Each test creates its own data
@pytest.mark.asyncio
async def test_1(test_db):
    artist = Artist(id="1", name="Test")
    test_db.add(artist)
    await test_db.commit()
    # Test uses this artist

@pytest.mark.asyncio
async def test_2(test_db):
    # Creates its own artist, doesn't depend on test_1
    artist = Artist(id="2", name="Test 2")
    test_db.add(artist)
    await test_db.commit()
```

### 2. Use Factories for Test Data

```python
from datetime import datetime

def create_artist(**kwargs):
    """Factory for creating test artists."""
    defaults = {
        "id": f"artist-{datetime.now().timestamp()}",
        "name": "Test Artist",
        "bio": "Test bio",
    }
    defaults.update(kwargs)
    return Artist(**defaults)

# Use in tests
@pytest.mark.asyncio
async def test_with_factory(test_db):
    artist = create_artist(name="Custom Name")
    test_db.add(artist)
    await test_db.commit()
```

### 3. Clean Up After Tests

```python
@pytest.fixture
async def test_db():
    """Database with automatic cleanup."""
    # Setup
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with AsyncSession(engine) as session:
        yield session

    # Cleanup - happens automatically after test
    await engine.dispose()
```

---

## Summary Checklist

For integration tests:

- [ ] Test component interactions, not just individual units
- [ ] Use real database (in-memory or test instance)
- [ ] Test complete workflows from API to database
- [ ] Verify database state after operations
- [ ] Test error scenarios and rollbacks
- [ ] Mock only external services (if needed)
- [ ] Keep tests independent with cleanup
- [ ] Use factories for test data creation
- [ ] Test authentication and authorization
- [ ] Verify relationship loading and constraints

---

## Related Resources

- [testing-architecture.md](testing-architecture.md) - Overall test strategy
- [unit-testing.md](unit-testing.md) - Complementary unit tests
- [fastapi-testing.md](fastapi-testing.md) - FastAPI-specific patterns
