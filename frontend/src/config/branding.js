const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBooleanEnv(value, defaultValue) {
  if (value == null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

export const DEFAULT_SHOW_FS_LOGO = parseBooleanEnv(import.meta.env.VITE_SHOW_FS_LOGO, true);

export const BRANDING_STORAGE_KEY = 'show_fs_logo';

export const BRANDING_DEFAULTS = {
  showLogo: DEFAULT_SHOW_FS_LOGO,
  wordmarkSrc: '/FS.png',
  markSrc: '/FSSML.png',
  brandedName: 'Forecast Simulator',
  whiteLabelName: 'Scenario Simulator',
};
