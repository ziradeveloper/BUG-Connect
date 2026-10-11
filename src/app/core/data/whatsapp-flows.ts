import type {
  WaFormCategory,
  WaFormComponentType,
  WaFormField,
  WaFormInputType,
  WaFormScreen,
  WhatsAppFlowForm,
} from './entities';

/**
 * WhatsApp Flows (native in-chat forms) — the studio's model, the flow JSON it
 * generates and the validation that stands in for Meta's publish check.
 *
 * The emitted document follows Meta's published flow JSON shape: a `version`, a
 * `routing_model` of screen → next screens, and `screens[]` where each screen
 * has an `id`, a `title`, an optional `terminal` flag and a `layout` of type
 * `SingleColumnLayout` whose `children` are the components. Choice components
 * carry a `data-source` of `{ id, title }`; the closing `Footer` carries the
 * `on-click-action` — `navigate` to another screen, or `complete` to post the
 * response. Nothing here renames a property, so what the studio shows in its
 * JSON pane is what the platform would send.
 */

/** The flow JSON spec version the generator targets. */
export const FLOW_JSON_VERSION = '7.3';

/** Meta caps a screen at 50 components; the studio enforces the same number. */
export const MAX_COMPONENTS_PER_SCREEN = 50;

/** `TextInput`'s `max-chars` default, written out so the JSON is explicit. */
export const TEXT_INPUT_MAX_CHARS = 80;

/** `TextArea`'s `max-chars` default. */
export const TEXT_AREA_MAX_CHARS = 400;

export const WA_FORM_CATEGORIES: { id: WaFormCategory; label: string; hint: string }[] = [
  {
    id: 'APPOINTMENT_BOOKING',
    label: 'Appointment booking',
    hint: 'Date, slot and contact details for a visit',
  },
  {
    id: 'LEAD_GENERATION',
    label: 'Lead capture',
    hint: 'Name, interest and consent from an advert reply',
  },
  {
    id: 'CUSTOMER_SUPPORT',
    label: 'Customer support',
    hint: 'Order or issue details ahead of an agent handoff',
  },
  {
    id: 'ORDER_MANAGEMENT',
    label: 'Order management',
    hint: 'Address, items and delivery preference',
  },
  { id: 'OTHER', label: 'Other', hint: 'Anything the four above do not cover' },
];

export interface WaComponentSpec {
  type: WaFormComponentType;
  label: string;
  glyph: string;
  /** Whether the component posts a value under its data key. */
  collects: boolean;
  /** Whether the component needs a `data-source` of options. */
  choices: boolean;
  /** Whether the component accepts `required`. */
  optionalFlag: boolean;
  hint: string;
}

/** The studio palette, one row per component Meta renders. */
export const WA_FORM_COMPONENTS: WaComponentSpec[] = [
  {
    type: 'TextHeading',
    label: 'Heading',
    glyph: 'H',
    collects: false,
    choices: false,
    optionalFlag: false,
    hint: 'A short title inside the screen',
  },
  {
    type: 'TextBody',
    label: 'Paragraph',
    glyph: '¶',
    collects: false,
    choices: false,
    optionalFlag: false,
    hint: 'Explanatory copy; posts nothing',
  },
  {
    type: 'TextInput',
    label: 'Single-line input',
    glyph: '▭',
    collects: true,
    choices: false,
    optionalFlag: true,
    hint: 'Text, number, email, phone or passcode',
  },
  {
    type: 'TextArea',
    label: 'Multi-line input',
    glyph: '▤',
    collects: true,
    choices: false,
    optionalFlag: true,
    hint: 'Long answers, up to 400 characters',
  },
  {
    type: 'Dropdown',
    label: 'Dropdown',
    glyph: '▾',
    collects: true,
    choices: true,
    optionalFlag: true,
    hint: 'Pick one from a list',
  },
  {
    type: 'RadioButtonsGroup',
    label: 'Radio group',
    glyph: '◉',
    collects: true,
    choices: true,
    optionalFlag: true,
    hint: 'Pick one, options in view',
  },
  {
    type: 'CheckboxGroup',
    label: 'Checkbox group',
    glyph: '☑',
    collects: true,
    choices: true,
    optionalFlag: true,
    hint: 'Pick several; posts an array',
  },
  {
    type: 'DatePicker',
    label: 'Date picker',
    glyph: '▦',
    collects: true,
    choices: false,
    optionalFlag: true,
    hint: 'Calendar input, posted as a date',
  },
  {
    type: 'OptIn',
    label: 'Consent checkbox',
    glyph: '✓',
    collects: true,
    choices: false,
    optionalFlag: false,
    hint: 'Marketing consent; posts a boolean',
  },
];

export const WA_INPUT_TYPES: { id: WaFormInputType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'password', label: 'Password' },
  { id: 'passcode', label: 'Passcode' },
];

const COMPONENT_BY_TYPE = new Map<WaComponentSpec['type'], WaComponentSpec>(
  WA_FORM_COMPONENTS.map((spec) => [spec.type, spec]),
);

export function componentSpec(type: WaFormComponentType): WaComponentSpec {
  return (
    COMPONENT_BY_TYPE.get(type) ??
    ({
      type,
      label: type,
      glyph: '•',
      collects: true,
      choices: false,
      optionalFlag: true,
      hint: '',
    } satisfies WaComponentSpec)
  );
}

export function categoryLabel(category: WaFormCategory): string {
  return WA_FORM_CATEGORIES.find((entry) => entry.id === category)?.label ?? category;
}

/** A data key from a label: `Preferred date` → `preferred_date`. */
export function slugFor(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'field';
}

/** Meta screen ids are uppercase snake case and unique inside a flow. */
export function screenIdFor(title: string, taken: readonly string[] = []): string {
  const base =
    slugFor(title)
      .toUpperCase()
      .replace(/^([0-9])/, 'SCREEN_$1') || 'SCREEN';

  let candidate = base;
  let suffix = 2;
  while (taken.includes(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/**
 * A fresh component of the requested type, wired for the studio. The data key
 * starts as the slug of the label, so the editor can tell an untouched key from
 * one the author typed — retitling a component only renames the former.
 */
export function makeField(
  type: WaFormComponentType,
  takenNames: readonly string[] = [],
  sequence = 1,
): WaFormField {
  const spec = componentSpec(type);
  const base = spec.collects ? slugFor(spec.label) : '';
  let name = base;
  let suffix = 2;
  while (name && takenNames.includes(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }

  const field: WaFormField = {
    id: `f-${type.toLowerCase()}-${Date.now().toString(36)}-${sequence}`,
    type,
    label: spec.label,
    name: spec.collects ? name : '',
    required: spec.optionalFlag,
  };

  if (spec.choices) {
    field.options = [
      { id: 'option_1', title: 'First option' },
      { id: 'option_2', title: 'Second option' },
    ];
  }
  if (type === 'TextInput') {
    field.inputType = 'text';
  }

  return field;
}

/** A new screen with a unique Meta id, ready to accept components. */
export function makeScreen(taken: readonly string[] = [], sequence = 1): WaFormScreen {
  const title = sequence === 1 ? 'Start' : `Screen ${sequence}`;
  return {
    id: screenIdFor(title, taken),
    title,
    subtitle: null,
    fields: [],
    terminal: taken.length === 0,
    nextScreenId: null,
    footerLabel: taken.length === 0 ? 'Submit' : 'Continue',
  };
}

/* ── Flow JSON generation ───────────────────────────────────────── */

type JsonObject = Record<string, unknown>;

/** Every value a screen posts, keyed by the screen that collected it. */
export function collectedBefore(
  screens: readonly WaFormScreen[],
  screenId: string,
): { screenId: string; field: WaFormField }[] {
  const index = screens.findIndex((screen) => screen.id === screenId);
  const upto = index < 0 ? screens : screens.slice(0, index);

  return upto.flatMap((screen) =>
    screen.fields
      .filter((field) => componentSpec(field.type).collects && field.name)
      .map((field) => ({ screenId: screen.id, field })),
  );
}

/** Fields on the screen itself, referenced as `${form.<name>}`. */
function currentPayload(screen: WaFormScreen): JsonObject {
  const payload: JsonObject = {};
  for (const field of screen.fields) {
    if (componentSpec(field.type).collects && field.name) {
      payload[field.name] = `\${form.${field.name}}`;
    }
  }
  return payload;
}

function footerJson(screen: WaFormScreen, screens: readonly WaFormScreen[]): JsonObject {
  const payload: JsonObject = { ...currentPayload(screen) };

  if (screen.terminal) {
    for (const entry of collectedBefore(screens, screen.id)) {
      payload[entry.field.name] = `\${screen.${entry.screenId}.form.${entry.field.name}}`;
    }
  }

  return {
    type: 'Footer',
    label: screen.footerLabel.trim() || (screen.terminal ? 'Submit' : 'Continue'),
    'on-click-action': screen.terminal
      ? { name: 'complete', payload }
      : {
          name: 'navigate',
          next: { type: 'screen', name: screen.nextScreenId ?? screen.id },
          payload,
        },
  };
}

function componentJson(field: WaFormField): JsonObject {
  const spec = componentSpec(field.type);

  switch (field.type) {
    case 'TextHeading':
    case 'TextBody':
      return { type: field.type, text: field.label };
    case 'TextInput':
      return {
        type: 'TextInput',
        name: field.name,
        label: field.label,
        'input-type': field.inputType ?? 'text',
        'max-chars': TEXT_INPUT_MAX_CHARS,
        ...(spec.optionalFlag && field.required ? { required: true } : {}),
        ...(field.placeholder ? { placeholder: field.placeholder } : {}),
        ...(field.helperText ? { 'helper-text': field.helperText } : {}),
      };
    case 'TextArea':
      return {
        type: 'TextArea',
        name: field.name,
        label: field.label,
        'max-chars': TEXT_AREA_MAX_CHARS,
        ...(field.required ? { required: true } : {}),
        ...(field.placeholder ? { placeholder: field.placeholder } : {}),
      };
    case 'Dropdown':
    case 'RadioButtonsGroup':
    case 'CheckboxGroup':
      return {
        type: field.type,
        name: field.name,
        label: field.label,
        ...(field.required ? { required: true } : {}),
        'data-source': (field.options ?? []).map((option) => ({
          id: option.id,
          title: option.title,
        })),
      };
    case 'DatePicker':
      return {
        type: 'DatePicker',
        name: field.name,
        label: field.label,
        ...(field.required ? { required: true } : {}),
      };
    case 'OptIn':
      return { type: 'OptIn', name: field.name, label: field.label };
  }
}

function screenJson(screen: WaFormScreen, screens: readonly WaFormScreen[]): JsonObject {
  const children: JsonObject[] = [];

  if (screen.subtitle?.trim()) {
    children.push({ type: 'TextBody', text: screen.subtitle.trim() });
  }
  for (const field of screen.fields) {
    children.push(componentJson(field));
  }
  children.push(footerJson(screen, screens));

  return {
    id: screen.id,
    title: screen.title,
    ...(screen.terminal ? { terminal: true } : {}),
    layout: { type: 'SingleColumnLayout', children },
  };
}

/**
 * The flow JSON document for a form: version, routing model and screens. This is
 * the string the platform would `POST` to `/{waba-id}/flows` as `flow_json`.
 */
export function toFlowJson(
  form: Pick<WhatsAppFlowForm, 'screens'>,
  options: { version?: string } = {},
): JsonObject {
  const routing: Record<string, string[]> = {};

  for (const screen of form.screens) {
    routing[screen.id] =
      !screen.terminal && screen.nextScreenId ? [screen.nextScreenId] : [];
  }

  return {
    version: options.version ?? FLOW_JSON_VERSION,
    routing_model: routing,
    screens: form.screens.map((screen) => screenJson(screen, form.screens)),
  };
}

/** Pretty-printed flow JSON, for the studio's code pane and the copy button. */
export function flowJson(form: Pick<WhatsAppFlowForm, 'screens'>): string {
  return JSON.stringify(toFlowJson(form), null, 2);
}

/** Byte size Meta would measure the document against its 10 MB cap. */
export function flowJsonBytes(form: Pick<WhatsAppFlowForm, 'screens'>): number {
  return new TextEncoder().encode(flowJson(form)).length;
}

/* ── Validation ─────────────────────────────────────────────────── */

const SCREEN_ID_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * The publish gate. Mirrors the checks Meta's `validation_errors` returns —
 * duplicate screen ids, malformed ids, missing labels, dangling navigation and
 * a form that posts nothing — so the studio refuses before the platform would.
 */
export function validateFlow(form: Pick<WhatsAppFlowForm, 'screens'>): string[] {
  const errors: string[] = [];
  const screens = form.screens;

  if (screens.length === 0) {
    return ['Add at least one screen before publishing.'];
  }

  const seen = new Set<string>();
  for (const screen of screens) {
    const where = `Screen “${screen.id || 'untitled'}”`;

    if (!screen.id.trim()) {
      errors.push('Every screen needs an id.');
    } else if (!SCREEN_ID_PATTERN.test(screen.id)) {
      errors.push(`${where}: ids are uppercase snake case, e.g. BOOKING_DETAILS.`);
    } else if (seen.has(screen.id)) {
      errors.push(`${where}: that screen id is used twice.`);
    }
    seen.add(screen.id);

    if (!screen.title.trim()) {
      errors.push(`${where} needs a title — Meta shows it as the form header.`);
    }

    if (screen.fields.length > MAX_COMPONENTS_PER_SCREEN) {
      errors.push(
        `${where} has ${screen.fields.length} components; Meta allows ${MAX_COMPONENTS_PER_SCREEN}.`,
      );
    }

    const names = new Set<string>();
    for (const field of screen.fields) {
      const spec = componentSpec(field.type);
      const label = field.label.trim() ? `“${field.label.trim()}”` : `A ${spec.label}`;

      if (!spec.collects) {
        if (!field.label.trim()) {
          errors.push(`${where}: the ${spec.label.toLowerCase()} has no copy.`);
        }
        continue;
      }

      if (!field.label.trim()) {
        errors.push(`${where}: ${label.toLowerCase()} needs a label.`);
      }
      if (!field.name.trim()) {
        errors.push(`${where}: ${label} needs a data key to post under.`);
      } else if (names.has(field.name)) {
        errors.push(`${where}: the data key “${field.name}” repeats.`);
      }
      names.add(field.name);

      if (spec.choices && (field.options?.length ?? 0) < 2) {
        errors.push(`${where}: ${label} needs at least two options.`);
      }
      if (spec.choices && (field.options ?? []).some((option) => !option.title.trim())) {
        errors.push(`${where}: ${label} has an option with no title.`);
      }
    }

    if (!screen.terminal) {
      if (!screen.nextScreenId) {
        errors.push(`${where} has no next screen — pick one or end the form here.`);
      } else if (!screens.some((candidate) => candidate.id === screen.nextScreenId)) {
        errors.push(`${where} navigates to “${screen.nextScreenId}”, which does not exist.`);
      }
    }
  }

  const terminals = screens.filter((screen) => screen.terminal);
  if (terminals.length === 0) {
    errors.push('No screen ends the form — mark the last one terminal so it can post.');
  } else if (terminals.length > 1) {
    errors.push(
      `${terminals.length} screens end the form (${terminals
        .map((screen) => screen.id)
        .join(', ')}); only one can post the response.`,
    );
  }

  const collected = screens.flatMap((screen) =>
    screen.fields.filter((field) => componentSpec(field.type).collects && field.name),
  );
  if (collected.length === 0) {
    errors.push('The form posts no data — add at least one input before the last screen.');
  }

  return errors;
}

/** What a submitted form would post, for the studio's response preview. */
export function responseShape(form: Pick<WhatsAppFlowForm, 'screens'>): string[] {
  return form.screens.flatMap((screen) =>
    screen.fields
      .filter((field) => componentSpec(field.type).collects && field.name)
      .map(
        (field) =>
          `${field.name}: ${
            field.type === 'CheckboxGroup'
              ? 'string[]'
              : field.type === 'OptIn'
                ? 'boolean'
                : field.type === 'DatePicker'
                  ? 'date'
                  : 'string'
          }`,
      ),
  );
}
