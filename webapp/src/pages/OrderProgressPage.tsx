import { OrderCompletePage } from './OrderCompletePage'

export function OrderProgressPage() {
  return (
    <OrderCompletePage
      enableTicketSearch
      ticketNavigationBase="/progress"
      fallbackPath="/progress"
      titleOverride="注文の進捗を表示しています"
      descriptionOverride="進捗確認コードでアクセスした注文の状況と受け取りまでの流れをここで確認できます。"
    />
  )
}
