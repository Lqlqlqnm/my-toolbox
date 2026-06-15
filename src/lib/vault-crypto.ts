// 密码本加密工具 - Web Crypto AES-256-GCM

const VERIFY_PLAINTEXT = 'my-toolbox-vault-verify'

// 从主密码派生 AES 密钥
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// 加密
export async function encrypt(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

// 解密
export async function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const dec = new TextDecoder()
  const encData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivData }, key, encData)
  return dec.decode(decrypted)
}

// 首次设置主密码
export async function setupMasterPassword(password: string): Promise<{ salt: string; verify: string; verifyIv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const { ciphertext, iv } = await encrypt(VERIFY_PLAINTEXT, key)
  return {
    salt: btoa(String.fromCharCode(...salt)),
    verify: ciphertext,
    verifyIv: iv,
  }
}

// 验证主密码
export async function verifyMasterPassword(password: string, saltB64: string, verifyB64: string, verifyIvB64: string): Promise<CryptoKey | null> {
  try {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    const key = await deriveKey(password, salt)
    const result = await decrypt(verifyB64, verifyIvB64, key)
    return result === VERIFY_PLAINTEXT ? key : null
  } catch {
    return null
  }
}

// 从 salt 派生 key（已验证后直接用）
export async function getKeyFromPassword(password: string, saltB64: string): Promise<CryptoKey> {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
  return deriveKey(password, salt)
}
