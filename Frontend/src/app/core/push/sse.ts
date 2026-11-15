export interface SseEvent {
  readonly event: string;
  readonly data: string;
  readonly id: string | null;
}

export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  let rest = buffer.replace(/\r\n/g, '\n');
  let boundary = rest.indexOf('\n\n');
  while (boundary >= 0) {
    const parsed = parseBlock(rest.slice(0, boundary));
    if (parsed !== null) {
      events.push(parsed);
    }
    rest = rest.slice(boundary + 2);
    boundary = rest.indexOf('\n\n');
  }
  return { events, rest };
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message';
  let id: string | null = null;
  const data: string[] = [];
  let fields = 0;
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    fields += 1;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      data.push(value);
    } else if (field === 'id') {
      id = value;
    }
  }
  return fields === 0 ? null : { event, data: data.join('\n'), id };
}
