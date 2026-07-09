self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {
        title: 'Incoming Call',
        body: 'You have an incoming call on 9JA Cruse Hub.',
        url: '/home',
    };

    if (event.data) {
        try {
            const json = event.data.json();
            payload = {
                title: json.title || payload.title,
                body: json.body || payload.body,
                url: json.url || payload.url,
            };
        } catch {
            const text = event.data.text();
            if (text) payload.body = text;
        }
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            tag: 'call-invite',
            requireInteraction: true,
            data: { url: payload.url },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/home';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) {
                    client.postMessage({ type: 'open-call-screen' });
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
            return undefined;
        })
    );
});
