import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

export function Notice({ message, error = false }: { message?: string; error?: boolean }) {
  return <div className={cn(`notice${message ? '' : ' hidden'}${error ? ' error' : ''}`)}>{message || ''}</div>;
}
