import { timingSafeEqual, createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION })

// DAG 스케줄이 KST 02:00 기준이므로 어제 날짜도 KST 기준으로 계산
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function getYesterday(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  kst.setDate(kst.getDate() - 1)
  return kst.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const expected = process.env.ANALYTICS_API_KEY ?? ''
  if (!expected) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
  }

  // SHA-256 해시 후 timingSafeEqual — 길이 체크 제거로 키 길이 노출 방지
  const internalKey = request.headers.get('x-internal-key') ?? ''
  const isValid =
    internalKey.length > 0 &&
    timingSafeEqual(
      createHash('sha256').update(internalKey).digest(),
      createHash('sha256').update(expected).digest(),
    )
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = process.env.S3_EVENTS_BUCKET
  if (!bucket) {
    return NextResponse.json({ error: 'Events bucket not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date') ?? getYesterday()

  // path traversal 방지 — S3 key에 date가 직접 삽입되므로 형식 고정
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const key = `events/processed/${dateParam}/funnel.json`

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const response = await s3.send(command)

    if (!response.Body) {
      return NextResponse.json({ error: 'Empty response from S3' }, { status: 502 })
    }

    const body = await response.Body.transformToString('utf-8')

    try {
      const data = JSON.parse(body)
      return NextResponse.json(data, { status: 200 })
    } catch {
      console.error('[analytics/events] Corrupted funnel JSON', { key })
      return NextResponse.json({ error: 'Corrupted funnel data' }, { status: 502 })
    }
  } catch (err: unknown) {
    if (err instanceof NoSuchKey || (err as { name?: string }).name === 'NoSuchKey') {
      return NextResponse.json({ error: 'Funnel data not found for the given date' }, { status: 404 })
    }
    console.error('[analytics/events] S3 error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
