import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the username and password form', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain(
      'Log in to BUGConnect',
    );
    expect(fixture.nativeElement.querySelector('#login-username')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#login-password')).toBeTruthy();
  });

  it('should reveal and hide the password on request', () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const password = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement;
    const toggle = fixture.nativeElement.querySelector(
      '.password-control__toggle',
    ) as HTMLButtonElement;

    expect(password.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    toggle.click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
  });

  it('should show field validation when submitted empty', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#username-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#password-error')).toBeTruthy();
  });

  it('should accept the configured demo credentials', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const username = fixture.nativeElement.querySelector('#login-username') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    username.value = 'admin';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = 'admin@123';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.login-status--success')?.textContent).toContain(
      'Demo sign-in accepted',
    );
  });

  it('should reject incorrect demo credentials', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const username = fixture.nativeElement.querySelector('#login-username') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    username.value = 'admin';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = 'wrong-password';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.login-status--error')?.textContent).toContain(
      'Username or password is incorrect',
    );
  });
});
