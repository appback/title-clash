import { useState, useEffect } from 'react'

// In-memory cache (persists across renders, cleared on page reload)
const cache = {}

// Detect if text is Korean
function isKorean(text) {
  return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)
}

// Detect if text is primarily English/Latin
function isLatin(text) {
  const latin = text.replace(/[^a-zA-Z]/g, '').length
  return latin / text.replace(/\s/g, '').length > 0.5
}

/**
 * Detect the likely language of a text string.
 * Returns 'ko' or 'en'.
 */
function detectLang(text) {
  if (isKorean(text)) return 'ko'
  if (isLatin(text)) return 'en'
  return 'en'
}

/**
 * Translate text using Google Translate free API.
 */
async function translateText(text, targetLang) {
  const key = `${text}:${targetLang}`
  if (cache[key]) return cache[key]

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    const translated = data[0].map(s => s[0]).join('')
    cache[key] = translated
    return translated
  } catch {
    return null
  }
}

/**
 * Hook that returns a translated version of text if it differs from the user's language.
 * Returns null if no translation needed or translation failed.
 *
 * @param {string} text - The original text
 * @param {string} userLang - The user's language ('ko' or 'en')
 * @returns {string|null} Translated text or null
 */
export function useTranslatedText(text, userLang) {
  const [translated, setTranslated] = useState(null)

  useEffect(() => {
    if (!text) {
      setTranslated(null)
      return
    }

    const textLang = detectLang(text)

    // Same language → no translation
    if (textLang === userLang) {
      setTranslated(null)
      return
    }

    // Check cache synchronously
    const key = `${text}:${userLang}`
    if (cache[key]) {
      setTranslated(cache[key])
      return
    }

    let cancelled = false
    translateText(text, userLang).then(result => {
      if (!cancelled && result) setTranslated(result)
    })

    return () => { cancelled = true }
  }, [text, userLang])

  return translated
}
