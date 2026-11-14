import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { actionState } from '../../core/actions/action-state';
import { SocialLink, SocialPlatform } from '../../core/api/models';
import { MAX_SOCIAL_LINKS, SOCIAL_PLATFORMS, socialLinkProblem } from './social-links';

@Component({
  selector: 'app-social-links-section',
  imports: [FormField],
  templateUrl: './social-links-section.html',
})
export class SocialLinksSection {
  private readonly http = inject(HttpClient);

  readonly links = input.required<readonly SocialLink[]>();
  readonly changed = output<void>();

  protected readonly platforms = SOCIAL_PLATFORMS;
  readonly workingLinks = signal<readonly SocialLink[] | null>(null);
  readonly social = actionState();
  private linksDirty = false;

  private readonly linkModel = signal<{ platform: SocialPlatform; url: string }>({
    platform: 'Twitch',
    url: '',
  });
  protected readonly linkForm = form(this.linkModel);

  readonly addProblem = computed<string | null>(() => {
    const links = this.workingLinks();
    if (links === null) {
      return 'Loading…';
    }
    const { platform, url } = this.linkModel();
    if (links.length >= MAX_SOCIAL_LINKS) {
      return `You can keep at most ${MAX_SOCIAL_LINKS} links.`;
    }
    if (links.some((link) => link.platform === platform)) {
      return `You already have a ${platform} link.`;
    }
    if (url === '') {
      return 'Enter a url.';
    }
    return socialLinkProblem(platform, url);
  });

  addLink(): void {
    const links = this.workingLinks();
    if (links === null || this.addProblem() !== null) {
      return;
    }
    const { platform, url } = this.linkModel();
    this.linksDirty = true;
    this.workingLinks.set([...links, { platform, url }]);
    this.linkModel.update((model) => ({ ...model, url: '' }));
  }

  removeLink(platform: SocialPlatform): void {
    const links = this.workingLinks();
    if (links === null) {
      return;
    }
    this.linksDirty = true;
    this.workingLinks.set(links.filter((link) => link.platform !== platform));
  }

  saveLinks(): void {
    const links = this.workingLinks();
    if (links === null) {
      return;
    }
    this.social.run(this.http.put('/api/profiles/me/socials', { links }), () => {
      this.linksDirty = false;
      this.changed.emit();
    });
  }

  constructor() {
    effect(() => {
      const fresh = this.links();
      if (!this.linksDirty) {
        this.workingLinks.set([...fresh]);
      }
    });
  }
}
