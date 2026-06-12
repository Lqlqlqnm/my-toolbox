// Web Push 发送（RFC 8291 + RFC 8188，纯 Cloudflare Workers 实现，无第三方依赖）

import type { Env } from './index'

// ===== 发送推送 =====

export async function sendPushToAll(env: Env, title: string, body: string, tag?: string): Promise<number> {
  const { results: subs } = await env.DB.prepare(
    'SELECT * FROM push_subscriptions'
  ).all<{ id: number; endpoint: string; p256dh: string; auth: string }>()

  if (!subs || subs.length === 0) return 0

  const payload = JSON.stringify({ title, body, tag: tag || 'default' })
  let sent = 0

  for (const sub of subs) {
    try {
      const ok = await sendPush(env, sub, payload)
      if (ok) sent++
      else {
        // 410 Gone = subscription expired, remove it
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run()
      }
    } catch {
      // ignore individual failures
    }
  }

  return sent
}

// ===== 核心推送逻辑 =====

async function sendPush(
  env: Env,
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<boolean> {
  const vapidPublicKey = env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = env.VAPID_PRIVATE_KEY

  // 1. Generate local ECDH key pair
  const localKey = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKey.publicKey)

  // 2. Import subscriber's public key
  const clientPublicKeyBytes = base64UrlDecode(sub.p256dh)
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // 3. ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    localKey.privateKey,
    256
  )

  // 4. Auth secret
  const authSecret = base64UrlDecode(sub.auth)

  // 5. Derive encryption key using HKDF (RFC 8291)
  const ikm = await hkdf(
    new Uint8Array(sharedSecret),
    new Uint8Array(authSecret),
    createInfo('WebPush: info\0', clientPublicKeyBytes, new Uint8Array(localPublicKeyRaw)),
    32
  )

  // 6. Content encryption (RFC 8188)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const prk = await hkdf(new Uint8Array(ikm), salt, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(new Uint8Array(ikm), salt, new TextEncoder().encode('Content-Encoding: nonce\0'), 12)

  // 7. Encrypt payload
  const encryptionKey = await crypto.subtle.importKey('raw', prk, 'AES-GCM', false, ['encrypt'])
  const payloadBytes = new TextEncoder().encode(payload)

  // Pad payload (add 0x02 delimiter + padding)
  const padded = new Uint8Array(payloadBytes.length + 1)
  padded.set(payloadBytes)
  padded[payloadBytes.length] = 2 // delimiter

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    encryptionKey,
    padded
  )

  // 8. Build content body (RFC 8188 header + ciphertext)
  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, padded.length + 16 + 86) // rough estimate
  const localPubBytes = new Uint8Array(localPublicKeyRaw)

  const header = new Uint8Array(86) // salt(16) + rs(4) + idlen(1) + keyid(65)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = 65
  header.set(localPubBytes, 21)

  const body = new Uint8Array(header.length + encrypted.byteLength)
  body.set(header, 0)
  body.set(new Uint8Array(encrypted), header.length)

  // 9. VAPID JWT
  const jwt = await createVapidJwt(sub.endpoint, vapidPublicKey, vapidPrivateKey)

  // 10. Send
  const vapidPubBytes = base64UrlDecode(vapidPublicKey)
  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: body,
  })

  return response.status >= 200 && response.status < 300
}

// ===== VAPID JWT =====

async function createVapidJwt(endpoint: string, publicKey: string, privateKey: string): Promise<string> {
  const audience = new URL(endpoint).origin
  const now = Math.floor(Date.now() / 1000)

  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: now + 86400,
    sub: 'mailto:noreply@hongdalong.qzz.io',
  }))

  const unsignedToken = `${header}.${payload}`
  const unsignedBytes = new TextEncoder().encode(unsignedToken)

  // Import private key
  const privKeyBytes = base64UrlDecode(privateKey)
  const pubKeyBytes = base64UrlDecode(publicKey)

  // Build JWK for ECDSA P-256
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(pubKeyBytes.slice(1, 33)),
    y: base64UrlEncode(pubKeyBytes.slice(33, 65)),
    d: base64UrlEncode(privKeyBytes),
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    unsignedBytes
  )

  // Convert DER signature to raw r||s (64 bytes)
  const sig = derToRaw(new Uint8Array(signature))
  return `${unsignedToken}.${base64UrlEncodeBytes(sig)}`
}

// ===== HKDF =====

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = await crypto.subtle.sign('HMAC', key, salt.length > 0 ? salt : new Uint8Array(32))

  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const infoWithCounter = new Uint8Array(info.length + 1)
  infoWithCounter.set(info)
  infoWithCounter[info.length] = 1

  const result = await crypto.subtle.sign('HMAC', prkKey, infoWithCounter)
  return result.slice(0, length)
}

// ===== Helpers =====

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const info = new Uint8Array(typeBytes.length + clientPublicKey.length + serverPublicKey.length)
  info.set(typeBytes, 0)
  info.set(clientPublicKey, typeBytes.length)
  info.set(serverPublicKey, typeBytes.length + clientPublicKey.length)
  return info
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - base64.length % 4) % 4
  const padded = base64 + '='.repeat(pad)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(str: string | ArrayBuffer): string {
  if (typeof str === 'string') {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
  return base64UrlEncodeBytes(new Uint8Array(str))
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER encoded ECDSA signature to raw r||s
  // If already 64 bytes, it's already raw
  if (der.length === 64) return der

  const raw = new Uint8Array(64)
  // Parse DER: 0x30 len 0x02 rlen r 0x02 slen s
  let offset = 2 // skip 0x30 + total length
  if (der[offset] !== 0x02) return der
  offset++
  const rLen = der[offset++]
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset
  const rDest = rLen < 32 ? 32 - rLen : 0
  raw.set(der.slice(rStart, offset + rLen).slice(0, 32), rDest)

  offset += rLen
  if (der[offset] !== 0x02) return der
  offset++
  const sLen = der[offset++]
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset
  const sDest = sLen < 32 ? 32 + (32 - sLen) : 32
  raw.set(der.slice(sStart, offset + sLen).slice(0, 32), sDest)

  return raw
}
