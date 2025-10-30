import { memo } from 'react'

interface QuantityStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (nextValue: number) => void
  ariaLabel?: string
  decreaseLabel?: string
  increaseLabel?: string
  disabled?: boolean
}

export const QuantityStepper = memo(function QuantityStepper({
  value,
  min = 0,
  max,
  onChange,
  ariaLabel,
  decreaseLabel,
  increaseLabel,
  disabled = false,
}: QuantityStepperProps) {
  const handleDecrease = () => {
    if (disabled) return
    const next = value - 1
    if (next < min) return
    onChange(next)
  }

  const handleIncrease = () => {
    if (disabled) return
    const next = value + 1
    if (typeof max === 'number' && next > max) return
    onChange(next)
  }

  const wrapperClassName = `quantity-stepper${disabled ? ' disabled' : ''}`

  return (
    <div className={wrapperClassName} role="group" aria-label={ariaLabel} aria-disabled={disabled}>
      <button
        type="button"
        className="quantity-button decrease"
        onClick={handleDecrease}
        aria-label={decreaseLabel ?? '数量を1減らす'}
        disabled={disabled || value <= min}
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
        disabled={disabled || (typeof max === 'number' && value >= max)}
      >
        ＋
      </button>
    </div>
  )
})
