import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { FeatureMatrixPage } from './feature-matrix-page';

/**
 * The matrix is the write side of plan gating: toggling a cell must move the
 * same row the permission service reads.
 */
describe('FeatureMatrixPage', () => {
  let component: FeatureMatrixPage;
  let fixture: ComponentFixture<FeatureMatrixPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [FeatureMatrixPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureMatrixPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists every visible client module as a row', () => {
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.feature-matrix tbody tr');

    expect(component['modules'].length).toBeGreaterThan(0);
    expect(rows.length).toBe(component['modules'].length);
  });

  it('writes toggles to the plan the permission service reads', () => {
    const data = TestBed.inject(MockDataService);
    TestBed.inject(SessionService).loginAs('systemadmin');
    TestBed.inject(PermissionService);
    fixture.detectChanges();

    expect(component['canEdit']()).toBe(true);

    const before = data.planForTier('Pilot')?.modules.includes('campaigns') ?? false;
    component['toggle']('Pilot', 'campaigns', !before);

    expect(data.planForTier('Pilot')?.modules.includes('campaigns')).toBe(!before);
    expect(component['hasModule']('Pilot', 'campaigns')).toBe(!before);
  });
});
