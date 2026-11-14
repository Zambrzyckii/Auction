import { HttpErrorResponse } from '@angular/common/http';
import { NEVER, of, throwError } from 'rxjs';
import { actionState } from './action-state';

function serverError(text: string): HttpErrorResponse {
  return new HttpErrorResponse({ status: 400, error: { error: text } });
}

describe('actionState', () => {
  it('reports success and finishes the pending window', () => {
    const state = actionState();
    const seen: string[] = [];
    state.run(of('ok'), (result) => seen.push(result));
    expect(seen).toEqual(['ok']);
    expect(state.pending()).toBe(false);
    expect(state.notice()).toBeNull();
  });

  it('stores the server text on failure and calls the error hook', () => {
    const state = actionState();
    let hooked = false;
    state.run(
      throwError(() => serverError('Nope')),
      undefined,
      () => (hooked = true),
    );
    expect(state.notice()).toBe('Nope');
    expect(state.pending()).toBe(false);
    expect(hooked).toBe(true);
  });

  it('ignores a second run while one is in flight', () => {
    const state = actionState();
    let calls = 0;
    state.run(NEVER);
    state.run(of('x'), () => calls++);
    expect(state.pending()).toBe(true);
    expect(calls).toBe(0);
  });

  it('clears the previous notice when a new run starts', () => {
    const state = actionState();
    state.run(throwError(() => serverError('Nope')));
    state.run(NEVER);
    expect(state.notice()).toBeNull();
  });

  it('lets a success callback set its own notice', () => {
    const state = actionState();
    state.run(of(null), () => state.notice.set('Invite sent'));
    expect(state.notice()).toBe('Invite sent');
  });
});
