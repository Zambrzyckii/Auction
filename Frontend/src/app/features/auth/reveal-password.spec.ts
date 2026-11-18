import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { RevealPassword } from './reveal-password';

@Component({
  imports: [FormField, RevealPassword],
  template: `
    <input #pw type="password" [formField]="f.password" />
    <button type="button" [appRevealPassword]="pw" #r="revealPassword">{{ r.label() }}</button>
  `,
})
class Host {
  readonly model = signal({ password: '' });
  readonly f = form(this.model);
}

describe('RevealPassword', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      input: el.querySelector('input')!,
      button: el.querySelector('button')!,
    };
  }

  it('starts hidden', async () => {
    const { input, button } = await setup();

    expect(input.type).toBe('password');
    expect(button.textContent?.trim()).toBe('Show');
    expect(button.getAttribute('aria-label')).toBe('Show password');
  });

  it('shows the password on click', async () => {
    const { fixture, input, button } = await setup();

    button.click();
    await fixture.whenStable();

    expect(input.type).toBe('text');
    expect(button.textContent?.trim()).toBe('Hide');
    expect(button.getAttribute('aria-label')).toBe('Hide password');
  });

  it('hides it again on a second click', async () => {
    const { fixture, input, button } = await setup();

    button.click();
    await fixture.whenStable();
    button.click();
    await fixture.whenStable();

    expect(input.type).toBe('password');
    expect(button.textContent?.trim()).toBe('Show');
  });

  it('keeps the form field bound after showing', async () => {
    const { fixture, input, button } = await setup();

    button.click();
    await fixture.whenStable();
    input.value = 'Zaq1@wsxCde3';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().password).toBe('Zaq1@wsxCde3');
  });
});
