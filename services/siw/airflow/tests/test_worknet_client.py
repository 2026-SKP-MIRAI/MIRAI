"""worknet_client 단위 테스트 — 주요기업 공채속보 크롤링 방식"""
import time
from unittest.mock import MagicMock, patch

import pytest


# ── HTML 픽스처 ────────────────────────────────────────────────────────────────

LIST_HTML = """<!DOCTYPE html><html><body>
<span class="tit ml08">검색건수 <span class="txt_total">250</span>건</span>
<table>
  <tr>
    <td><a href="/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=W001&amp;infoTypeCd=VALIDATION&amp;infoTypeGroup=tb_workinfoworknet"
           class="t3_sb underline_hover" title="새창 열림">백엔드 개발자 채용</a></td>
  </tr>
  <tr>
    <td><a href="/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=W002&amp;infoTypeCd=VALIDATION&amp;infoTypeGroup=tb_workinfoworknet"
           class="t3_sb underline_hover" title="새창 열림">프론트엔드 개발자 채용</a></td>
  </tr>
</table>
</body></html>"""

EMPTY_LIST_HTML = """<!DOCTYPE html><html><body>
<span class="tit ml08">검색건수 <span class="txt_total">0</span>건</span>
</body></html>"""

DETAIL_HTML = """<!DOCTYPE html><html><body>
<div class="emp_sumup_wrp">
  <div class="tit_area">
    <p class="corp_info"><strong>테스트기업 주식회사</strong></p>
    <strong class="title">백엔드 개발자 채용</strong>
  </div>
</div>
<div id="tab-panel01">
  <div class="fold">API 설계 및 개발, 코드 리뷰</div>
  <table>
    <tr><th>모집직종</th><td>정보통신직</td></tr>
    <tr><th>경력</th><td>경력 3년 이상</td></tr>
    <tr><th>학력</th><td>대졸</td></tr>
  </table>
</div>
<div id="tab-panel02">
  <table>
    <tr><th>근무지역</th><td>서울</td></tr>
    <tr><th>임금</th><td>5000만원</td></tr>
    <tr><th>경력</th><td>경력 3년 이상</td></tr>
    <tr><th>학력</th><td>대졸</td></tr>
  </table>
</div>
<div id="tab-panel03">
  <table>
    <tr><th>우대조건</th><td>Python 유경험자 우대, 오픈소스 기여 경험</td></tr>
    <tr><th>기타 우대사항</th><td>-</td></tr>
  </table>
</div>
</body></html>"""

CSRF_HTML = """<!DOCTYPE html><html><head>
<meta name="_csrf" content="test-csrf-token">
</head><body></body></html>"""


# ── 픽스처 ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    with patch("worknet_client.Variable.get", return_value="0.0"):
        from worknet_client import WorknetClient
        return WorknetClient(rate_limit_sec=0.0)


def _mock_get(html=CSRF_HTML):
    resp = MagicMock()
    resp.text = html
    resp.raise_for_status = MagicMock()
    return resp


def _mock_post(html=LIST_HTML):
    resp = MagicMock()
    resp.text = html
    resp.raise_for_status = MagicMock()
    return resp


# ── 테스트 1: 목록 HTML 파싱 ───────────────────────────────────────────────────

def test_fetch_list_page_parses_html(client):
    """정상 HTML → WorknetListItem 리스트 파싱."""
    with patch.object(client._session, "post", return_value=_mock_post(LIST_HTML)):
        items, total = client.fetch_list_page(page=1)

    assert total == 250
    assert len(items) == 2
    assert items[0].wanted_auth_no == "W001"
    assert items[1].wanted_auth_no == "W002"
    assert items[0].job_cd == ""


# ── 테스트 2: 빈 응답 ─────────────────────────────────────────────────────────

def test_fetch_list_page_empty(client):
    """총 건수 0 → 빈 리스트, total=0."""
    with patch.object(client._session, "post", return_value=_mock_post(EMPTY_LIST_HTML)):
        items, total = client.fetch_list_page(page=1)

    assert items == []
    assert total == 0


# ── 테스트 3: 페이지네이션 ────────────────────────────────────────────────────

def test_fetch_all_list_paginates(client):
    """max_pages=1 → 1페이지만 수집 후 종료."""
    with patch.object(client._session, "get", return_value=_mock_get(CSRF_HTML)), \
         patch.object(client._session, "post", return_value=_mock_post(LIST_HTML)):
        items = client.fetch_all_list(max_pages=1)

    assert len(items) == 2


# ── 테스트 4: 상세 조회 pref_cond 추출 ───────────────────────────────────────

def test_fetch_detail_extracts_pref_cond(client):
    """상세 HTML → WorknetDetail.pref_cond 정확히 추출."""
    from worknet_client import WorknetListItem
    item = WorknetListItem(
        wanted_auth_no="W001", company="테스트기업",
        title="백엔드 개발자", job_cd="",
        source_url="https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=W001",
    )

    with patch.object(client._session, "get", return_value=_mock_get(DETAIL_HTML)):
        detail = client.fetch_detail(item)

    assert "Python 유경험자 우대" in detail.pref_cond
    assert detail.company == "테스트기업 주식회사"
    assert detail.job_content == "API 설계 및 개발, 코드 리뷰"


# ── 테스트 5: 상세 배치 에러 skip ─────────────────────────────────────────────

def test_fetch_details_batch_skips_errors(client):
    """HTTP 에러 발생 항목은 skip, 나머지는 정상 처리."""
    from worknet_client import WorknetListItem
    items = [
        WorknetListItem("W001", "기업A", "공고A", "", "http://a"),
        WorknetListItem("W002", "기업B", "공고B", "", "http://b"),
    ]

    def fake_get(url, params=None, timeout=30):
        resp = MagicMock()
        if params.get("wantedAuthNo") == "W001":
            resp.raise_for_status.side_effect = Exception("HTTP 500")
        else:
            resp.raise_for_status = MagicMock()
            resp.text = DETAIL_HTML
        return resp

    with patch.object(client._session, "get", side_effect=fake_get):
        details = client.fetch_details_batch(items)

    assert len(details) == 1
    assert details[0].wanted_auth_no == "W002"


# ── 테스트 6: rate limit 적용 ─────────────────────────────────────────────────

def test_rate_limit_between_calls():
    """연속 호출 간 rate_limit_sec 이상 경과 검증."""
    with patch("worknet_client.Variable.get", return_value="0.1"):
        from worknet_client import WorknetClient
        c = WorknetClient(rate_limit_sec=0.1)

    timestamps = []

    def fake_post(url, data=None, headers=None, timeout=30):
        timestamps.append(time.monotonic())
        return _mock_post(LIST_HTML)

    with patch.object(c._session, "post", side_effect=fake_post):
        c.fetch_list_page(page=1)
        c.fetch_list_page(page=2)

    assert len(timestamps) == 2
    assert timestamps[1] - timestamps[0] >= 0.1


# ── 테스트 7: source_url 구성 확인 ───────────────────────────────────────────

def test_source_url_contains_wanted_auth_no(client):
    """상세 조회 결과 source_url에 wantedAuthNo 포함 확인."""
    from worknet_client import WorknetListItem
    item = WorknetListItem("W001", "기업A", "공고A", "", "http://a")

    with patch.object(client._session, "get", return_value=_mock_get(DETAIL_HTML)):
        detail = client.fetch_detail(item)

    assert "W001" in detail.source_url
    assert "work24.go.kr" in detail.source_url
