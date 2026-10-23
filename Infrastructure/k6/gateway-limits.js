import http from 'k6/http';
import { BASE_URL, JSON_HEADERS, authHeaders } from './lib/config.js';
import { registerPlayer, login } from './lib/seed.js';

http.setResponseCallback(http.expectedStatuses(200, 429));

function rateWindow(rate, startTime, exec) {
    return {
        executor: 'constant-arrival-rate',
        exec,
        rate,
        timeUnit: '1s',
        duration: '20s',
        startTime,
        preAllocatedVUs: rate,
        maxVUs: rate * 3,
    };
}

export const options = {
    scenarios: {
        anonymous_under: rateWindow(15, '0s', 'anonymous'),
        anonymous_over: rateWindow(40, '25s', 'anonymous'),
        authenticated_over: rateWindow(90, '50s', 'authenticated'),
        login_over: rateWindow(3, '75s', 'loginAgain'),
    },
    thresholds: {
        'http_reqs{scenario:anonymous_under,status:200}': ['count>0'],
        'http_reqs{scenario:anonymous_under,status:429}': ['count==0'],
        'http_reqs{scenario:anonymous_over,status:200}': ['count>0'],
        'http_reqs{scenario:anonymous_over,status:429}': ['count>0'],
        'http_reqs{scenario:authenticated_over,status:200}': ['count>0'],
        'http_reqs{scenario:authenticated_over,status:429}': ['count>0'],
        'http_reqs{scenario:login_over,status:200}': ['count>0'],
        'http_reqs{scenario:login_over,status:429}': ['count>0'],
    },
};

export function setup() {
    const user = registerPlayer('limits');
    return { user, token: login(user) };
}

export function anonymous() {
    http.get(`${BASE_URL}/api/auctions?limit=20`);
}

export function authenticated(data) {
    http.get(`${BASE_URL}/api/auctions?limit=20`, { headers: authHeaders(data.token) });
}

export function loginAgain(data) {
    const body = JSON.stringify({ Email: data.user.Email, Password: data.user.Password });
    http.post(`${BASE_URL}/api/users/login`, body, { headers: JSON_HEADERS });
}
