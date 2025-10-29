import { useLanguage } from '../context/LanguageContext'
import { ORDER_TEXT } from '../i18n/order'
import { OrderCompletePage } from './OrderCompletePage'

export function OrderProgressPage() {
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language]
  const progressTexts = texts.orderProgress
  return (
    <OrderCompletePage
      enableTicketSearch
      ticketNavigationBase="/progress"
      fallbackPath="/progress"
      titleOverride={progressTexts.title}
      descriptionOverride={progressTexts.description}
    />
  )
}
