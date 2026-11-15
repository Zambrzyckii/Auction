import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileAvatar } from './avatar';

const AVATAR_URL = '/api/profiles/abc/avatar?v=cafebabe1234';

describe('ProfileAvatar', () => {
  let fixture: ComponentFixture<ProfileAvatar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProfileAvatar] }).compileComponents();
    fixture = TestBed.createComponent(ProfileAvatar);
  });

  function img(): HTMLImageElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('img.avatar');
  }

  it('renders nothing without a url', () => {
    fixture.componentRef.setInput('avatarUrl', null);
    fixture.detectChanges();
    expect(img()).toBeNull();
  });

  it('points a plain image tag at the avatar url', () => {
    fixture.componentRef.setInput('avatarUrl', AVATAR_URL);
    fixture.detectChanges();
    expect(img()?.getAttribute('src')).toBe(AVATAR_URL);
    expect(img()?.getAttribute('alt')).toBe('Avatar');
  });

  it('follows a changed url and disappears when it is cleared', () => {
    fixture.componentRef.setInput('avatarUrl', AVATAR_URL);
    fixture.detectChanges();
    fixture.componentRef.setInput('avatarUrl', '/api/profiles/abc/avatar?v=feedface5678');
    fixture.detectChanges();
    expect(img()?.getAttribute('src')).toBe('/api/profiles/abc/avatar?v=feedface5678');
    fixture.componentRef.setInput('avatarUrl', null);
    fixture.detectChanges();
    expect(img()).toBeNull();
  });
});
