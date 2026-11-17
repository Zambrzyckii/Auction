import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StreetScene } from '../../street/street-scene';
import type { BuildingId } from '../../street/city';
import { WelcomePitch } from './welcome-pitch';
import { BUILDING_LINKS, BUILDING_PATHS, STARTING_FUNDS } from './welcome-rules';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink, StreetScene, WelcomePitch],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  private readonly router = inject(Router);

  readonly startingFunds = STARTING_FUNDS;
  readonly links = BUILDING_LINKS;
  readonly paths = BUILDING_PATHS;

  open(id: BuildingId): void {
    void this.router.navigateByUrl(BUILDING_PATHS[id]);
  }
}
