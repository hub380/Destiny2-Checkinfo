import { css, uiClasses } from '@frontend/lib/cn';
import { themeLabel, useTheme } from '@frontend/hooks/useTheme';

const cn = (classNames: string | false | null | undefined) => css(uiClasses, classNames);

export function ThemeToggle() {
  const { preference, cycle } = useTheme();

  return (
    <button
      type="button"
      className={cn('theme-toggle')}
      onClick={cycle}
      title={`主题：${themeLabel(preference)}（点击切换）`}
      aria-label={`主题：${themeLabel(preference)}`}
    >
      {preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '◐'}
      <span>{themeLabel(preference)}</span>
    </button>
  );
}
