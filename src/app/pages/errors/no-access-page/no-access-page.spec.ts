import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoAccessPage } from './no-access-page';

describe('NoAccessPage', () => {
  let component: NoAccessPage;
  let fixture: ComponentFixture<NoAccessPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoAccessPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NoAccessPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
