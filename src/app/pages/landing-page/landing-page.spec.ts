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

  it('should present the WhatsApp workspace positioning and plan section', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toContain('One WhatsApp number.');
    expect(page.querySelector('#plans')).toBeTruthy();
    expect(page.querySelectorAll('.plan-card').length).toBe(3);
  });

  it('should use the PRD module vocabulary for the primary modules', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    const modules = [...page.querySelectorAll('.module-card h3')].map((heading) =>
      heading.textContent?.trim(),
    );

    expect(modules).toEqual([
      'Team Inbox',
      'Flow Builder',
      'WhatsApp Flows Studio',
      'Template Manager',
      'Campaign Manager',
      'Contact Hub',
    ]);
  });

  it('should document the flow-first pipeline and the role matrix', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelectorAll('.pipeline__item').length).toBe(5);
    expect(page.querySelector('#flow-first')).toBeTruthy();
    expect(page.querySelectorAll('.rbac-table tbody tr').length).toBe(10);
  });

  it('should keep unresolved commercial decisions explicit', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.plans-note')?.textContent).toContain('draft');
    expect(page.textContent).toContain('Pricing is not published yet');
  });
});
