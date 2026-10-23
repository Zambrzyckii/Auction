export const BASE_URL = __ENV.BASE_URL || 'http://api:8080';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function authHeaders(token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const BOTS_API_KEY = __ENV.BOTS_API_KEY || 'local-dev-bot-api-key';

export function apiKeyHeaders() {
    return { 'Content-Type': 'application/json', 'X-Api-Key': BOTS_API_KEY };
}
