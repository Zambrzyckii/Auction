import http from 'k6/http';
import { fail, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders, apiKeyHeaders } from './config.js';

export function registerPlayer(label) {
    const unique = `${label}${Date.now() % 1000000000}${Math.floor(Math.random() * 1000)}`;
    const user = {
        Email: `${unique}@loadtest.local`,
        Password: 'LoadTest123!',
        Username: unique,
        Name: 'Load',
        Surname: 'Test',
        Birthday: '2000-01-01',
    };
    const res = http.post(`${BASE_URL}/api/users/register`, JSON.stringify(user), { headers: JSON_HEADERS });
    if (res.status >= 300) fail(`register failed: ${res.status} ${res.body}`);
    return user;
}

export function login(user) {
    const body = JSON.stringify({ Email: user.Email, Password: user.Password });
    const res = http.post(`${BASE_URL}/api/users/login`, body, { headers: JSON_HEADERS });
    if (res.status !== 200) fail(`login failed: ${res.status} ${res.body}`);
    return res.json('token');
}

export function getItems(token) {
    const res = http.get(`${BASE_URL}/api/inventory/`, { headers: authHeaders(token) });
    if (res.status !== 200) fail(`inventory failed: ${res.status} ${res.body}`);
    return res.json();
}

export function waitForItems(token, timeoutSeconds) {
    for (let i = 0; i < timeoutSeconds; i++) {
        const items = getItems(token).filter((item) => item.status === 'Available');
        if (items.length > 0) return items;
        sleep(1);
    }
    fail(`no available items after ${timeoutSeconds}s, starter pack not granted`);
}

export function createAuction(token, itemId, startingPrice, durationSeconds) {
    const body = JSON.stringify({
        ItemId: itemId,
        StartingPrice: startingPrice,
        EndsOn: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    });
    const res = http.post(`${BASE_URL}/api/auctions/`, body, { headers: authHeaders(token) });
    if (res.status !== 201) fail(`create auction failed: ${res.status} ${res.body}`);
    return res.json('publicAuctionId');
}

export function waitForActive(auctionId, timeoutSeconds) {
    for (let i = 0; i < timeoutSeconds; i++) {
        const res = http.get(`${BASE_URL}/api/auctions/${auctionId}`);
        if (res.status === 200 && res.json('status') === 'Active') return;
        sleep(1);
    }
    fail(`auction ${auctionId} not active after ${timeoutSeconds}s`);
}

export function fundedBot(label, amount) {
    const unique = `${label}${Date.now() % 1000000000}${Math.floor(Math.random() * 1000)}`;
    const bot = {
        Email: `${unique}@loadtest.local`,
        Password: 'LoadTest123!',
        Username: unique,
        Name: 'Load',
        Surname: 'Bot',
        Birthday: '2000-01-01',
    };
    const res = http.post(`${BASE_URL}/api/users/bots`, JSON.stringify(bot), { headers: apiKeyHeaders() });
    if (res.status >= 300) fail(`bot provisioning failed: ${res.status} ${res.body}`);
    const token = login(bot);
    addFunds(token, amount, 15);
    return token;
}

export function addFunds(token, amount, timeoutSeconds) {
    const body = JSON.stringify({ Amount: amount });
    for (let i = 0; i < timeoutSeconds; i++) {
        const res = http.post(`${BASE_URL}/api/wallets/funds`, body, {
            headers: authHeaders(token),
            responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 404),
        });
        if (res.status < 300) return;
        if (res.status !== 404) fail(`add funds failed: ${res.status} ${res.body}`);
        sleep(1);
    }
    fail(`wallet not created after ${timeoutSeconds}s, outbox lag exceeded`);
}
