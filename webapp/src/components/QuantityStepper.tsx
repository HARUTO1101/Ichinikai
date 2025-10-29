import { memo } from 'react'

interface QuantityStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (nextValue: number) => void
  ariaLabel?: string
  decreaseLabel?: string
  increaseLabel?: string
}

export const QuantityStepper = memo(function QuantityStepper({
  value,
  min = 0,
  max,
  onChange,
  ariaLabel,
  decreaseLabel,
  increaseLabel,
}: QuantityStepperProps) {
  const handleDecrease = () => {
    const next = value - 1
    if (next < min) return
    onChange(next)
  }

  const handleIncrease = () => {
    const next = value + 1
    if (typeof max === 'number' && next > max) return
    onChange(next)
  }

  return (
    <div className="quantity-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="quantity-button decrease"
        onClick={handleDecrease}
        aria-label={decreaseLabel ?? '数量を1減らす'}
        disabled={value <= min}
      >
        −
      </button>
      <div className="quantity-value" aria-live="polite">
        {value}
      </div>
      <button
        type="button"
        className="quantity-button increase"
        onClick={handleIncrease}
        aria-label={increaseLabel ?? '数量を1増やす'}
        disabled={typeof max === 'number' && value >= max}
      >
        ＋
      </button>
    </div>
  )
})
