import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeightProbe } from './height-probe';

@Component({
  imports: [HeightProbe],
  template: `<div appHeightProbe #p="heightProbe"></div>`,
})
class Host {}

class FakeResizeObserver {
  static instance: FakeResizeObserver | undefined;
  observed = 0;
  disconnected = 0;

  constructor(readonly callback: () => void) {
    FakeResizeObserver.instance = this;
  }

  observe(): void {
    this.observed++;
  }

  disconnect(): void {
    this.disconnected++;
  }
}

describe('HeightProbe', () => {
  let fixture: ComponentFixture<Host>;

  function create(): HeightProbe {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.debugElement.children[0].injector.get(HeightProbe);
  }

  beforeEach(() => {
    FakeResizeObserver.instance = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports its host height from a ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const probe = create();
    const host = fixture.nativeElement.querySelector('div') as HTMLElement;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ height: 236.4 } as DOMRect);

    FakeResizeObserver.instance?.callback();

    expect(FakeResizeObserver.instance?.observed).toBe(1);
    expect(probe.height()).toBe(237);
  });

  it('stays at 0 without a ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    expect(() => create()).not.toThrow();
    expect(fixture.debugElement.children[0].injector.get(HeightProbe).height()).toBe(0);
  });

  it('disconnects on destroy', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    create();

    fixture.destroy();

    expect(FakeResizeObserver.instance?.disconnected).toBe(1);
  });
});
