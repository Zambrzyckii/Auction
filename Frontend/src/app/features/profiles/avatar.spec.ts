import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileAvatar } from './avatar';

const AVATAR_URL = '/api/profiles/abc/avatar?v=cafebabe1234';

describe('ProfileAvatar', () => {
  let fixture: ComponentFixture<ProfileAvatar>;
  let http: HttpTestingController;

  beforeEach(async () => {
    (URL as unknown as Record<string, unknown>)['createObjectURL'] = vi.fn(() => 'blob:fake-1');
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProfileAvatar],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileAvatar);
  });

  afterEach(() => {
    http.verify();
    delete (URL as unknown as Record<string, unknown>)['createObjectURL'];
    delete (URL as unknown as Record<string, unknown>)['revokeObjectURL'];
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nothing and sends nothing without a url', () => {
    fixture.componentRef.setInput('avatarUrl', null);
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
  });

  it('fetches the url as a blob and shows the object url', () => {
    fixture.componentRef.setInput('avatarUrl', AVATAR_URL);
    fixture.detectChanges();
    const req = http.expectOne(AVATAR_URL);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x'], { type: 'image/png' }));
    fixture.detectChanges();
    expect(el().querySelector('img')?.getAttribute('src')).toBe('blob:fake-1');
  });

  it('ignores a response outside the allowed image types', () => {
    fixture.componentRef.setInput('avatarUrl', AVATAR_URL);
    fixture.detectChanges();
    http.expectOne(AVATAR_URL).flush(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the old object url when the input changes', () => {
    fixture.componentRef.setInput('avatarUrl', AVATAR_URL);
    fixture.detectChanges();
    http.expectOne(AVATAR_URL).flush(new Blob(['x'], { type: 'image/png' }));
    fixture.detectChanges();

    fixture.componentRef.setInput('avatarUrl', '/api/profiles/abc/avatar?v=feedface5678');
    fixture.detectChanges();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');
    http
      .expectOne('/api/profiles/abc/avatar?v=feedface5678')
      .flush(new Blob(['y'], { type: 'image/png' }));
  });

  it('revokes the object url on destroy', () => {
    fixture.componentRef.setInput('avatarUrl', AVATAR_URL);
    fixture.detectChanges();
    http.expectOne(AVATAR_URL).flush(new Blob(['x'], { type: 'image/png' }));
    fixture.detectChanges();
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');
  });
});
