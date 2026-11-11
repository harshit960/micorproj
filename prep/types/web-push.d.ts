declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string
    expirationTime?: number | null
    keys: { p256dh: string; auth: string }
  }
  export interface SendResult { statusCode: number; body: string; headers: Record<string, string> }
  export class WebPushError extends Error {
    statusCode: number
    body: string
  }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(
    sub: PushSubscription,
    payload?: string,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string },
  ): Promise<SendResult>
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string }
}
