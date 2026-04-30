/**
 * Category icons mirroring the SF Symbols used in the GymRoam iOS app.
 * Each category also has a brand color (defined in searchData.ts).
 *
 * App symbols mapped:
 *   All       -> mappin.circle.fill
 *   Lifting   -> dumbbell.fill
 *   Pilates   -> figure.pilates
 *   Yoga      -> figure.mind.and.body
 *   Cycling   -> figure.outdoor.cycle
 *   Run Club  -> figure.run
 *   Wellness  -> leaf.fill
 *   Hyrox     -> bolt.fill
 */

interface IconProps {
  size?: number;
  className?: string;
}

export function AllIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
    </svg>
  );
}

export function LiftingIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.57 14.86l-1.43 1.43-2.86-2.86-3 3 2.86 2.86-1.43 1.43L11.86 18l-1.5 1.5 1.43 1.43-1.43 1.43-3.86-3.86-1.43 1.43L3.64 18.5l1.43-1.43-3.86-3.86 1.43-1.43 1.43 1.43 1.5-1.5-2.86-2.86 1.43-1.43 2.86 2.86 3-3-2.86-2.86 1.43-1.43L9.86 6l1.5-1.5L9.93 3.07l1.43-1.43 3.86 3.86 1.43-1.43L20.36 5.5l-1.43 1.43 3.86 3.86-1.43 1.43-1.43-1.43-1.5 1.5 2.86 2.86z" />
    </svg>
  );
}

export function PilatesIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="4" r="2" />
      <path d="M14 7h-4c-1.1 0-2 .9-2 2v4l-3 7h2l2-5v6h2v-5h2v5h2v-6l2 5h2l-3-7V9c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

export function YogaIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="4" r="2" />
      <path d="M19 11h-4l-1-2h-4l-1 2H5c-.55 0-1 .45-1 1s.45 1 1 1h3.5l-1.5 7h2l1.2-5h3.6l1.2 5h2l-1.5-7H19c.55 0 1-.45 1-1s-.45-1-1-1z" />
    </svg>
  );
}

export function CyclingIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="17.5" r="3.5" />
      <circle cx="19" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="2" />
      <path d="M12 17.5h2l-2-7 3-3 2 4h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RunIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="13" cy="4" r="2" />
      <path d="M13.49 14.5L11 11l3-2.5 2.7 2.2c.5.4 1.2.5 1.8.2L21 9.4l-.7-1.9-2.5 1L15 5.7c-.5-.4-1.2-.5-1.8-.2L9.7 7.7c-.7.4-1 1.3-.7 2L11 13l-3 2-2-1-1 1.7 3.5 2c.4.2.9.2 1.3 0L13 15.5l1.5 5.5h2l-1.6-5.7c-.1-.3-.2-.6-.4-.8z" />
    </svg>
  );
}

export function WellnessIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
    </svg>
  );
}

export function HyroxIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  );
}

/**
 * Single-export switch — renders the right icon for a given category name.
 */
export default function CategoryIcon({
  category,
  size = 16,
  className,
}: {
  category: string;
  size?: number;
  className?: string;
}) {
  switch (category) {
    case "All":
      return <AllIcon size={size} className={className} />;
    case "Lifting":
      return <LiftingIcon size={size} className={className} />;
    case "Pilates":
      return <PilatesIcon size={size} className={className} />;
    case "Yoga":
      return <YogaIcon size={size} className={className} />;
    case "Cycling":
      return <CyclingIcon size={size} className={className} />;
    case "Run Club":
      return <RunIcon size={size} className={className} />;
    case "Wellness":
      return <WellnessIcon size={size} className={className} />;
    case "Hyrox":
      return <HyroxIcon size={size} className={className} />;
    default:
      return <AllIcon size={size} className={className} />;
  }
}
