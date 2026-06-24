import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

export function Notice({ message, error = false }: { message?: string; error?: boolean }) {
  if (!message) return <div className={cn('notice hidden')} />;
  return (
    <div className={cn(`notice${error ? ' error' : ''}`)} role="alert" aria-live="assertive">
      {message}
    </div>
  );
}
