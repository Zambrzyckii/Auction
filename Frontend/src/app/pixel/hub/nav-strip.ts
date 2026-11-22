import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nav-strip',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './nav-strip.html',
  styleUrl: './nav-strip.scss',
})
export class NavStrip {
  readonly where = input.required<string>();
  readonly cash = input.required<number | null>();
  readonly level = input.required<number | null>();
  readonly loggedOut = output<void>();
}
