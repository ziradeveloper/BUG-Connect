import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the brand and navigation', () => {
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('BUGConnect');
    expect(fixture.nativeElement.textContent).toContain('Plans');
  });

  it('should toggle the selected theme', () => {
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector(
      '.site-header__theme-toggle',
    ) as HTMLButtonElement;

    const currentLabel = toggle.textContent?.trim();
    toggle.click();
    fixture.detectChanges();

    expect(toggle.textContent?.trim()).not.toBe(currentLabel);
  });
});
