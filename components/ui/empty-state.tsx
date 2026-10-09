import { Icon } from "@/components/ui/icon";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-primary-fixed w-16 h-16 rounded-full flex items-center justify-center mb-4">
        <Icon name={icon} className="text-primary" size={32} />
      </div>
      <h3 className="text-headline-sm text-on-surface mb-2">{title}</h3>
      {description && (
        <p className="text-body-md text-on-surface-variant max-w-md mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
