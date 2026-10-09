import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RoleDetailPage } from './role-detail-page';

describe('RoleDetailPage', () => {
  let component: RoleDetailPage;
  let fixture: ComponentFixture<RoleDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleDetailPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
