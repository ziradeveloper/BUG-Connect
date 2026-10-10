import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import { ContactsPage } from './contacts-page';

describe('ContactsPage', () => {
  let component: ContactsPage;
  let fixture: ComponentFixture<ContactsPage>;

  /** The mock data layer resolves after a simulated delay; wait for the load to finish. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 100 && component['loading'](); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ContactsPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the tenant contacts and sorts the tag list', async () => {
    const data = TestBed.inject(MockDataService);
    const expected = await data.listContacts();

    expect(component['allRows']().length).toBe(expected.total);
    expect(component['summary']().total).toBe(expected.total);

    const tags = component['tags']();
    expect(tags.length).toBeGreaterThan(0);
    expect([...tags].sort((a, b) => a.localeCompare(b))).toEqual(tags);
  });

  it('filters rows by the selected tag and returns to all rows', () => {
    const tag = component['tags']()[0]!;

    component['selectTag'](tag);
    fixture.detectChanges();

    const filtered = component['rows']();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((contact) => contact.tags.includes(tag))).toBe(true);
    expect(component['isActive'](tag)).toBe(true);

    component['selectTag'](null);
    expect(component['rows']().length).toBe(component['allRows']().length);
  });

  it('splits the summary into opted-in and opted-out counts that add up', () => {
    const summary = component['summary']();

    expect(summary.optedIn + summary.optedOut).toBe(summary.total);
    expect(component['allRows']().filter((c) => !c.optInStatus).length).toBe(summary.optedOut);
  });

  it('labels opt-in status for the badge column', () => {
    const contact = component['allRows']()[0]!;
    const label = component['optInLabel'](contact);

    expect(label).toBe(contact.optInStatus ? 'Opted in' : 'Opted out');
  });
});
