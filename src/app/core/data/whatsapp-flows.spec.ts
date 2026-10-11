import { describe, expect, it } from 'vitest';

import type { WaFormScreen } from './entities';
import {
  FLOW_JSON_VERSION,
  flowJson,
  flowJsonBytes,
  makeField,
  makeScreen,
  responseShape,
  screenIdFor,
  slugFor,
  toFlowJson,
  validateFlow,
} from './whatsapp-flows';

/**
 * Wave 6: the flow JSON generator. The studio edits a screen model and this is
 * what publishes — so the assertions below are about Meta's document shape, not
 * about the editor.
 */

function screen(overrides: Partial<WaFormScreen> = {}): WaFormScreen {
  return {
    id: 'BOOKING',
    title: 'Book a slot',
    subtitle: null,
    terminal: true,
    nextScreenId: null,
    footerLabel: 'Confirm',
    fields: [],
    ...overrides,
  };
}

describe('whatsapp-flows flow JSON', () => {
  it('emits the spec version, a routing model and single-column layouts', () => {
    const document = toFlowJson({ screens: [screen()] }) as {
      version: string;
      routing_model: Record<string, string[]>;
      screens: { id: string; title: string; terminal?: boolean; layout: { type: string } }[];
    };

    expect(document.version).toBe(FLOW_JSON_VERSION);
    expect(document.routing_model).toEqual({ BOOKING: [] });
    expect(document.screens[0]?.layout.type).toBe('SingleColumnLayout');
    expect(document.screens[0]?.terminal).toBe(true);
  });

  it('routes a non-terminal screen to the one its footer names', () => {
    const document = toFlowJson({
      screens: [
        screen({ id: 'ISSUE', terminal: false, nextScreenId: 'CONTACT' }),
        screen({ id: 'CONTACT', title: 'Contact' }),
      ],
    }) as { routing_model: Record<string, string[]> };

    expect(document.routing_model).toEqual({ ISSUE: ['CONTACT'], CONTACT: [] });
  });

  it('maps each component to its Meta properties', () => {
    const document = toFlowJson({
      screens: [
        screen({
          fields: [
            makeField('TextInput', [], 1),
            makeField('Dropdown', [], 2),
            makeField('OptIn', [], 3),
            makeField('TextBody', [], 4),
          ],
        }),
      ],
    }) as {
      screens: { layout: { children: Record<string, unknown>[] } }[];
    };

    const children = document.screens[0]?.layout.children ?? [];
    const text = children[0] as Record<string, unknown>;
    const dropdown = children[1] as Record<string, unknown>;
    const optIn = children[2] as Record<string, unknown>;
    const body = children[3] as Record<string, unknown>;

    expect(text['type']).toBe('TextInput');
    expect(text['input-type']).toBe('text');
    expect(text['name']).toBeTruthy();
    expect(dropdown['type']).toBe('Dropdown');
    expect(Array.isArray(dropdown['data-source'])).toBe(true);
    expect((dropdown['data-source'] as { id: string; title: string }[])[0]).toEqual({
      id: 'option_1',
      title: 'First option',
    });
    expect(optIn['type']).toBe('OptIn');
    expect(body['type']).toBe('TextBody');
    expect(body['text']).toBeTruthy();
  });

  it('closes a terminal screen with a complete action carrying every value', () => {
    const document = toFlowJson({
      screens: [
        screen({
          id: 'ISSUE',
          terminal: false,
          nextScreenId: 'CONTACT',
          fields: [{ ...makeField('TextInput', [], 1), name: 'reference' }],
        }),
        screen({
          id: 'CONTACT',
          title: 'Contact',
          fields: [{ ...makeField('TextInput', [], 1), name: 'callback_number' }],
        }),
      ],
    }) as {
      screens: { layout: { children: Record<string, unknown>[] } }[];
    };

    const footer = (document.screens[1]?.layout.children ?? []).at(-1) as Record<string, unknown>;
    const action = footer['on-click-action'] as { name: string; payload: Record<string, string> };

    expect(footer['type']).toBe('Footer');
    expect(action.name).toBe('complete');
    expect(action.payload['callback_number']).toBe('${form.callback_number}');
    expect(action.payload['reference']).toBe('${screen.ISSUE.form.reference}');
  });

  it('navigates from a non-terminal footer', () => {
    const document = toFlowJson({
      screens: [screen({ id: 'ISSUE', terminal: false, nextScreenId: 'CONTACT' })],
    }) as { screens: { layout: { children: Record<string, unknown>[] } }[] };

    const footer = (document.screens[0]?.layout.children ?? []).at(-1) as Record<string, unknown>;
    const action = footer['on-click-action'] as { name: string; next: { name: string } };

    expect(action.name).toBe('navigate');
    expect(action.next.name).toBe('CONTACT');
  });

  it('serialises to JSON and measures it the way Meta would', () => {
    const form = { screens: [screen()] };

    expect(() => JSON.parse(flowJson(form))).not.toThrow();
    expect(flowJsonBytes(form)).toBe(new TextEncoder().encode(flowJson(form)).length);
  });
});

describe('whatsapp-flows validation', () => {
  it('accepts a single-screen form that posts something', () => {
    const form = {
      screens: [
        screen({ fields: [{ ...makeField('TextInput', [], 1), label: 'Full name', name: 'full_name' }] }),
      ],
    };

    expect(validateFlow(form)).toEqual([]);
  });

  it('refuses an empty form', () => {
    expect(validateFlow({ screens: [] })).toEqual(['Add at least one screen before publishing.']);
  });

  it('catches duplicate and malformed screen ids', () => {
    const errors = validateFlow({
      screens: [
        screen({
          fields: [{ ...makeField('TextInput', [], 1), label: 'Name', name: 'name' }],
        }),
        screen({ id: 'lower case', title: 'Second' }),
        screen({ title: 'Third' }),
      ],
    });

    expect(errors.some((error) => error.includes('uppercase snake case'))).toBe(true);
    expect(errors.some((error) => error.includes('used twice'))).toBe(true);
  });

  it('catches a footer that navigates nowhere and a form with no terminal', () => {
    const errors = validateFlow({
      screens: [
        screen({
          terminal: false,
          nextScreenId: 'GONE',
          fields: [{ ...makeField('TextInput', [], 1), label: 'Name', name: 'name' }],
        }),
      ],
    });

    expect(errors.some((error) => error.includes('does not exist'))).toBe(true);
    expect(errors.some((error) => error.includes('No screen ends the form'))).toBe(true);
  });

  it('catches two terminals and a form that posts nothing', () => {
    const errors = validateFlow({
      screens: [screen(), screen({ id: 'SECOND', title: 'Second' })],
    });

    expect(errors.some((error) => error.includes('only one can post'))).toBe(true);
    expect(errors.some((error) => error.includes('posts no data'))).toBe(true);
  });

  it('catches a choice component with too few options and a repeated data key', () => {
    const dropdown = makeField('Dropdown', [], 1);
    const errors = validateFlow({
      screens: [
        screen({
          fields: [
            { ...dropdown, label: 'Service', options: [{ id: 'a', title: 'Only one' }] },
            { ...makeField('TextInput', [], 2), label: 'Name', name: dropdown.name },
          ],
        }),
      ],
    });

    expect(errors.some((error) => error.includes('at least two options'))).toBe(true);
    expect(errors.some((error) => error.includes('repeats'))).toBe(true);
  });
});

describe('whatsapp-flows helpers', () => {
  it('slugs labels into Meta data keys and screen ids', () => {
    expect(slugFor('Preferred date')).toBe('preferred_date');
    expect(slugFor('  ₹ Budget!! ')).toBe('budget');
    expect(screenIdFor('Book a slot')).toBe('BOOK_A_SLOT');
    expect(screenIdFor('Book a slot', ['BOOK_A_SLOT'])).toBe('BOOK_A_SLOT_2');
  });

  it('gives a new field a unique data key and sensible defaults', () => {
    const first = makeField('TextInput', [], 1);
    const second = makeField('TextInput', [first.name], 1);

    expect(first.name).toBe('single_line_input');
    // The second field of the same type gets a unique key rather than colliding.
    expect(second.name).toBe('single_line_input_2');
    // Retitling is what keeps them in step: the slug of the label.
    expect(makeField('Dropdown', [], 1).name).toBe('dropdown');
    expect(first.required).toBe(true);
    expect(makeField('OptIn', [], 1).options).toBeUndefined();
    expect(makeScreen([], 1).terminal).toBe(true);
    expect(makeScreen(['START'], 2).terminal).toBe(false);
  });

  it('describes the response payload a form would post', () => {
    const shape = responseShape({
      screens: [
        screen({
          fields: [
            { ...makeField('CheckboxGroup', [], 1), name: 'interests' },
            { ...makeField('OptIn', [], 2), name: 'consent' },
            { ...makeField('DatePicker', [], 3), name: 'preferred_date' },
            { ...makeField('TextInput', [], 4), name: 'full_name' },
            makeField('TextBody', [], 5),
          ],
        }),
      ],
    });

    expect(shape).toEqual([
      'interests: string[]',
      'consent: boolean',
      'preferred_date: date',
      'full_name: string',
    ]);
  });
});
