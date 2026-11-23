import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BankScene } from './bank-scene';
import type { BankLoan, BankOffer, BankWallet, WireRow } from './bank-watch';

@Component({
  imports: [BankScene],
  template: `<app-bank-scene
    focus="loans"
    [loans]="loans()"
    [wallet]="wallet()"
    [offers]="offers()"
    [asked]="asked()"
    [wires]="wires()"
    [me]="me()"
  />`,
})
class Host {
  readonly loans = signal<readonly BankLoan[] | null>(null);
  readonly wallet = signal<BankWallet | null>(null);
  readonly offers = signal<readonly BankOffer[] | null>(null);
  readonly asked = signal(false);
  readonly wires = signal<readonly WireRow[] | null>(null);
  readonly me = signal<string | null>(null);
}

@Component({
  imports: [BankScene],
  template: `<app-bank-scene focus="wires" [wires]="wires()" [me]="me()" />`,
})
class WiresHost {
  readonly wires = signal<readonly WireRow[] | null>(null);
  readonly me = signal<string | null>(null);
}

const loan = (over: Partial<BankLoan> = {}): BankLoan => ({
  publicLoanId: 'l1',
  principal: 200,
  totalDue: 220,
  penalty: 0,
  amountRepaid: 0,
  outstanding: 220,
  status: 'Active',
  dueOn: '2026-11-23T12:30:00Z',
  overdueSince: null,
  rejectionReason: null,
  ...over,
});

const offer: BankOffer = {
  name: 'Quick',
  principal: 200,
  totalDue: 220,
  term: '00:10:00',
  requiredTurnover: 400,
};

describe('BankScene', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  it('renders the room frame and a hidden canvas without booting a scene', async () => {
    await create();
    const canvas = fixture.nativeElement.querySelector('div.room > canvas.scene');
    expect(canvas).not.toBeNull();
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('never gets the staging class without a scene', async () => {
    await create();
    host.loans.set([loan({ status: 'PendingApproval' })]);
    fixture.detectChanges();
    host.loans.set([loan()]);
    fixture.detectChanges();
    const scene = fixture.nativeElement.querySelector('app-bank-scene');
    expect(scene.classList.contains('staging')).toBe(false);
  });

  it('never throws on input changes without a scene', async () => {
    await create();
    expect(() => {
      host.loans.set(null);
      host.loans.set([]);
      host.wallet.set({ availableFunds: 300, lifetimeTurnover: 650 });
      host.offers.set([offer]);
      fixture.detectChanges();
      host.asked.set(true);
      fixture.detectChanges();
      host.loans.set([loan({ status: 'PendingApproval' })]);
      fixture.detectChanges();
      host.asked.set(false);
      host.loans.set([loan()]);
      fixture.detectChanges();
      host.loans.set([loan({ status: 'Overdue', overdueSince: '2026-11-23T12:31:00Z' })]);
      host.me.set('me');
      host.wires.set([
        {
          senderUserId: 'me',
          recipientUserId: 'other',
          amount: 50,
          sentOn: '2026-11-23T11:00:00Z',
        },
      ]);
      fixture.detectChanges();
      host.wallet.set(null);
      host.offers.set(null);
      host.loans.set(null);
      host.wires.set(null);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('never throws on wire changes without a scene', async () => {
    const wiresFixture: ComponentFixture<WiresHost> = TestBed.createComponent(WiresHost);
    const wiresHost = wiresFixture.componentInstance;
    wiresFixture.detectChanges();
    await wiresFixture.whenStable();
    wiresFixture.detectChanges();
    const out: WireRow = {
      senderUserId: 'me',
      recipientUserId: 'other',
      amount: 50,
      sentOn: '2026-11-23T11:00:00Z',
    };
    const incoming: WireRow = {
      senderUserId: 'other',
      recipientUserId: 'me',
      amount: 70,
      sentOn: '2026-11-23T11:05:00Z',
    };
    expect(() => {
      wiresHost.me.set('me');
      wiresHost.wires.set([]);
      wiresFixture.detectChanges();
      wiresHost.wires.set([out]);
      wiresFixture.detectChanges();
      wiresHost.wires.set([incoming, out]);
      wiresFixture.detectChanges();
      wiresHost.me.set(null);
      wiresFixture.detectChanges();
      wiresHost.wires.set(null);
      wiresFixture.detectChanges();
    }).not.toThrow();
  });
});
