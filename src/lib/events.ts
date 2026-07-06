export const CRUISEHUB_EVENTS = {
    walletUpdated: 'cruisehub-wallet-updated',
    tasksUpdated: 'cruisehub-tasks-updated',
    rateUpdated: 'cruisehub-rate-updated',
} as const;

export function emitCruiseHubEvent(name: string) {
    window.dispatchEvent(new CustomEvent(name));
}

export function onCruiseHubEvent(name: string, handler: () => void) {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
}
