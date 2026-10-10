import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { WhatsappCallbackPage } from './whatsapp-callback-page';

/**
 * The callback is the only writer of the WABA connection: a code connects,
 * and no code fails with guidance instead of a blank screen.
 */
describe('WhatsappCallbackPage', () => {
  async function open(code: string | null): Promise<{
    component: WhatsappCallbackPage;
    fixture: ComponentFixture<WhatsappCallbackPage>;
  }> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [WhatsappCallbackPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(WhatsappCallbackPage);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('code', code);
    fixture.componentRef.setInput('state', 'test-state');
    fixture.detectChanges();

    for (let i = 0; i < 100 && component['phase']() === 'working'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();

    return { component, fixture };
  }

  it('connects the workspace when Meta returns a code', async () => {
    const { component } = await open('meta-auth-test-code');
    const data = TestBed.inject(MockDataService);
    const tenant = data.tenantById(data.tenantId());

    expect(component['phase']()).toBe('connected');
    expect(tenant?.metaWabaId).toBeTruthy();
    expect(tenant?.phoneNumber).toBeTruthy();
  });

  it('fails with guidance when the code is missing', async () => {
    const { component } = await open(null);

    expect(component['phase']()).toBe('failed');
    expect(component['detail']()).toContain('no authorization code');
  });
});
