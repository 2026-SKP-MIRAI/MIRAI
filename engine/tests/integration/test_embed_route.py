import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_embed_200_single_text():
    mock_embeddings = [[0.1] * 768]
    with patch("app.routers.embed.get_embeddings", return_value=(mock_embeddings, None)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/embed", json={"texts": ["테스트 텍스트"]})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["embeddings"]) == 1
    assert len(body["embeddings"][0]) == 768


@pytest.mark.asyncio
async def test_embed_400_empty_texts():
    """texts 빈 배열 → Pydantic min_length 검증 실패 → main.py RequestValidationError handler → 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/embed", json={"texts": []})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_embed_400_missing_texts():
    """texts 필드 누락 → Pydantic 검증 실패 → main.py RequestValidationError handler → 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/embed", json={})
    assert resp.status_code == 400
