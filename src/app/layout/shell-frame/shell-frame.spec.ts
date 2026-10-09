import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';

import { ShellFrame } from './shell-frame';

/** Host wrapper that satisfies the required `brandName` and `menu` inputs. */
@Component({
  template: `<app-shell-frame brandName="Test" [menu]="[]" />`,
  imports: [ShellFrame],
})
class HostComponent {}

describe('ShellFrame', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
