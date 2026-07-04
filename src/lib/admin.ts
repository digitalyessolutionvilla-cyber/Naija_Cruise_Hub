export const ADMIN_EMAIL = 'delight.careerhub@gmail.com';
export const ADMIN_DEFAULT_PASSWORD = 'password123';

export function normalizeEmail(email?: string | null) {
    return (email ?? '').trim().toLowerCase();
}

export function isAdminEmail(email?: string | null) {
    return normalizeEmail(email) === ADMIN_EMAIL;
}

export function isDefaultAdminCredential(email: string, password: string) {
    return isAdminEmail(email) && password === ADMIN_DEFAULT_PASSWORD;
}
