import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should present the product overview and plan section', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toContain('Every bug has a story.');
    expect(page.querySelector('#plans')).toBeTruthy();
    expect(page.querySelectorAll('.plan-card').length).toBe(3);
  });
});
