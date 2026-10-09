import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ClientShell } from './client-shell';

describe('ClientShell', () => {
  let component: ClientShell;
  let fixture: ComponentFixture<ClientShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientShell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
