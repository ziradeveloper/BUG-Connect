import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { ClientWizardPage } from './client-wizard-page';

/**
 * The onboard wizard is the only writer of new tenants: subdomains must be
 * valid and unique, and each step gates the next.
 */
describe('ClientWizardPage', () => {
  let component: ClientWizardPage;
  let fixture: ComponentFixture<ClientWizardPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientWizardPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientWizardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts on step one and blocks progress on an empty business name', () => {
    expect(component['step']()).toBe(1);

    component['next']();

    expect(component['step']()).toBe(1);
    expect(component['notice']()).toBeTruthy();
  });

  it('rejects taken and malformed subdomains', () => {
    component['draft'].businessName = 'Test Business';
    component['next']();
    expect(component['step']()).toBe(2);

    component['draft'].subdomain = 'nazeel';
    expect(component['subdomainError']()).toContain('already taken');

    component['draft'].subdomain = 'Bad Sub!';
    expect(component['subdomainError']()).toContain('Lowercase');

    component['draft'].subdomain = 'brand-new-shop';
    expect(component['subdomainError']()).toBeNull();
  });

  it('previews the workspace address and the tier limits', () => {
    component['draft'].subdomain = 'brand-new-shop';
    component['draft'].tier = 'Pilot';

    expect(component['workspaceUrl']()).toBe('brand-new-shop.platform.com');
    expect(component['planHint']()).toContain('seats');
  });

  it('creates the tenant and its admin on submit', async () => {
    const data = TestBed.inject(MockDataService);
    const subdomain = `wizard-${Date.now().toString(36)}`;

    component['draft'].businessName = 'Wizard Test Store';
    component['draft'].subdomain = subdomain;
    component['draft'].adminName = 'Wizard Admin';
    component['draft'].adminEmail = 'wizard@example.com';
    component['step'].set(3);
    fixture.detectChanges();

    await component['submit']();

    const tenant = data.tenants().find((row) => row.subdomain === subdomain);
    expect(tenant).toBeTruthy();
    expect(tenant?.status).toBe('onboarding');
    expect(data.usersForTenant(tenant!.id).some((user) => user.roleId === 'role-admin')).toBe(true);
  });
});
