import { useBranding } from '../../contexts/BrandingContext';

export function BrandHeaderLockup({ className = '' }) {
  const branding = useBranding();

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      {branding.showLogo && (
        <>
          <img
            src={branding.markSrc}
            alt={branding.brandedName}
            className="h-8 w-8 rounded-lg object-cover shadow-sm"
          />
          <span className="h-6 w-px bg-surface-300/80" aria-hidden="true" />
        </>
      )}

      <span className="text-sm font-extrabold text-daikin-dark tracking-tight">
        {branding.whiteLabelName.toUpperCase()}
      </span>
    </div>
  );
}

export function BrandLoginLockup({ className = '' }) {
  const branding = useBranding();

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`.trim()}>
      {branding.showLogo && (
        <img
          src={branding.markSrc}
          alt={branding.brandedName}
          className="h-16 w-16 rounded-2xl object-cover shadow-[0_14px_34px_rgba(141,183,79,0.28)] ring-1 ring-black/5"
        />
      )}

      <div className="text-center">
        <h1 className="text-lg font-semibold text-daikin-dark">
          {branding.whiteLabelName}
        </h1>
      </div>
    </div>
  );
}

export function BrandWordmark({
  variant = 'inline',
  imageClassName = '',
  fallbackClassName = '',
}) {
  const branding = useBranding();

  if (branding.showLogo) {
    return (
      <img
        src={branding.wordmarkSrc}
        alt={branding.brandedName}
        className={imageClassName}
      />
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={fallbackClassName}>
        <span className="text-sm font-extrabold text-daikin-dark tracking-tight leading-none">SCENARIO</span>
        <span className="text-[9px] font-semibold text-surface-400 tracking-[0.2em] leading-none mt-0.5">SIMULATOR</span>
      </div>
    );
  }

  return (
    <span className={fallbackClassName}>
      {branding.whiteLabelName.toUpperCase()}
    </span>
  );
}

export function BrandIcon({ className = '', fallbackClassName = '', fallbackLabel = 'SS', alt }) {
  const branding = useBranding();

  if (branding.showLogo) {
    return (
      <img
        src={branding.markSrc}
        alt={alt || branding.brandedName}
        className={className}
      />
    );
  }

  return (
    <div
      className={fallbackClassName}
      aria-label={`${branding.whiteLabelName} logo`}
      role="img"
    >
      <span>{fallbackLabel}</span>
    </div>
  );
}
