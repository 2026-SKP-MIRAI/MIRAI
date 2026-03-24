"""
worknet_client — 고용24(워크넷) 주요기업 공채속보 크롤러
테마: S00074 (주요기업 공채속보) — 코스피/코스닥 상장사·대기업 중심

목록: POST https://www.work24.go.kr/wk/a/b/1700/themeEmpInfoSrchListPost.do
      (GET으로 세션/CSRF 선확보 필요)
상세: GET  https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup
from airflow.models import Variable

log = logging.getLogger(__name__)

LIST_PAGE_URL = "https://www.work24.go.kr/wk/a/b/1700/themeEmpInfoSrchList.do"
LIST_POST_URL = "https://www.work24.go.kr/wk/a/b/1700/themeEmpInfoSrchListPost.do"
DETAIL_URL = "https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do"

# 주요기업 공채속보 테마 코드 (코스피/코스닥 상장사·대기업 중심)
THEME_CODE = "S00074"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://www.work24.go.kr/",
}


@dataclass
class WorknetListItem:
    wanted_auth_no: str
    company: str
    title: str
    job_cd: str
    source_url: str


@dataclass
class WorknetDetail:
    wanted_auth_no: str
    company: str
    title: str
    job_cd: str
    job_role: str       # 직종명
    source_url: str
    pref_cond: str      # 우대사항 원문
    job_content: str    # 직무내용
    region: str
    sal: str
    career: str
    education: str


class WorknetClient:
    def __init__(self, rate_limit_sec: float | None = None) -> None:
        self.rate_limit_sec = rate_limit_sec if rate_limit_sec is not None else float(
            Variable.get("WORKNET_RATE_LIMIT_SEC", default_var="1.0")
        )
        self._last_call: float = 0.0
        self._session = requests.Session()
        self._session.headers.update(_HEADERS)
        self._csrf: str = ""

    # ── 내부 유틸 ─────────────────────────────────────────────────────────────

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_call
        wait = self.rate_limit_sec - elapsed
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()

    def _init_session(self) -> None:
        """GET으로 세션 쿠키·CSRF 토큰 확보."""
        self._throttle()
        resp = self._session.get(
            LIST_PAGE_URL,
            params={"pageIndex": 1, "thmaHrplCd": THEME_CODE},
            timeout=30,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        csrf_el = soup.select_one("meta[name='_csrf']")
        self._csrf = csrf_el["content"] if csrf_el else ""
        log.info("세션 초기화 완료 (CSRF: %s)", "있음" if self._csrf else "없음")

    def _post_list_soup(self, page: int, result_cnt: int = 100) -> BeautifulSoup:
        self._throttle()
        resp = self._session.post(
            LIST_POST_URL,
            data={
                "pageIndex": str(page),
                "currentPageNo": str(page),
                "resultCnt": str(result_cnt),
                "thmaHrplCd": THEME_CODE,
                "sortField": "DATE",
                "sortOrderBy": "DESC",
                "searchMode": "Y",
                "_csrf": self._csrf,
            },
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": f"{LIST_PAGE_URL}?pageIndex=1&thmaHrplCd={THEME_CODE}",
            },
            timeout=30,
        )
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")

    def _get_soup(self, url: str, params: dict) -> BeautifulSoup:
        self._throttle()
        resp = self._session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")

    @staticmethod
    def _clean(text: str) -> str:
        """HTML 엔티티·공백 정리."""
        return re.sub(r"\s+", " ", text).strip()

    # ── 목록 조회 ─────────────────────────────────────────────────────────────

    def fetch_list_page(
        self, page: int = 1, result_cnt: int = 100
    ) -> tuple[list[WorknetListItem], int]:
        """주요기업 공채속보 1페이지 POST 조회. (items, total_count) 반환."""
        soup = self._post_list_soup(page, result_cnt)

        total_el = soup.select_one("span.txt_total")
        total = int(re.sub(r"[^0-9]", "", total_el.text)) if total_el else 0

        items: list[WorknetListItem] = []
        seen: set[str] = set()
        pattern = re.compile(r"wantedAuthNo=([A-Z0-9]+)")

        for a in soup.find_all("a", href=True):
            m = pattern.search(a["href"])
            if not m:
                continue
            auth_no = m.group(1)
            if auth_no in seen:
                continue
            seen.add(auth_no)

            row = a.find_parent("tr") or a.find_parent("li") or a.find_parent("div")
            company = ""
            title = self._clean(a.get_text())
            if row:
                corp_el = row.select_one(".corp_info strong, .corp_nm, .company")
                if corp_el:
                    company = self._clean(corp_el.get_text())

            items.append(WorknetListItem(
                wanted_auth_no=auth_no,
                company=company,
                title=title,
                job_cd="",
                source_url=(
                    f"{DETAIL_URL}?wantedAuthNo={auth_no}"
                    "&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet"
                ),
            ))

        return items, total

    def fetch_all_list(self, max_pages: int | None = None) -> list[WorknetListItem]:
        """주요기업 공채속보 전체 목록 수집. 중복 wantedAuthNo 제거.

        Args:
            max_pages: 최대 페이지 수. None이면 전체 수집.
                       예) max_pages=1 → 최신 100건만 수집.
        """
        self._init_session()

        seen: set[str] = set()
        all_items: list[WorknetListItem] = []
        page = 1

        while True:
            try:
                items, total = self.fetch_list_page(page=page)
            except Exception as e:
                log.error("fetch_list_page error [page=%d]: %s", page, e)
                break

            new = [it for it in items if it.wanted_auth_no not in seen]
            for it in new:
                seen.add(it.wanted_auth_no)
            all_items.extend(new)
            log.info("page=%d: %d건 수집, 누적 %d건 (전체 %d건)", page, len(new), len(all_items), total)

            reached_max = max_pages is not None and page >= max_pages
            if not items or page * 100 >= total or reached_max:
                break
            page += 1

        log.info("fetch_all_list 완료: 총 %d건", len(all_items))
        return all_items

    # ── 상세 조회 ─────────────────────────────────────────────────────────────

    def fetch_detail(self, item: WorknetListItem) -> WorknetDetail:
        """단건 상세 조회. 우대사항(pref_cond) + 직무내용 포함."""
        soup = self._get_soup(DETAIL_URL, {
            "wantedAuthNo": item.wanted_auth_no,
            "infoTypeCd": "VALIDATION",
            "infoTypeGroup": "tb_workinfoworknet",
        })

        # 기업명, 공고명
        company_el = soup.select_one("p.corp_info strong")
        company = self._clean(company_el.get_text()) if company_el else item.company

        title_el = soup.select_one("strong.title")
        title = self._clean(title_el.get_text()) if title_el else item.title

        # 직무내용 + 직종명 — tab-panel01
        job_content = ""
        job_role = ""
        panel01 = soup.find("div", id="tab-panel01")
        if panel01:
            fold = panel01.select_one("div.fold")
            if fold:
                job_content = self._clean(fold.get_text())
            for row in panel01.select("tr"):
                th = row.select_one("th")
                td = row.select_one("td")
                if th and td and "직종" in self._clean(th.get_text()):
                    job_role = self._clean(td.get_text())
                    break

        # 우대사항 — tab-panel03 의 th/td 쌍 텍스트 수집
        pref_cond = ""
        panel03 = soup.find("div", id="tab-panel03")
        if panel03:
            parts: list[str] = []
            for row in panel03.select("tr"):
                th = row.select_one("th")
                td = row.select_one("td")
                if th and td:
                    val = self._clean(td.get_text())
                    if val and val != "-":
                        label = self._clean(th.get_text())
                        parts.append(f"{label}: {val}")
            pref_cond = " / ".join(parts)

        # 근무조건 — tab-panel02 에서 지역·급여·경력·학력 추출
        region = sal = career = education = ""
        panel02 = soup.find("div", id="tab-panel02")
        if panel02:
            for row in panel02.select("tr"):
                th = row.select_one("th")
                td = row.select_one("td")
                if not (th and td):
                    continue
                label = self._clean(th.get_text())
                val = self._clean(td.get_text())
                if "근무지역" in label or "지역" in label:
                    region = val
                elif "임금" in label or "급여" in label or "월급" in label:
                    sal = val
                elif "경력" in label:
                    career = val
                elif "학력" in label:
                    education = val

        return WorknetDetail(
            wanted_auth_no=item.wanted_auth_no,
            company=company,
            title=title,
            job_cd=item.job_cd,
            job_role=job_role,
            source_url=(
                f"{DETAIL_URL}?wantedAuthNo={item.wanted_auth_no}"
                "&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet"
            ),
            pref_cond=pref_cond,
            job_content=job_content,
            region=region,
            sal=sal,
            career=career,
            education=education,
        )

    def fetch_details_batch(
        self, items: list[WorknetListItem]
    ) -> list[WorknetDetail]:
        """목록 아이템 전체 상세 조회. 에러 발생 항목은 skip."""
        details: list[WorknetDetail] = []
        for i, item in enumerate(items):
            try:
                detail = self.fetch_detail(item)
                details.append(detail)
            except Exception as e:
                log.warning(
                    "fetch_detail skip [%s, %s]: %s",
                    item.wanted_auth_no, item.title, e,
                )
            if (i + 1) % 50 == 0:
                log.info("상세조회 진행: %d / %d", i + 1, len(items))

        log.info("fetch_details_batch 완료: %d / %d건", len(details), len(items))
        return details
