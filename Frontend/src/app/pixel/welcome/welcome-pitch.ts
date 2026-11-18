import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-welcome-pitch',
  imports: [RouterLink],
  templateUrl: './welcome-pitch.html',
  styleUrl: './welcome-pitch.scss',
})
export class WelcomePitch {
  readonly startingFunds = input.required<number>();
}
