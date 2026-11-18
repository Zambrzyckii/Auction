import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STARTING_FUNDS } from '../starting-funds';
import type { BuildingId } from '../street/city';
import { StreetScene } from '../street/street-scene';
import { HeightProbe } from './height-probe';
import { WelcomePitch } from './welcome-pitch';

@Component({
  selector: 'app-street-page',
  imports: [RouterLink, StreetScene, WelcomePitch, HeightProbe],
  templateUrl: './street-page.html',
  styleUrl: './street-page.scss',
})
export class StreetPage {
  readonly links = input.required<readonly { id: BuildingId; name: string }[]>();
  readonly paths = input.required<Readonly<Record<BuildingId, string>>>();
  readonly picked = output<BuildingId>();

  readonly startingFunds = STARTING_FUNDS;
}
