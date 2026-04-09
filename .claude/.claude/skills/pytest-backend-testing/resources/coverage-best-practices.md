# Coverage Best Practices

## Overview

Code coverage measures how much of your code is executed during tests. Your project requires 80%+ coverage. This guide covers achieving and maintaining high coverage effectively.

## Current Project Configuration

### pytest-cov Settings

From `pyproject.toml`:

```toml
[tool.pytest.ini_options]
addopts = [
    "--cov=backend",
    "--cov-report=term-missing",
    "--cov-report=html",
    "--cov-fail-under=80",
]

[tool.coverage.run]
source = ["backend"]
omit = [
    "backend/__init__.py",
    "*/tests/*",
    "tests/*",
    "**/tests/*",
    "conftest.py",
    "*/conftest.py",
    "**/conftest.py",
    "backend/utils/pdf/*",
    "backend/utils/s3.py",
    "backend/api/v1/routers/*",
    "backend/main.py",
    "backend/domain/auth/*",
    "backend/domain/curai/*",
    "backend/domain/admin/*",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
    "raise AssertionError",
    "raise NotImplementedError",
]
```

---

## Running Coverage

### Basic Commands

```bash
# Run tests with coverage
pytest --cov=backend

# Show missing lines
pytest --cov=backend --cov-report=term-missing

# Generate HTML report
pytest --cov=backend --cov-report=html

# Open HTML report
open htmlcov/index.html  # macOS
# or
xdg-open htmlcov/index.html  # Linux

# Check minimum threshold
pytest --cov=backend --cov-fail-under=80
```

### Coverage for Specific Modules

```bash
# Coverage for specific domain
pytest --cov=backend.domain.artist tests/unit/domain/artist/

# Coverage for specific file
pytest --cov=backend.domain.artist.service tests/unit/domain/artist/test_artist_service.py
```

---

## Understanding Coverage Reports

### Terminal Report

```
---------- coverage: platform darwin, python 3.12.3 ----------
Name                                    Stmts   Miss  Cover   Missing
---------------------------------------------------------------------
backend/domain/artist/model.py             12      0   100%
backend/domain/artist/repository.py        45      3    93%   78-80
backend/domain/artist/service.py           68      8    88%   45, 67-74
---------------------------------------------------------------------
TOTAL                                     125     11    91%
```

**Reading the report:**
- **Stmts**: Total statements in the file
- **Miss**: Statements not covered by tests
- **Cover**: Percentage covered
- **Missing**: Line numbers not covered

### HTML Report

The HTML report provides:
- Visual highlighting of covered vs uncovered code
- Branch coverage (if/else paths)
- Detailed line-by-line analysis
- Sortable columns
- Search functionality

---

## What to Test for Coverage

### Priority 1: Critical Business Logic

```python
# ✅ HIGH PRIORITY - Business logic must be tested
class ArtistService:
    async def create_artist(self, dto: ArtistRequestDto):
        # Validate uniqueness - MUST TEST
        existing = await self._repository.find_by_name(dto.name)
        if existing:
            raise ConflictError("Artist already exists")

        # Create artist - MUST TEST
        artist = Artist(id=generate_id(), name=dto.name, bio=dto.bio)
        created = await self._repository.create(artist)

        # Return DTO - MUST TEST
        return ArtistResponseDto.from_model(created)
```

### Priority 2: Error Handling

```python
# ✅ HIGH PRIORITY - Test error paths
class ArtistService:
    async def get_artist(self, artist_id: str):
        artist = await self._repository.get_by_id(artist_id)

        # Error path - MUST TEST
        if not artist:
            raise NotFoundError(f"Artist {artist_id} not found")

        return ArtistResponseDto.from_model(artist)
```

### Priority 3: Edge Cases

```python
# ✅ MEDIUM PRIORITY - Test edge cases
def validate_artist_name(name: str):
    # Empty name - TEST
    if not name.strip():
        raise ValueError("Name cannot be empty")

    # Too long - TEST
    if len(name) > 255:
        raise ValueError("Name too long")

    # Too short - TEST
    if len(name) < 2:
        raise ValueError("Name too short")

    return name.strip()
```

### Low Priority: Simple Getters/Setters

```python
# ⚠️ LOW PRIORITY - Simple property access
@property
def full_name(self):
    return f"{self.first_name} {self.last_name}"

# Can be tested, but not critical for coverage
```

---

## Improving Coverage

### Find Uncovered Lines

```bash
# Run with missing report
pytest --cov=backend --cov-report=term-missing

# Look for "Missing" column
# Example output:
# backend/domain/artist/service.py    88%   45, 67-74
```

### Analyze Uncovered Code

```python
# Example: Lines 67-74 not covered
class ArtistService:
    async def update_artist(self, artist_id: str, dto: ArtistRequestDto):
        artist = await self._repository.get_by_id(artist_id)
        if not artist:
            raise NotFoundError("Artist not found")

        # Lines 67-74 not covered - missing test!
        if dto.name != artist.name:
            existing = await self._repository.find_by_name(dto.name)
            if existing and existing.id != artist_id:
                raise ConflictError("Name already in use")

        artist.name = dto.name
        artist.bio = dto.bio
        await self._repository.update(artist)
        return ArtistResponseDto.from_model(artist)
```

### Write Test for Uncovered Code

```python
@pytest.mark.asyncio
async def test_update_artist_with_duplicate_name_raises_conflict():
    """Test the uncovered lines 67-74."""
    # Arrange
    mock_repo = AsyncMock()

    # Artist being updated
    artist = Artist(id="1", name="Old Name", bio="Bio")
    mock_repo.get_by_id = AsyncMock(return_value=artist)

    # Different artist with the new name
    existing = Artist(id="2", name="New Name", bio="Bio")
    mock_repo.find_by_name = AsyncMock(return_value=existing)

    service = ArtistService(mock_session)
    service._repository = mock_repo

    # Act & Assert - This covers lines 67-74
    with pytest.raises(ConflictError, match="Name already in use"):
        await service.update_artist("1", ArtistRequestDto(name="New Name"))
```

---

## Coverage Strategies

### Strategy 1: Test All Branches

```python
# Code with branches
def calculate_discount(total: float, is_member: bool) -> float:
    if is_member:
        if total > 100:
            return total * 0.20  # Branch 1
        else:
            return total * 0.10  # Branch 2
    else:
        return 0  # Branch 3

# Tests for all branches
def test_member_discount_high_total():
    assert calculate_discount(150, True) == 30  # Branch 1

def test_member_discount_low_total():
    assert calculate_discount(50, True) == 5  # Branch 2

def test_non_member_no_discount():
    assert calculate_discount(150, False) == 0  # Branch 3
```

### Strategy 2: Test Exception Paths

```python
# Code with exceptions
class ArtistService:
    async def delete_artist(self, artist_id: str):
        artist = await self._repository.get_by_id(artist_id)

        # Exception path
        if not artist:
            raise NotFoundError("Artist not found")

        # Check for artworks
        artworks = await self._artwork_repository.find_by_artist(artist_id)
        if artworks:
            raise ConflictError("Cannot delete artist with artworks")

        await self._repository.delete(artist_id)

# Tests for exception paths
@pytest.mark.asyncio
async def test_delete_artist_not_found():
    mock_repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(NotFoundError):
        await service.delete_artist("1")

@pytest.mark.asyncio
async def test_delete_artist_with_artworks():
    mock_repo.get_by_id = AsyncMock(return_value=artist)
    mock_artwork_repo.find_by_artist = AsyncMock(return_value=[artwork])
    with pytest.raises(ConflictError):
        await service.delete_artist("1")
```

### Strategy 3: Parametrize Edge Cases

```python
@pytest.mark.parametrize("name,should_raise", [
    ("Valid Name", False),           # Normal case
    ("", True),                       # Empty
    ("  ", True),                     # Whitespace
    ("a" * 256, True),                # Too long
    ("AB", False),                    # Minimum valid
    ("A" * 255, False),               # Maximum valid
])
def test_name_validation(name, should_raise):
    if should_raise:
        with pytest.raises(ValueError):
            validate_name(name)
    else:
        assert validate_name(name) == name.strip()
```

---

## Excluding Code from Coverage

### Using pragma: no cover

```python
# Exclude debug/development code
def debug_print(msg: str):  # pragma: no cover
    """Only used during development."""
    print(f"DEBUG: {msg}")

# Exclude abstract methods
class BaseRepository:
    def get_by_id(self, id: str):
        raise NotImplementedError  # pragma: no cover
```

### Using Configuration

Already configured in `pyproject.toml`:

```toml
[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
    "raise AssertionError",
    "raise NotImplementedError",
]
```

### Excluding Entire Files

```toml
[tool.coverage.run]
omit = [
    "*/tests/*",
    "backend/main.py",  # Application entry point
    "backend/utils/pdf/*",  # External library wrappers
]
```

---

## Coverage Anti-Patterns

### ❌ DON'T: Write Tests Just for Coverage

```python
# ❌ BAD - Testing for the sake of coverage
def test_getter():
    artist = Artist(id="1", name="Test")
    assert artist.name == "Test"  # Trivial, no value

# ✅ GOOD - Testing actual behavior
@pytest.mark.asyncio
async def test_create_artist_validates_unique_name():
    # Tests business logic, not just attribute access
    with pytest.raises(ConflictError):
        await service.create_artist(duplicate_name_dto)
```

### ❌ DON'T: Focus Only on Coverage Percentage

```python
# ❌ BAD - 100% coverage but poor tests
def test_everything():
    # One giant test that touches all lines
    artist = create_artist()
    update_artist(artist)
    delete_artist(artist)
    # Achieves coverage but doesn't test behavior properly

# ✅ GOOD - Focused tests with meaningful assertions
def test_create_artist():
    artist = create_artist(name="Test")
    assert artist.name == "Test"

def test_update_artist():
    updated = update_artist(artist, new_name="Updated")
    assert updated.name == "Updated"

def test_delete_artist():
    delete_artist(artist)
    with pytest.raises(NotFoundError):
        get_artist(artist.id)
```

### ❌ DON'T: Test Implementation Details

```python
# ❌ BAD - Testing how, not what
@pytest.mark.asyncio
async def test_service_calls_repository():
    # Too focused on implementation
    await service.get_artist("1")
    mock_repo.get_by_id.assert_called_once()  # Only verifies call

# ✅ GOOD - Testing behavior
@pytest.mark.asyncio
async def test_service_returns_artist():
    result = await service.get_artist("1")
    assert result.id == "1"  # Verifies actual behavior
    assert result.name == "Test"
```

---

## Coverage Goals

### Realistic Targets

```
Overall: 80%+ (project requirement)

By Layer:
- Business Logic (Services): 90%+
- Data Access (Repositories): 85%+
- Models: 70%+ (simple models need less)
- Utils: 90%+
- API Routes: 60%+ (integration tests)

What to exclude:
- Configuration files
- Main entry point
- __init__.py files
- External library wrappers
```

### Tracking Coverage Over Time

```bash
# Generate coverage report
pytest --cov=backend --cov-report=html

# Compare with previous run
# Store htmlcov/ in git or CI artifacts
# Track coverage trends in CI/CD
```

---

## Coverage in CI/CD

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.12.3'

      - name: Install dependencies
        run: |
          pip install -e .
          pip install -e .[dev]

      - name: Run tests with coverage
        run: |
          pytest --cov=backend --cov-report=xml --cov-fail-under=80

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./coverage.xml
```

---

## Best Practices Summary

### DO:

1. **Focus on business logic**: Prioritize testing critical code
2. **Test error paths**: Don't just test happy paths
3. **Test edge cases**: Boundary conditions, null values, etc.
4. **Use coverage to find gaps**: Coverage report shows what to test
5. **Write meaningful tests**: Don't test for coverage sake
6. **Exclude non-testable code**: Use pragma or config
7. **Track trends**: Monitor coverage over time

### DON'T:

1. **Obsess over 100%**: 80%+ is great, focus on quality
2. **Test trivial code**: Getters/setters add little value
3. **Test framework code**: Don't test Pydantic, FastAPI, etc.
4. **Write one giant test**: Keep tests focused
5. **Ignore failing tests**: Fix or remove broken tests
6. **Test implementation**: Test behavior, not how it's done

---

## Troubleshooting

### Coverage Not Increasing

```bash
# 1. Check if test is actually running
pytest -v tests/unit/domain/artist/test_artist_service.py

# 2. Check if file is in coverage scope
pytest --cov=backend.domain.artist tests/unit/domain/artist/

# 3. Verify file is not excluded
# Check pyproject.toml [tool.coverage.run] omit setting
```

### Coverage Lower Than Expected

```bash
# 1. Generate detailed report
pytest --cov=backend --cov-report=html

# 2. Open HTML report and find uncovered lines
open htmlcov/index.html

# 3. Look at the "Missing" lines in red
# 4. Write tests specifically for those lines
```

### Coverage Failing in CI

```bash
# 1. Run locally with same command
pytest --cov=backend --cov-fail-under=80

# 2. Check if files are excluded in CI
# Verify pyproject.toml is in CI environment

# 3. Check Python version matches
# CI should use same Python version as development
```

---

## Summary Checklist

For maintaining good coverage:

- [ ] Run coverage reports regularly
- [ ] Aim for 80%+ overall coverage
- [ ] Prioritize business logic and error handling
- [ ] Test all code branches (if/else)
- [ ] Use HTML report to find gaps
- [ ] Exclude non-testable code appropriately
- [ ] Focus on meaningful tests, not coverage numbers
- [ ] Track coverage trends over time
- [ ] Integrate coverage checks in CI/CD
- [ ] Review coverage reports in PRs

---

## Related Resources

- [testing-architecture.md](testing-architecture.md) - What to test
- [unit-testing.md](unit-testing.md) - Writing effective unit tests
- [integration-testing.md](integration-testing.md) - Higher-level coverage
