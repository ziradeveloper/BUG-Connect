import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlannedModulePage } from './planned-module-page';

describe('PlannedModulePage', () => {
  let component: PlannedModulePage;
  let fixture: ComponentFixture<PlannedModulePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlannedModulePage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlannedModulePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
