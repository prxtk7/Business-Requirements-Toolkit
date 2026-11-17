import { Compass } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface NotFoundPageProps {
  title?: string;
  message?: string;
  backTo?: { to: string; label: string };
}

export function NotFoundPage({
  title = 'Page not found',
  message = 'The page you are looking for does not exist.',
  backTo = { to: '/', label: 'Go to workspace summary' },
}: NotFoundPageProps) {
  useDocumentTitle(title);
  return (
    <div className="pt-8">
      <EmptyState
        icon={Compass}
        headingLevel="h1"
        title={title}
        description={message}
        action={
          <ButtonLink to={backTo.to} variant="secondary">
            {backTo.label}
          </ButtonLink>
        }
      />
    </div>
  );
}
