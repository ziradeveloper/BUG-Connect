import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoAuth } from '../../core/auth/demo-auth';
import { SiteHeader } from '../../shared/site-header/site-header';

type LoginStatus = 'success' | 'error' | 'info';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, SiteHeader],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly demoAuth = inject(DemoAuth);

  protected username = '';
  protected password = '';
  protected passwordVisible = false;
  protected statusMessage = '';
  protected statusType: LoginStatus = 'info';

  protected togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  protected onSubmit(form: NgForm): void {
    this.statusMessage = '';

    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    if (this.demoAuth.authenticate(this.username, this.password)) {
      this.statusType = 'success';
      this.statusMessage = 'Demo sign-in accepted. Welcome, admin.';
      return;
    }

    this.statusType = 'error';
    this.statusMessage = 'Username or password is incorrect. Check your details and try again.';
  }

  protected requestPasswordReset(): void {
    this.statusType = 'info';
    this.statusMessage = 'Password recovery is not available in this demo login yet.';
  }
}
