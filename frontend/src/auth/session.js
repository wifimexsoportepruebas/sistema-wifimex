const TOKEN_KEY = 'wifimex_token'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

export function saveToken(token, storageType = 'local') {
  const storage = storageType === 'session' ? sessionStorage : localStorage
  const otherStorage = storageType === 'session' ? localStorage : sessionStorage

  otherStorage.removeItem(TOKEN_KEY)
  storage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}
