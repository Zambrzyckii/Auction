import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HubPage } from './hub-page';

describe('HubPage', () => {
  let fixture: ComponentFixture<HubPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HubPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HubPage);
    fixture.componentRef.setInput('links', []);
    fixture.componentRef.setInput('paths', {});
    fixture.componentRef.setInput('email', 'bob@test.local');
    fixture.componentRef.setInput('hud', null);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('reads the hud values to screen readers once they are known', () => {
    expect(root().querySelector('p.sr')).toBeNull();

    fixture.componentRef.setInput('hud', {
      name: 'bob',
      cash: 2840,
      level: 3,
      share: 0.4,
      nextAt: 16000,
    });
    fixture.detectChanges();

    expect(root().querySelector('p.sr')?.textContent?.trim()).toBe(
      'bob has $2840. Level 3. Next level at $16000.',
    );

    fixture.componentRef.setInput('hud', null);
    fixture.detectChanges();

    expect(root().querySelector('p.sr')).toBeNull();
  });
});
