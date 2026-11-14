import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, input, output } from '@angular/core';
import { actionState } from '../../core/actions/action-state';
import { BotTier, Pawnshop as PawnshopDto } from '../../core/api/models';
import { timeLeft } from '../../core/format/time-left';
import { clock } from '../../core/time/clock';

@Component({
  selector: 'app-bot-section',
  imports: [DecimalPipe],
  templateUrl: './bot-section.html',
})
export class BotSection {
  private readonly http = inject(HttpClient);

  readonly shop = input.required<PawnshopDto>();
  readonly upgrades = input.required<readonly BotTier[]>();
  readonly changed = output<void>();

  readonly bot = actionState();
  readonly now = clock();
  readonly timeLeft = timeLeft;

  buyBot(tier: BotTier): void {
    this.bot.run(this.http.post('/api/pawnshop/bot', { tierName: tier.name }), () =>
      this.changed.emit(),
    );
  }
}
