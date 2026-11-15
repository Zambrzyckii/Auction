import { parseSseChunk } from './sse';

describe('parseSseChunk', () => {
  it('parses one complete event with its name and data', () => {
    const { events, rest } = parseSseChunk('event: connected\ndata: {}\n\n');
    expect(events).toEqual([{ event: 'connected', data: '{}', id: null }]);
    expect(rest).toBe('');
  });

  it('parses two events arriving in one chunk', () => {
    const { events } = parseSseChunk(
      'event: AuctionChanged\ndata: {"auctionId":"a-1"}\n\nevent: AuctionListChanged\ndata: {}\n\n',
    );
    expect(events.map((e) => e.event)).toEqual(['AuctionChanged', 'AuctionListChanged']);
    expect(events[0].data).toBe('{"auctionId":"a-1"}');
  });

  it('keeps an unfinished event as the rest and completes it with the next chunk', () => {
    const first = parseSseChunk('event: WalletCha');
    expect(first.events).toEqual([]);
    expect(first.rest).toBe('event: WalletCha');
    const second = parseSseChunk(first.rest + 'nged\ndata: {}\n\n');
    expect(second.events).toEqual([{ event: 'WalletChanged', data: '{}', id: null }]);
    expect(second.rest).toBe('');
  });

  it('ignores comment lines and a comment-only block', () => {
    const { events, rest } = parseSseChunk(': keep-alive\n\n: ping\nevent: ping\ndata: {}\n\n');
    expect(events).toEqual([{ event: 'ping', data: '{}', id: null }]);
    expect(rest).toBe('');
  });

  it('joins multi-line data with newlines and reads the id field', () => {
    const { events } = parseSseChunk('id: 7\ndata: first\ndata: second\n\n');
    expect(events).toEqual([{ event: 'message', data: 'first\nsecond', id: '7' }]);
  });

  it('accepts CRLF line endings', () => {
    const { events } = parseSseChunk('event: ping\r\ndata: {}\r\n\r\n');
    expect(events).toEqual([{ event: 'ping', data: '{}', id: null }]);
  });
});
