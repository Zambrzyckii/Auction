import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavStrip } from './nav-strip';

describe('NavStrip', () => {
  let fixture: ComponentFixture<NavStrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavStrip],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(NavStrip);
    fixture.componentRef.setInput('where', 'Auction hall');
    fixture.componentRef.setInput('cash', 2840);
    fixture.componentRef.setInput('level', 3);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the door, cash and level', () => {
    expect(root().querySelector('.where')?.textContent).toBe('Auction hall');
    expect(root().querySelector('.cash')?.textContent).toBe('$2,840');
    expect(root().querySelector('.lv')?.textContent).toBe('LV 3');
    const back = root().querySelector<HTMLAnchorElement>('.back')!;
    expect(back.getAttribute('href')).toBe('/hub');
    expect(back.textContent).toBe('< Street');
  });

  it('hides cash and level until they are known', () => {
    fixture.componentRef.setInput('cash', null);
    fixture.componentRef.setInput('level', null);
    fixture.detectChanges();

    expect(root().querySelector('.cash')).toBeNull();
    expect(root().querySelector('.lv')).toBeNull();
  });

  it('emits loggedOut', () => {
    const emitted = vi.fn();
    fixture.componentInstance.loggedOut.subscribe(emitted);

    root().querySelector<HTMLButtonElement>('.out')!.click();

    expect(emitted).toHaveBeenCalledTimes(1);
  });
});
