import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../testing/storage-stub';
import { REAL_TOKEN, REAL_TOKEN_EMAIL } from '../testing/token-fixture';
import { App } from './app';
import { routes } from './app.routes';
import { TokenStorage } from './core/auth/token-storage';

describe('App', () => {
  beforeEach(async () => {
    installStorageStub();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('renders the navigation with login links for an anonymous user', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const texts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(texts).toContain('Auctions');
    expect(texts).toContain('Wallet');
    expect(texts).toContain('Log in');
  });

  it('shows the email and a logout button for a signed-in user', async () => {
    new TokenStorage().set(REAL_TOKEN);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.session span')?.textContent).toContain(REAL_TOKEN_EMAIL);
    expect(el.querySelector('.session button')?.textContent).toContain('Log out');
  });
});
