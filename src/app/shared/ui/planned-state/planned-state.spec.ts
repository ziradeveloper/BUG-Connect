import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlannedState } from './planned-state';

describe('PlannedState', () => {
  let component: PlannedState;
  let fixture: ComponentFixture<PlannedState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlannedState],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PlannedState);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Feature Planned');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
