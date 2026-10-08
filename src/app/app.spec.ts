import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './core/theme/theme';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app heading', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, BUGConnect');
  });

  it('should toggle the theme and update the document theme attribute', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const theme = TestBed.inject(ThemeService);
    const document = TestBed.inject(DOCUMENT);
    const initialTheme = theme.currentTheme();
    const toggle = fixture.nativeElement.querySelector('[data-theme-toggle]') as HTMLButtonElement;

    toggle.click();
    await fixture.whenStable();

    expect(theme.currentTheme()).not.toBe(initialTheme);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme.currentTheme());
  });
});
