import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { PlansEditPage } from './plans-edit-page';

describe('PlansEditPage', () => {
  let component: PlansEditPage;
  let fixture: ComponentFixture<PlansEditPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansEditPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlansEditPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the tier limits into the draft', () => {
    expect(component['activeTier']()).toBe('Pilot');
    expect(component['draft']()).toEqual(TestBed.inject(MockDataService).planForTier('Pilot')?.limits);
  });

  it('falls back to Pilot for an unknown tier', () => {
    fixture.componentRef.setInput('tier', 'nope');
    fixture.detectChanges();

    expect(component['activeTier']()).toBe('Pilot');
  });

  it('toggles unlimited and writes numbers back', () => {
    component['toggleUnlimited']('seats', true);
    expect(component['draft']()?.seats).toBeNull();

    component['toggleUnlimited']('seats', false);
    expect(component['draft']()?.seats).toBe(1);

    component['setValue']('seats', '12');
    expect(component['draft']()?.seats).toBe(12);

    component['setValue']('seats', 'junk');
    expect(component['draft']()?.seats).toBe(12);
  });

  it('saves the draft to the live plan row', async () => {
    const data = TestBed.inject(MockDataService);

    component['setValue']('seats', '9');
    await component['save']();

    expect(data.planForTier('Pilot')?.limits.seats).toBe(9);
    expect(component['notice']()).toContain('Pilot');
  });
});
