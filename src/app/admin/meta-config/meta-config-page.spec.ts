import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { MetaConfigPage } from './meta-config-page';

describe('MetaConfigPage', () => {
  let component: MetaConfigPage;
  let fixture: ComponentFixture<MetaConfigPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [MetaConfigPage],
      providers: [provideRouter([])],
    }).compileComponents();

    TestBed.inject(SessionService).loginAs('systemadmin');

    fixture = TestBed.createComponent(MetaConfigPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the stored reference into the draft', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['draft'].apiVersion).toBe(data.metaConfig().apiVersion);
    expect(component['canEdit']()).toBe(true);
  });

  it('saves the draft and stamps the actor', async () => {
    const data = TestBed.inject(MockDataService);

    component['draft'].appId = '1234567890';
    await component['save']();

    expect(data.metaConfig().appId).toBe('1234567890');
    expect(data.metaConfig().updatedBy).toBeTruthy();
    expect(data.metaConfig().updatedAt).toBeTruthy();
  });

  it('rotates the verify token', async () => {
    const data = TestBed.inject(MockDataService);
    const before = data.metaConfig().verifyToken;

    component['regenerateToken']();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(data.metaConfig().verifyToken).not.toBe(before);
  });

  it('lists every workspace with its connection state', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['numbers']().length).toBe(data.tenants().length);
  });
});
