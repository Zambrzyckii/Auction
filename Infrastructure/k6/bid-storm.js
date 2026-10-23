import http from 'k6/http';
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, authHeaders } from './lib/config.js';
import { registerPlayer, login, waitForItems, createAuction, waitForActive, fundedBot } from './lib/seed.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

const accepted = new Counter('bids_accepted');
const conflicted = new Counter('bids_conflicted');
const rejected = new Counter('bids_rejected');

const BIDDERS = Number(__ENV.BIDDERS || 10);

export const options = {
    scenarios: {
        storm: {
            executor: 'constant-vus',
            vus: BIDDERS,
            duration: __ENV.DURATION || '60s',
        },
    },
};

export function setup() {
    const seller = registerPlayer('storm');
    const sellerToken = login(seller);
    const items = waitForItems(sellerToken, 15);
    const auctionId = createAuction(sellerToken, items[0].publicItemId, 10, 3600);
    waitForActive(auctionId, 30);
    const tokens = [];
    for (let i = 0; i < BIDDERS; i++) {
        tokens.push(fundedBot(`stormbot${i}`, 100000));
    }
    return { auctionId, tokens };
}

export default function (data) {
    const token = data.tokens[(__VU - 1) % data.tokens.length];
    const detail = http.get(`${BASE_URL}/api/auctions/${data.auctionId}`, { tags: { name: 'detail' } });
    if (detail.status !== 200) {
        rejected.add(1);
        return;
    }
    const amount = Math.round((detail.json('currentPrice') + 1 + Math.random() * 5) * 100) / 100;
    const res = http.post(`${BASE_URL}/api/auctions/${data.auctionId}/bid`,
        JSON.stringify({ Amount: amount }), { headers: authHeaders(token), tags: { name: 'bid' } });
    if (res.status === 200) accepted.add(1);
    else if (res.status === 409) conflicted.add(1);
    else rejected.add(1);
    sleep(Math.random() * 0.3);
}
