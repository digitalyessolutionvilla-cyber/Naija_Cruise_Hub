import { cn } from '@/lib/utils';

interface AppLogoProps {
    className?: string;
    compact?: boolean;
    alt?: string;
}

export function AppLogo({ className, compact = false, alt = '9JA Cruse Hub logo' }: AppLogoProps) {
    if (compact) {
        return (
            <img
                src="/favicon.svg"
                alt={alt}
                className={cn('h-8 w-8 object-contain', className)}
                loading="eager"
            />
        );
    }

    return (
        <img
            src="/logo-9ja-cruise-hub.svg"
            alt={alt}
            className={cn('h-8 w-auto object-contain', className)}
            loading="eager"
        />
    );
}