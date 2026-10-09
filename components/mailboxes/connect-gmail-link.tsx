import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface ConnectGmailButtonProps {
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
}

/**
 * OAuth must use a full page navigation — not Next.js <Link> (which prefetches via RSC fetch).
 */
export function ConnectGmailLink({
  className,
  children = "Connect Gmail",
  showIcon = false,
}: ConnectGmailButtonProps) {
  return (
    <a
      href="/api/auth/google/start"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-body-md font-bold transition-colors",
        "bg-primary text-on-primary hover:bg-primary-container h-10 px-4 py-2",
        className,
      )}
    >
      {showIcon && <Icon name="add" size={18} />}
      {children}
    </a>
  );
}
