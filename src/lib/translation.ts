/**
 * Translation service — uses Google Translate's free public endpoint.
 *
 * No API key required. In-memory cache by `${source}|${target}|${text}`
 * so re-rendering chat messages doesn't re-hit the API.
 */

export interface Language {
  code: string
  label: string
  native: string
}

// ─── Supported languages (curated, covers most major global + Indian) ────────
export const LANGUAGES: Language[] = [
  { code: 'auto', label: 'Auto-detect',   native: 'Auto'        },
  { code: 'en',   label: 'English',       native: 'English'     },
  { code: 'hi',   label: 'Hindi',         native: 'हिन्दी'         },
  { code: 'es',   label: 'Spanish',       native: 'Español'     },
  { code: 'fr',   label: 'French',        native: 'Français'    },
  { code: 'de',   label: 'German',        native: 'Deutsch'     },
  { code: 'it',   label: 'Italian',       native: 'Italiano'    },
  { code: 'pt',   label: 'Portuguese',    native: 'Português'   },
  { code: 'ru',   label: 'Russian',       native: 'Русский'     },
  { code: 'zh-CN',label: 'Chinese',       native: '中文'         },
  { code: 'ja',   label: 'Japanese',      native: '日本語'        },
  { code: 'ko',   label: 'Korean',        native: '한국어'        },
  { code: 'ar',   label: 'Arabic',        native: 'العربية'      },
  { code: 'tr',   label: 'Turkish',       native: 'Türkçe'      },
  { code: 'nl',   label: 'Dutch',         native: 'Nederlands'  },
  { code: 'pl',   label: 'Polish',        native: 'Polski'      },
  { code: 'sv',   label: 'Swedish',       native: 'Svenska'     },
  { code: 'el',   label: 'Greek',         native: 'Ελληνικά'    },
  { code: 'iw',   label: 'Hebrew',        native: 'עברית'        },
  { code: 'id',   label: 'Indonesian',    native: 'Indonesia'   },
  { code: 'vi',   label: 'Vietnamese',    native: 'Tiếng Việt'  },
  { code: 'th',   label: 'Thai',          native: 'ไทย'         },
  { code: 'fil',  label: 'Filipino',      native: 'Filipino'    },
  { code: 'ms',   label: 'Malay',         native: 'Melayu'      },
  { code: 'bn',   label: 'Bengali',       native: 'বাংলা'        },
  { code: 'ta',   label: 'Tamil',         native: 'தமிழ்'        },
  { code: 'te',   label: 'Telugu',        native: 'తెలుగు'        },
  { code: 'mr',   label: 'Marathi',       native: 'मराठी'        },
  { code: 'ur',   label: 'Urdu',          native: 'اردو'         },
  { code: 'pa',   label: 'Punjabi',       native: 'ਪੰਜਾਬੀ'         },
  { code: 'gu',   label: 'Gujarati',      native: 'ગુજરાતી'        },
  { code: 'kn',   label: 'Kannada',       native: 'ಕನ್ನಡ'         },
  { code: 'ml',   label: 'Malayalam',     native: 'മലയാളം'      },
  { code: 'ne',   label: 'Nepali',        native: 'नेपाली'         },
  { code: 'fa',   label: 'Persian',       native: 'فارسی'        },
  { code: 'uk',   label: 'Ukrainian',     native: 'Українська'  },
  { code: 'ro',   label: 'Romanian',      native: 'Română'      },
  { code: 'cs',   label: 'Czech',         native: 'Čeština'     },
  { code: 'hu',   label: 'Hungarian',     native: 'Magyar'      },
  { code: 'fi',   label: 'Finnish',       native: 'Suomi'       },
  { code: 'no',   label: 'Norwegian',     native: 'Norsk'       },
  { code: 'da',   label: 'Danish',        native: 'Dansk'       },
  { code: 'sk',   label: 'Slovak',        native: 'Slovenčina'  },
  { code: 'sw',   label: 'Swahili',       native: 'Kiswahili'   },
  { code: 'af',   label: 'Afrikaans',     native: 'Afrikaans'   },
  { code: 'sq',   label: 'Albanian',      native: 'Shqip'       },
  { code: 'hr',   label: 'Croatian',      native: 'Hrvatski'    },
  { code: 'sr',   label: 'Serbian',       native: 'Српски'      },
  { code: 'bg',   label: 'Bulgarian',     native: 'Български'   },
  { code: 'lt',   label: 'Lithuanian',    native: 'Lietuvių'    },
  { code: 'lv',   label: 'Latvian',       native: 'Latviešu'    },
]

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map<string, string>()

function cacheKey(text: string, source: string, target: string): string {
  return `${source}|${target}|${text}`
}

// ─── Translation ──────────────────────────────────────────────────────────────

export interface TranslationResult {
  text:           string
  sourceLanguage: string
}

/**
 * Translate `text` from `source` to `target`. Pass 'auto' as source to
 * have Google detect it. Returns the original text on error.
 */
export async function translate(
  text:   string,
  target: string,
  source: string = 'auto',
): Promise<TranslationResult> {
  if (!text.trim())          return { text, sourceLanguage: source }
  if (source === target)     return { text, sourceLanguage: source }

  const key = cacheKey(text, source, target)
  if (cache.has(key))        return { text: cache.get(key)!, sourceLanguage: source }

  try {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
      `&dt=t&q=${encodeURIComponent(text)}`

    const res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)

    // Response shape: [[[translated, original, ...], ...], ..., detectedSource]
    const data = await res.json()
    const translated = Array.isArray(data?.[0])
      ? data[0].map((row: unknown[]) => row[0]).join('')
      : text
    const detected = typeof data?.[2] === 'string' ? data[2] : source

    cache.set(key, translated)
    return { text: translated, sourceLanguage: detected }
  } catch (err) {
    console.warn('[translate] failed', err)
    return { text, sourceLanguage: source }
  }
}

/**
 * Quick test: is this text purely emojis/punctuation/whitespace?
 * If so, skip translation — there's nothing meaningful to translate.
 */
export function isUntranslatable(text: string): boolean {
  const stripped = text.replace(/\s/g, '')
  if (!stripped.length) return true
  return !/\p{L}/u.test(stripped)
}
