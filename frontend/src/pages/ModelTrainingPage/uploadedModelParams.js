function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

function clampNumber(value, field, fallback, coerce) {
  if (isBlank(value)) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  let normalized = coerce(parsed);
  if (Number.isFinite(field.min) && normalized < field.min) normalized = field.min;
  if (Number.isFinite(field.max) && normalized > field.max) normalized = field.max;
  return normalized;
}

export function createDefaultCustomModelParams(schema = {}) {
  return Object.fromEntries(
    Object.entries(schema || {}).map(([key, field]) => [key, field.default])
  );
}

export function buildCustomModelParams(schema = {}, values = {}) {
  const params = {};

  for (const [key, field] of Object.entries(schema || {})) {
    const value = values?.[key] ?? field.default;

    if (field.type === 'int') {
      params[key] = clampNumber(value, field, field.default, Math.round);
    } else if (field.type === 'float') {
      params[key] = clampNumber(value, field, field.default, (number) => number);
    } else if (field.type === 'bool') {
      params[key] = Boolean(value);
    } else if (field.type === 'select') {
      params[key] = field.options?.includes(value) ? value : field.default;
    } else {
      params[key] = value ?? field.default;
    }
  }

  return params;
}

export function validateCustomModelParams(schema = {}, values = {}) {
  if (!schema) return { ok: true, errors: {} };

  const errors = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = values?.[key];
    if (isBlank(value)) continue;

    if (field.type === 'int' || field.type === 'float') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        errors[key] = 'Value must be a finite number';
        continue;
      }

      if (
        (Number.isFinite(field.min) && parsed < field.min) ||
        (Number.isFinite(field.max) && parsed > field.max)
      ) {
        errors[key] = `Value must be between ${field.min} and ${field.max}`;
      }
    } else if (field.type === 'select' && !field.options?.includes(value)) {
      errors[key] = 'Value must be one of the supported options';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
