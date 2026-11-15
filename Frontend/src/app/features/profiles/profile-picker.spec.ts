import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { ProfilePicker, SEARCH_DEBOUNCE_MS } from './profile-picker';

const ALICE = 'aaaaaaaa-1111-2222-3333-444444444444';
const ALBERT = 'bbbbbbbb-1111-2222-3333-444444444444';
const SEARCH_URL = '/api/profiles/search';

describe('ProfilePicker', () => {
  let fixture: ComponentFixture<ProfilePicker>;
  let http: HttpTestingController;
  let remember: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    remember = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProfilePicker],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProfileDirectory, useValue: { remember } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePicker);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function input(): HTMLInputElement {
    return el().querySelector('input') as HTMLInputElement;
  }

  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function optionTexts(): string[] {
    return Array.from(el().querySelectorAll('datalist option')).map(
      (option) => `${(option as HTMLOptionElement).value}=${option.textContent?.trim()}`,
    );
  }

  it('lists the seed options in a datalist attached to the input', () => {
    fixture.componentRef.setInput('seed', [{ userId: ALICE, username: 'alice' }]);
    fixture.detectChanges();
    const datalist = el().querySelector('datalist') as HTMLDataListElement;
    expect(input().getAttribute('list')).toBe(datalist.id);
    expect(optionTexts()).toEqual([`${ALICE}=alice`]);
  });

  it('searches after the debounce once two characters are typed', () => {
    type('a');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http.expectNone((req) => req.url === SEARCH_URL);

    type('al');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    http.expectNone((req) => req.url === SEARCH_URL);
    vi.advanceTimersByTime(1);
    http
      .expectOne(`${SEARCH_URL}?q=al`)
      .flush([{ userId: ALBERT, username: 'albert', avatarUrl: null }]);
    fixture.detectChanges();
    expect(optionTexts()).toEqual([`${ALBERT}=albert`]);
    expect(remember).toHaveBeenCalledWith(ALBERT, 'albert');
  });

  it('merges the search results after the seed without duplicates', () => {
    fixture.componentRef.setInput('seed', [{ userId: ALICE, username: 'alice' }]);
    fixture.detectChanges();
    type('al');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http.expectOne(`${SEARCH_URL}?q=al`).flush([
      { userId: ALICE, username: 'alice', avatarUrl: null },
      { userId: ALBERT, username: 'albert', avatarUrl: null },
    ]);
    fixture.detectChanges();
    expect(optionTexts()).toEqual([`${ALICE}=alice`, `${ALBERT}=albert`]);
  });

  it('drops a search superseded by further typing', () => {
    type('al');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    const first = http.expectOne(`${SEARCH_URL}?q=al`);
    type('alb');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(first.cancelled).toBe(true);
    http
      .expectOne(`${SEARCH_URL}?q=alb`)
      .flush([{ userId: ALBERT, username: 'albert', avatarUrl: null }]);
    fixture.detectChanges();
    expect(optionTexts()).toEqual([`${ALBERT}=albert`]);
  });

  it('emits every value typed or picked and sends nothing for a player id', () => {
    const emitted: string[] = [];
    fixture.componentInstance.value.subscribe((value) => emitted.push(value));
    type('al');
    type(ALICE);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http.expectNone((req) => req.url === SEARCH_URL);
    expect(emitted).toEqual(['al', ALICE]);
  });

  it('shows the value given by the parent', () => {
    fixture.componentRef.setInput('value', ALICE);
    fixture.detectChanges();
    expect(input().value).toBe(ALICE);
  });

  it('clears stale results when the text drops below two characters', () => {
    type('al');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    http
      .expectOne(`${SEARCH_URL}?q=al`)
      .flush([{ userId: ALBERT, username: 'albert', avatarUrl: null }]);
    fixture.detectChanges();
    type('a');
    expect(optionTexts()).toEqual([]);
  });
});
