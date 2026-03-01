# engine/docs/

## 목적
엔진 설계 문서 보관. 서비스 개발자가 엔진 API 계약을 확인하는 곳.

## 구조
```
engine/docs/
└── INTERFACE.md   타입 정의·함수 시그니처·계약 (Week 1, 3/5 마감)
```

## 역할
- INTERFACE.md가 엔진의 공개 계약 (public contract)
- 서비스 skeleton → INTERFACE.md → 엔진 구현 순서 (outside-in)
- 서비스 개발자는 이 파일만 보고 엔진 사용법을 알 수 있어야 함
- 엔진 내부 구현이 바뀌어도 INTERFACE.md 계약은 서비스와 합의 후 변경
