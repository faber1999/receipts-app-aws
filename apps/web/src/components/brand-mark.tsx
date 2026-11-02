import { cn } from '@/lib/cn';

export interface BrandMarkProps {
  className?: string;
}

/** Receipt glyph on an evergreen tile. Decorative: pair it with the product name. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M10 6.5h12a1 1 0 0 1 1 1v18l-2.33-1.5-2.34 1.5-2.33-1.5-2.33 1.5-2.34-1.5L9 25.5v-18a1 1 0 0 1 1-1Z"
        className="fill-on-primary"
      />
      <path
        d="M12.5 11.5h7M12.5 15h7M12.5 18.5h4"
        strokeWidth={1.75}
        strokeLinecap="round"
        className="stroke-primary"
      />
    </svg>
  );
}
