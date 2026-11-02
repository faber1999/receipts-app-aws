import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: { absolute: 'Receipts App · Tus gastos desde una foto' },
};

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface ExtractedField {
  label: string;
  value: string;
}

const sampleFields: ExtractedField[] = [
  { label: 'Comercio', value: 'Mercado La Cosecha' },
  { label: 'Fecha', value: '28 oct 2026' },
];

export default function Home() {
  return (
    <div className="grid flex-1 items-center gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-16">
      <section aria-labelledby="titulo-inicio" className="flex flex-col items-start">
        <h1
          id="titulo-inicio"
          className="animate-rise font-display text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.02em] text-ink sm:text-5xl"
        >
          Tus gastos, claros desde una foto.
        </h1>
        <p className="mt-5 max-w-[34rem] animate-rise text-lg leading-relaxed text-ink-muted [animation-delay:var(--duration-stagger)]">
          Sube la foto de un recibo y la IA extrae el comercio, el total, la fecha y la categoría. Tú solo revisas en
          qué se va tu dinero, mes a mes.
        </p>
        <div className="mt-8 flex w-full animate-rise flex-col gap-3 [animation-delay:calc(var(--duration-stagger)*2)] sm:w-auto sm:flex-row">
          <ButtonLink href="/registro" size="lg">
            Crear cuenta
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">
            Iniciar sesión
          </ButtonLink>
        </div>
      </section>

      <ReceiptPreview />
    </div>
  );
}

/** Static illustration of an extracted receipt; mirrors the real expense data model. */
function ReceiptPreview() {
  return (
    <figure className="mx-auto w-full max-w-sm animate-rise [animation-delay:calc(var(--duration-stagger)*3)] md:mx-0 md:justify-self-end">
      {/* drop-shadow lives on the wrapper because the mask below clips box-shadow */}
      <div className="receipt-shadow">
        <div className="receipt-edge rounded-t-lg bg-surface px-6 pt-6 pb-9">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">Datos extraídos</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-ink">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
              >
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
              Procesado
            </span>
          </div>

          <dl className="mt-5 divide-y divide-dashed divide-line border-y border-dashed border-line">
            {sampleFields.map((field) => (
              <div key={field.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-ink-muted">{field.label}</dt>
                <dd className="text-right text-sm font-medium text-ink">{field.value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-ink-muted">Categoría</dt>
              <dd>
                <span className="rounded-sm bg-surface-muted px-2 py-0.5 text-sm font-medium text-ink">
                  Supermercado
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-ink">Total</p>
            <p className="font-display text-3xl font-semibold tracking-tight text-ink tabular-nums">
              {money.format(86450)}
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-sm text-ink-muted">
        Supermercado este mes: <span className="font-medium text-ink tabular-nums">{money.format(412300)}</span>
      </figcaption>
    </figure>
  );
}
