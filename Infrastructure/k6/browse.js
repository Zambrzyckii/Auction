import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/config.js';
import { registerPlayer, login, waitForItems, createAuction, waitForActive } from './lib/seed.js';

export const options = {
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<67'],
    },
    scenarios: {
        browse: {
            executor: 'constant-arrival-rate',
            rate: Number(__ENV.RATE || 50),
            timeUnit: '1s',
            duration: __ENV.DURATION || '60s',
            preAllocatedVUs: 50,
            maxVUs: 200,
        },
    },
};

export function setup() {
    const seller = registerPlayer('browse');
    const token = login(seller);
    const items = waitForItems(token, 15);
    const auctionIds = items.map((item) => createAuction(token, item.publicItemId, 10, 3600));
    auctionIds.forEach((id) => waitForActive(id, 30));
    return { auctionIds };
}

export default function (data) {
    const roll = Math.random();
    let res;
    if (roll < 0.7) {
        res = http.get(`${BASE_URL}/api/auctions?limit=20`, { tags: { name: 'list' } });
    } else {
        const id = data.auctionIds[Math.floor(Math.random() * data.auctionIds.length)];
        res = roll < 0.9
            ? http.get(`${BASE_URL}/api/auctions/${id}`, { tags: { name: 'detail' } })
            : http.get(`${BASE_URL}/api/auctions/${id}/bids`, { tags: { name: 'bids' } });
    }
    check(res, { 'status 200': (r) => r.status === 200 });
}
