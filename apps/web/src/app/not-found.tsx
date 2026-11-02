import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Página no encontrada',
};

export default function NotFound() {
  return (
    <section aria-labelledby="titulo-404" className="flex flex-1 flex-col items-start justify-center gap-5 py-8">
      <p
        className="font-display text-6xl font-semibold tracking-tight text-line-strong tabular-nums"
        aria-hidden="true"
      >
        404
      </p>
      <h1 id="titulo-404" className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
        No encontramos esta página
      </h1>
      <p className="max-w-[34rem] text-base leading-relaxed text-ink-muted">
        Puede que el enlace esté mal escrito o que la página ya no exista. Tus recibos y gastos siguen a salvo.
      </p>
      <ButtonLink href="/" className="mt-2">
        Volver al inicio
      </ButtonLink>
    </section>
  );
}
