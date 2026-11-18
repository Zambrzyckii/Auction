import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { BuildingId } from '../../pixel/street/city';
import { StreetPage } from '../../pixel/welcome/street-page';
import { BUILDING_LINKS, BUILDING_PATHS } from './welcome-rules';

@Component({
  selector: 'app-welcome',
  imports: [StreetPage],
  templateUrl: './welcome.html',
})
export class Welcome {
  private readonly router = inject(Router);

  readonly links = BUILDING_LINKS;
  readonly paths = BUILDING_PATHS;

  open(id: BuildingId): void {
    void this.router.navigateByUrl(BUILDING_PATHS[id]);
  }
}
