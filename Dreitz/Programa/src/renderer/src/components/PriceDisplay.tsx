import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';
import { useCurrency } from '../contexts/CurrencyContext';

/**
 * Pricing display "premium":
 *  - Precio tachado pequeño arriba si hay descuento
 *  - Precio final HUGE con tabular-nums
 *  - Chip de descuento con gradient + shimmer
 *  - "Ahorras S/.X" debajo, opcional
 *  - Anima el número final cuando cambia (vía AnimatedNumber)
 */
export default function PriceDisplay({
  priceInitial,
  priceFinal,
  discountPercent,
  size = 'md',
  showSavings = true,
  inline = false
}: {
  priceInitial: number;
  priceFinal: number;
  discountPercent: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSavings?: boolean;
  inline?: boolean;
}) {
  const { format } = useCurrency();
  const hasDiscount = discountPercent > 0;
  const savings = +(priceInitial - priceFinal).toFixed(2);

  const sizeClass =
    size === 'xl' ? 'text-4xl' :
    size === 'lg' ? 'text-3xl' :
    size === 'md' ? 'text-xl' : 'text-base';

  const Container = inline ? 'span' : 'div';

  return (
    <Container className={inline ? 'inline-flex items-baseline gap-2' : ''}>
      {hasDiscount && (
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          className={`discount-chip px-2 py-0.5 rounded-md mr-2 inline-block ${size === 'xl' ? 'text-base' : 'text-xs'}`}
        >
          -{discountPercent}%
        </motion.span>
      )}
      {hasDiscount && !inline && (
        <div className="price-strike text-fg-subtle text-xs mb-0.5">{format(priceInitial)}</div>
      )}
      {hasDiscount && inline && (
        <span className="price-strike text-fg-subtle text-xs">{format(priceInitial)}</span>
      )}
      <span className={`price-final ${sizeClass} text-fg`}>
        <AnimatedNumber value={priceFinal} format={(v) => format(v)} />
      </span>
      {!inline && showSavings && hasDiscount && savings > 0 && (
        <div className="text-[11px] text-green-400 mt-0.5">Ahorras {format(savings)}</div>
      )}
    </Container>
  );
}
