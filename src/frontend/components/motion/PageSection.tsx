import type { ReactNode } from 'react';
import { css, motionClasses } from '@frontend/lib/cn';

type PageSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

/** Panel wrapper with consistent enter animation. */
export function PageSection({ children, className, id }: PageSectionProps) {
  return (
    <section id={id} className={css(motionClasses, `panelEnter ${className || ''}`)}>
      {children}
    </section>
  );
}
