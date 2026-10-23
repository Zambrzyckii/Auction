import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, authHeaders } from './lib/config.js';
import { registerPlayer, login, waitForItems, createAuction, waitForActive, fundedBot } from './lib/seed.js';

const visibilityLag = new Trend('visibility_lag', true);
const bidsAccepted = new Counter('bids_accepted');
const bidsConflicted = new Counter('bids_conflicted');

const BIDDERS = Number(__ENV.BIDDERS || 10);

export const options = {
    scenarios: {
        mixed: {
            executor: 'constant-arrival-rate',
            rate: Number(__ENV.RATE || 30),
            timeUnit: '1s',
            duration: __ENV.DURATION || '60s',
            preAllocatedVUs: 60,
            maxVUs: 300,
        },
    },
};

export function setup() {
    const seller = registerPlayer('mixed');
    const sellerToken = login(seller);
    const items = waitForItems(sellerToken, 15);
    const auctionIds = items.map((item) => createAuction(sellerToken, item.publicItemId, 10, 3600));
    auctionIds.forEach((id) => waitForActive(id, 30));
    const tokens = [];
    for (let i = 0; i < BIDDERS; i++) {
        tokens.push(fundedBot(`mixedbot${i}`, 100000));
    }
    return { auctionIds, tokens };
}

function readBranch(data) {
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
    check(res, { 'read 200': (r) => r.status === 200 });
}

function bidBranch(data) {
    const auctionId = data.auctionIds[Math.floor(Math.random() * data.auctionIds.length)];
    const token = data.tokens[(__VU - 1) % data.tokens.length];
    const detail = http.get(`${BASE_URL}/api/auctions/${auctionId}`, { tags: { name: 'detail' } });
    if (detail.status !== 200) return;
    const amount = Math.round((detail.json('currentPrice') + 1 + Math.random() * 3) * 100) / 100;
    const started = Date.now();
    const res = http.post(`${BASE_URL}/api/auctions/${auctionId}/bid`,
        JSON.stringify({ Amount: amount }), {
            headers: authHeaders(token),
            tags: { name: 'bid' },
            responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 400, 409),
        });
    if (res.status !== 200) {
        bidsConflicted.add(1);
        return;
    }
    bidsAccepted.add(1);
    for (let i = 0; i < 30; i++) {
        const bids = http.get(`${BASE_URL}/api/auctions/${auctionId}/bids`, { tags: { name: 'bids-poll' } });
        if (bids.status === 200 && bids.json().some((bid) => bid.amount === amount)) {
            visibilityLag.add(Date.now() - started);
            return;
        }
        sleep(0.5);
    }
}

export default function (data) {
    if (Math.random() < 0.85) {
        readBranch(data);
    } else {
        bidBranch(data);
    }
}
