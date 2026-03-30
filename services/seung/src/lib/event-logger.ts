import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

const s3 = new S3Client({ region: process.env.AWS_REGION })

export type EventType =
  | 'session_started'
  | 'answer_submitted'
  | 'session_abandoned'
  | 'report_generated'
  | 'report_viewed'

export interface UserEvent {
  event_type: EventType
  user_id: string
  session_id: string
  timestamp?: string
  properties: Record<string, unknown>
}

export async function logEvent(event: UserEvent): Promise<void> {
  const bucket = process.env.S3_EVENTS_BUCKET
  if (!bucket) {
    console.warn('[event-logger] S3_EVENTS_BUCKET not set — skipping event log')
    return
  }

  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const key = `events/${yyyy}/${mm}/${dd}/${now.getTime()}-${randomUUID()}.json`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify({ ...event, timestamp: event.timestamp ?? now.toISOString() }),
      ContentType: 'application/json',
    })
  )
}
