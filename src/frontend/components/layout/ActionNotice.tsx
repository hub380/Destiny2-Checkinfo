import { css, uiClasses } from '@frontend/lib/cn';

const cn = (classNames: string) => css(uiClasses, classNames);

type ActionNoticeProps = {
  message?: string;
  error?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ActionNotice({ message, error = false, onRetry, retryLabel = '重试' }: ActionNoticeProps) {
  if (!message) return <div className={cn('notice hidden')} />;
  return (
    <div className={cn(`notice action-notice${error ? ' error' : ''}`)} role="alert" aria-live="assertive">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={cn('notice-retry')} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
