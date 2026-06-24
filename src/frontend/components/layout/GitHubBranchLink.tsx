import { REPO_URL } from '@frontend/lib/constants';
import { css, uiClasses } from '@frontend/lib/cn';
import { GitHubIcon } from '../icons';

const cn = (classNames: string) => css(uiClasses, classNames);

export function GitHubBranchLink() {
  return (
    <a
      className={cn('github-link')}
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      title="查看 GitHub 仓库"
      aria-label="查看 GitHub 仓库"
    >
      <GitHubIcon />
      <span>GitHub</span>
    </a>
  );
}
