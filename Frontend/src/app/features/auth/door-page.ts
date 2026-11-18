import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoorMode } from '../../street/door/door-rules';
import { DoorScene } from '../../street/door/door-scene';
import { STARTING_FUNDS } from '../welcome/welcome-rules';

const EYEBROWS: Record<DoorMode, string> = {
  login: 'Members sign-in sheet',
  register: 'New members',
};

@Component({
  selector: 'app-door-page',
  imports: [RouterLink, DoorScene],
  templateUrl: './door-page.html',
  styleUrl: './door-page.scss',
})
export class DoorPage {
  readonly mode = input.required<DoorMode>();
  readonly pending = input(false);
  readonly refused = input(false);

  readonly strip = signal<number | null>(null);
  readonly eyebrow = computed(() => EYEBROWS[this.mode()]);
  readonly startingFunds = STARTING_FUNDS;
}
