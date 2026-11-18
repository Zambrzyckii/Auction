import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DoorMode } from '../../street/door/door-rules';
import { DoorScene } from '../../street/door/door-scene';
import { DoorPage } from './door-page';

@Component({
  imports: [DoorPage],
  template: `<app-door-page [mode]="mode()"><h2>Probe</h2></app-door-page>`,
})
class Host {
  readonly mode = signal<DoorMode>('login');
}

describe('DoorPage', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string | undefined {
    return el().querySelector(selector)?.textContent?.trim();
  }

  it('projects the form onto the paper under the sheet head', () => {
    expect(text('.paper > .sheet-head + h2')).toBe('Probe');
  });

  it('leads back to the street', () => {
    const back = el().querySelector<HTMLAnchorElement>('a.back');

    expect(back?.getAttribute('href')).toBe('/welcome');
    expect(back?.textContent).toContain('Back to the street');
  });

  it('labels the login sheet', () => {
    expect(text('.eyebrow')).toBe('Members sign-in sheet');
    expect(el().querySelector('section.sheet')?.getAttribute('aria-label')).toBe('Log in');
    expect(el().querySelector('.stamp')).toBeNull();
  });

  it('stamps the register sheet with the starting funds', () => {
    fixture.componentInstance.mode.set('register');
    fixture.detectChanges();

    expect(text('.eyebrow')).toBe('New members');
    expect(el().querySelector('section.sheet')?.getAttribute('aria-label')).toBe('Register');
    expect(text('.stamp')).toBe('$300 to start');
  });

  it('draws the scene behind the sheet', () => {
    expect(el().querySelector('app-door-scene canvas')).not.toBeNull();
  });

  it('holds the reported strip height in px', () => {
    const door = el().querySelector<HTMLElement>('.door')!;
    expect(door.style.getPropertyValue('--strip')).toBe('');

    const scene = fixture.debugElement.query(By.directive(DoorScene)).componentInstance as DoorScene;
    scene.strip.emit(150);
    fixture.detectChanges();

    expect(door.style.getPropertyValue('--strip')).toBe('150px');
  });
});
