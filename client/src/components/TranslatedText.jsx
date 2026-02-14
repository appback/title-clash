import { useLang } from '../i18n'
import { useTranslatedText } from '../hooks/useTranslation'

export default function TranslatedText({ text, className }) {
  const { lang } = useLang()
  const translated = useTranslatedText(text, lang)

  if (!translated) return null

  return <div className={className || 'translated-text'}>{translated}</div>
}
