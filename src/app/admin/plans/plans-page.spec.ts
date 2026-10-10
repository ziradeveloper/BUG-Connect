import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { PlansPage } from './plans-page';

describe('PlansPage', () => {
  let component: PlansPage;
  let fixture: ComponentFixture<PlansPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlansPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders one card per plan with workspace counts', () => {
    const data = TestBed.inject(MockDataService);
    const cards = component['cards']();

    expect(cards.length).toBe(data.plans().length);
    expect(cards.every((card) => card.limits.length === 6)).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.tier-card').length).toBe(
      cards.length,
    );
  });

  it('shows Custom while prices are unpublished', () => {
    expect(component['price']({ monthlyPriceInr: null } as never)).toBe('Custom');
    expect(component['price']({ monthlyPriceInr: 14900 } as never)).toContain('₹');
    expect(component['limitValue'](null)).toBe('Unlimited');
  });
});
