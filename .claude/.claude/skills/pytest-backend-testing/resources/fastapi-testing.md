# FastAPI Testing

## Overview

FastAPI provides excellent testing support through the TestClient class and dependency injection system. This guide covers FastAPI-specific testing patterns, request/response testing, and dependency overrides.

## TestClient Basics

### Setting Up TestClient

```python
from fastapi.testclient import TestClient
from backend.main import create_application

@pytest.fixture
def client():
    """FastAPI test client."""
    app = create_application()
    return TestClient(app)

# Use in tests
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
```

### TestClient vs httpx

TestClient is synchronous (wraps httpx) - perfect for testing:

```python
# ✅ GOOD - Sync test with TestClient
def test_endpoint(client):
    response = client.get("/api/v1/artists")
    assert response.status_code == 200

# ❌ DON'T - No need for async with TestClient
@pytest.mark.asyncio
async def test_endpoint(client):  # Unnecessary async
    response = client.get("/api/v1/artists")
```

---

## Testing HTTP Methods

### GET Requests

```python
def test_get_artist(client):
    # Simple GET
    response = client.get("/api/v1/artists/123")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "123"

def test_get_with_query_params(client):
    # GET with query parameters
    response = client.get(
        "/api/v1/artists",
        params={"page": 1, "limit": 10, "sort": "name"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) <= 10
```

### POST Requests

```python
def test_create_artist(client):
    # POST with JSON body
    response = client.post(
        "/api/v1/artists",
        json={"name": "New Artist", "bio": "Artist bio"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Artist"
    assert "id" in data

def test_create_with_headers(client):
    # POST with custom headers
    response = client.post(
        "/api/v1/artists",
        json={"name": "Artist", "bio": "Bio"},
        headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 201
```

### PUT and PATCH Requests

```python
def test_update_artist_put(client):
    # PUT (full update)
    response = client.put(
        "/api/v1/artists/123",
        json={"name": "Updated", "bio": "New bio"}
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated"

def test_update_artist_patch(client):
    # PATCH (partial update)
    response = client.patch(
        "/api/v1/artists/123",
        json={"bio": "Updated bio only"}
    )

    assert response.status_code == 200
```

### DELETE Requests

```python
def test_delete_artist(client):
    response = client.delete("/api/v1/artists/123")

    assert response.status_code == 204
    assert response.content == b""

def test_delete_nonexistent(client):
    response = client.delete("/api/v1/artists/nonexistent")

    assert response.status_code == 404
```

---

## Testing Request Validation

### Pydantic Validation Errors

```python
def test_create_artist_invalid_data(client):
    # Empty name (should fail validation)
    response = client.post(
        "/api/v1/artists",
        json={"name": "", "bio": "Bio"}
    )

    assert response.status_code == 422  # Unprocessable Entity
    data = response.json()
    assert "detail" in data
    assert any(
        error["loc"] == ["body", "name"]
        for error in data["detail"]
    )

def test_create_artist_missing_required_field(client):
    # Missing required field
    response = client.post(
        "/api/v1/artists",
        json={"bio": "Bio"}  # Missing 'name'
    )

    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(
        error["loc"] == ["body", "name"]
        for error in errors
    )
```

### Custom Validation

```python
def test_artist_name_length_validation(client):
    # Name too long
    long_name = "a" * 256
    response = client.post(
        "/api/v1/artists",
        json={"name": long_name, "bio": "Bio"}
    )

    assert response.status_code == 422

def test_artist_email_format_validation(client):
    # Invalid email format
    response = client.post(
        "/api/v1/artists",
        json={
            "name": "Artist",
            "email": "invalid-email",
            "bio": "Bio"
        }
    )

    assert response.status_code == 422
```

---

## Testing Response Formats

### JSON Responses

```python
def test_response_format(client):
    response = client.get("/api/v1/artists/123")

    # Status
    assert response.status_code == 200

    # Content type
    assert response.headers["content-type"] == "application/json"

    # JSON data
    data = response.json()
    assert isinstance(data, dict)
    assert "id" in data
    assert "name" in data
    assert "bio" in data

def test_list_response_format(client):
    response = client.get("/api/v1/artists")

    data = response.json()
    assert isinstance(data, list)
    assert all(isinstance(item, dict) for item in data)
```

### Pagination Responses

```python
def test_paginated_response(client):
    response = client.get("/api/v1/artists?page=1&limit=10")

    assert response.status_code == 200
    data = response.json()

    # Check pagination structure
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert len(data["items"]) <= 10
```

---

## Dependency Override

### Overriding Database Session

```python
from fastapi import FastAPI
from backend.db.orm import get_read_session_dependency

@pytest.fixture
def client_with_test_db(test_db):
    """Client with overridden database dependency."""
    app = create_application()

    # Override dependency
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_read_session_dependency] = override_get_db

    client = TestClient(app)

    yield client

    # Clear overrides
    app.dependency_overrides.clear()

# Use in tests
def test_with_test_db(client_with_test_db):
    # This uses test database instead of real database
    response = client_with_test_db.get("/api/v1/artists")
    assert response.status_code == 200
```

### Overriding Authentication

```python
from backend.api.dependencies import get_current_user

@pytest.fixture
def authenticated_client():
    """Client with authentication bypassed."""
    app = create_application()

    # Mock user
    mock_user = User(id="test-user", email="test@test.com")

    # Override auth dependency
    async def override_auth():
        return mock_user

    app.dependency_overrides[get_current_user] = override_auth

    client = TestClient(app)

    yield client

    app.dependency_overrides.clear()

def test_protected_route(authenticated_client):
    # This bypasses authentication
    response = authenticated_client.get("/api/v1/protected")
    assert response.status_code == 200
```

### Overriding External Services

```python
from backend.services.s3 import get_s3_client

@pytest.fixture
def client_with_mock_s3():
    """Client with mocked S3 service."""
    app = create_application()

    # Mock S3 client
    mock_s3 = MagicMock()
    mock_s3.upload_file.return_value = "https://example.com/file.jpg"

    def override_s3():
        return mock_s3

    app.dependency_overrides[get_s3_client] = override_s3

    client = TestClient(app)

    yield client

    app.dependency_overrides.clear()

def test_file_upload(client_with_mock_s3):
    # S3 is mocked
    response = client_with_mock_s3.post(
        "/api/v1/upload",
        files={"file": ("test.jpg", b"content", "image/jpeg")}
    )
    assert response.status_code == 200
```

---

## Testing Authentication

### JWT Token Authentication

```python
import jwt
from datetime import datetime, timedelta

@pytest.fixture
def auth_token():
    """Generate valid JWT token for testing."""
    payload = {
        "sub": "test-user-id",
        "email": "test@test.com",
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, "secret-key", algorithm="HS256")
    return token

def test_protected_endpoint_without_token(client):
    response = client.get("/api/v1/protected")
    assert response.status_code == 401

def test_protected_endpoint_with_token(client, auth_token):
    response = client.get(
        "/api/v1/protected",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200

def test_expired_token(client):
    # Create expired token
    payload = {
        "sub": "user-id",
        "exp": datetime.utcnow() - timedelta(hours=1)  # Expired
    }
    expired_token = jwt.encode(payload, "secret-key", algorithm="HS256")

    response = client.get(
        "/api/v1/protected",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
```

### Cookie-Based Authentication

```python
def test_login_sets_cookie(client):
    # Login
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "password"}
    )

    assert response.status_code == 200

    # Check cookie was set
    assert "session" in response.cookies

def test_authenticated_request_with_cookie(client):
    # Login first
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "password"}
    )

    # Use cookie for subsequent request
    response = client.get(
        "/api/v1/protected",
        cookies=login_response.cookies
    )

    assert response.status_code == 200
```

---

## Testing Error Handling

### 404 Not Found

```python
def test_get_nonexistent_artist(client):
    response = client.get("/api/v1/artists/nonexistent-id")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
```

### 409 Conflict

```python
def test_create_duplicate_artist(client):
    # Create first artist
    client.post(
        "/api/v1/artists",
        json={"name": "Artist", "email": "test@test.com"}
    )

    # Try to create duplicate
    response = client.post(
        "/api/v1/artists",
        json={"name": "Artist 2", "email": "test@test.com"}
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()
```

### 500 Internal Server Error

```python
def test_internal_server_error_handling(client, mocker):
    # Mock service to raise exception
    mocker.patch(
        "backend.domain.artist.service.ArtistService.get_artist",
        side_effect=Exception("Database error")
    )

    response = client.get("/api/v1/artists/123")

    assert response.status_code == 500
    data = response.json()
    assert "detail" in data
```

---

## Testing File Uploads

### Single File Upload

```python
def test_upload_file(client):
    # Create test file
    file_content = b"fake image content"

    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.jpg", file_content, "image/jpeg")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "url" in data
```

### Multiple File Upload

```python
def test_upload_multiple_files(client):
    files = [
        ("files", ("file1.jpg", b"content1", "image/jpeg")),
        ("files", ("file2.jpg", b"content2", "image/jpeg")),
    ]

    response = client.post("/api/v1/upload/multiple", files=files)

    assert response.status_code == 200
    data = response.json()
    assert len(data["urls"]) == 2
```

### File Size Validation

```python
def test_upload_file_too_large(client):
    # Create file larger than limit (e.g., 10MB)
    large_file = b"x" * (11 * 1024 * 1024)

    response = client.post(
        "/api/v1/upload",
        files={"file": ("large.jpg", large_file, "image/jpeg")}
    )

    assert response.status_code == 413  # Payload Too Large
```

---

## Testing Background Tasks

### Verifying Background Task Execution

```python
from unittest.mock import MagicMock, patch

def test_endpoint_triggers_background_task(client):
    with patch("backend.tasks.send_email") as mock_send_email:
        response = client.post(
            "/api/v1/artists",
            json={"name": "Artist", "email": "test@test.com"}
        )

        assert response.status_code == 201

        # Verify background task was called
        mock_send_email.assert_called_once()
        assert mock_send_email.call_args[0][0] == "test@test.com"
```

---

## Testing Streaming Responses

### Server-Sent Events (SSE)

```python
def test_sse_endpoint(client):
    with client.stream("GET", "/api/v1/stream") as response:
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream"

        # Read events
        events = []
        for line in response.iter_lines():
            if line.startswith("data:"):
                events.append(line[5:])

        assert len(events) > 0
```

---

## Testing WebSocket Endpoints

### WebSocket Testing

```python
def test_websocket(client):
    with client.websocket_connect("/ws") as websocket:
        # Send message
        websocket.send_text("Hello")

        # Receive response
        data = websocket.receive_text()

        assert data == "Hello back"

def test_websocket_json(client):
    with client.websocket_connect("/ws/json") as websocket:
        # Send JSON
        websocket.send_json({"type": "ping"})

        # Receive JSON
        data = websocket.receive_json()

        assert data["type"] == "pong"
```

---

## Performance Testing

### Response Time

```python
import time

def test_response_time(client):
    start = time.time()

    response = client.get("/api/v1/artists")

    duration = time.time() - start

    assert response.status_code == 200
    assert duration < 0.1  # Should respond in < 100ms
```

### Load Testing (Simplified)

```python
@pytest.mark.performance
def test_endpoint_under_load(client):
    """Test endpoint handles multiple requests."""
    results = []

    # Send 100 requests
    for _ in range(100):
        response = client.get("/api/v1/artists")
        results.append(response.status_code)

    # All should succeed
    assert all(status == 200 for status in results)
```

---

## Best Practices

### 1. Use Fixtures for Common Setup

```python
@pytest.fixture
def sample_artist(client):
    """Create sample artist for testing."""
    response = client.post(
        "/api/v1/artists",
        json={"name": "Test Artist", "bio": "Bio"}
    )
    return response.json()

def test_update_artist(client, sample_artist):
    artist_id = sample_artist["id"]

    response = client.put(
        f"/api/v1/artists/{artist_id}",
        json={"name": "Updated", "bio": "New bio"}
    )

    assert response.status_code == 200
```

### 2. Test Both Success and Error Cases

```python
def test_create_artist_success(client):
    response = client.post(
        "/api/v1/artists",
        json={"name": "Artist", "bio": "Bio"}
    )
    assert response.status_code == 201

def test_create_artist_validation_error(client):
    response = client.post(
        "/api/v1/artists",
        json={"name": "", "bio": "Bio"}
    )
    assert response.status_code == 422

def test_create_artist_duplicate_error(client):
    # Create first
    client.post("/api/v1/artists", json={"name": "Artist", "bio": "Bio"})

    # Try duplicate
    response = client.post(
        "/api/v1/artists",
        json={"name": "Artist", "bio": "Bio"}
    )
    assert response.status_code == 409
```

### 3. Verify Response Structure

```python
def test_artist_response_structure(client):
    response = client.get("/api/v1/artists/123")

    data = response.json()

    # Verify all required fields present
    assert "id" in data
    assert "name" in data
    assert "bio" in data
    assert "created_at" in data

    # Verify types
    assert isinstance(data["id"], str)
    assert isinstance(data["name"], str)
```

---

## Summary Checklist

When testing FastAPI endpoints:

- [ ] Use TestClient for HTTP testing
- [ ] Test all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- [ ] Verify status codes
- [ ] Test request validation (422 errors)
- [ ] Test authentication and authorization
- [ ] Use dependency overrides for mocking
- [ ] Test error responses (404, 409, 500)
- [ ] Verify response structure and types
- [ ] Test file uploads if applicable
- [ ] Test pagination if applicable
- [ ] Mock external services
- [ ] Test both success and failure paths

---

## Related Resources

- [integration-testing.md](integration-testing.md) - Full workflow testing
- [unit-testing.md](unit-testing.md) - Testing components in isolation
- [testing-architecture.md](testing-architecture.md) - Overall testing strategy
