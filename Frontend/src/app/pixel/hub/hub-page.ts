import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BuildingId } from '../street/city';
import type { HudState } from '../street/hud';
import { StreetScene } from '../street/street-scene';

@Component({
  selector: 'app-hub-page',
  imports: [RouterLink, StreetScene],
  templateUrl: './hub-page.html',
  styleUrl: './hub-page.scss',
})
export class HubPage {
  readonly links = input.required<readonly { id: BuildingId; name: string }[]>();
  readonly paths = input.required<Readonly<Record<BuildingId, string>>>();
  readonly hud = input.required<HudState | null>();
  readonly email = input.required<string>();
  readonly picked = output<BuildingId>();
  readonly loggedOut = output<void>();
}
