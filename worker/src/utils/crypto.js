import bcrypt from 'bcryptjs'

const SESSION_DAYS = 7
const REMEMBER_SESSION_DAYS = 30

export async function verifyPassword(password, storedHash) {
  if (storedHash?.startsWith('$2a$') || storedHash?.startsWith('$2b$') || storedHash?.startsWith('$2y$')) {
    return bcrypt.compare(password, storedHash)
  }

  const [scheme, iterationsText, salt, hash] = String(storedHash ?? '').split('$')

  if (scheme !== 'pbkdf2' || !iterationsText || !salt || !hash) {
    return false
  }

  const iterations = Number(iterationsText)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations },
    keyMaterial,
    256
  )

  return constantTimeEqual(bytesToBase64Url(new Uint8Array(derivedBits)), hash)
}

export async function createAuthToken(env, userId, remember) {
  const days = remember ? REMEMBER_SESSION_DAYS : SESSION_DAYS
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + days * 24 * 60 * 60,
  }
  const encodedPayload = stringToBase64Url(JSON.stringify(payload))
  const signature = await signTokenPayload(env, encodedPayload)

  return `${encodedPayload}.${signature}`
}

export async function verifyAuthToken(env, token) {
  const [encodedPayload, signature] = String(token).split('.')

  if (!encodedPayload || !signature) return null

  const expectedSignature = await signTokenPayload(env, encodedPayload)
  if (!constantTimeEqual(signature, expectedSignature)) return null

  const payload = JSON.parse(base64UrlToString(encodedPayload))
  if (!payload?.sub || !payload?.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null

  return payload
}

export async function signTokenPayload(env, encodedPayload) {
  const secret = env.AUTH_SECRET ?? env.JWT_SECRET ?? 'wifimex-central-worker-auth'
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload))

  return bytesToBase64Url(new Uint8Array(signature))
}

export function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function stringToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

export function base64UrlToString(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false

  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}
