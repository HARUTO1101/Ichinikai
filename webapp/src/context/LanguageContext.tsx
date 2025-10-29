import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type SupportedLanguage = 'ja' | 'en'

interface LanguageContextValue {
  language: SupportedLanguage
  setLanguage: (next: SupportedLanguage) => void
  toggleLanguage: () => void
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window === 'undefined') {
      return 'ja'
    }
    const stored = window.localStorage.getItem('app.language')
    return stored === 'en' ? 'en' : 'ja'
  })

  const setLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app.language', next)
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ja' ? 'en' : 'ja')
  }, [language, setLanguage])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
    }),
    [language, setLanguage, toggleLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
