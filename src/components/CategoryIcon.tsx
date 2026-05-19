/**
 * Category icon — single switch component that renders the right Phosphor
 * icon for a given GymRoam activity category. Mirrors the SF Symbols used
 * in the iOS app so the website's category visuals match the app:
 *
 *   App symbol               -> Phosphor icon
 *   mappin.circle.fill       -> MapPin             (All)
 *   dumbbell.fill            -> Barbell            (Lifting)
 *   figure.pilates           -> PersonSimple       (Pilates)
 *   figure.mind.and.body     -> PersonSimpleTaiChi (Yoga)
 *   figure.outdoor.cycle     -> PersonSimpleBike   (Cycling)
 *   figure.run               -> PersonSimpleRun    (Run Club)
 *   leaf.fill                -> Leaf               (Wellness)
 *   bolt.fill                -> Lightning          (Hyrox)
 *
 * Each category also has a brand color (defined in searchData.ts) that
 * the parent applies via `style={{ color }}` — icons inherit currentColor.
 */

import {
  Barbell,
  Leaf,
  Lightning,
  MapPin,
  PersonSimple,
  PersonSimpleBike,
  PersonSimpleRun,
  PersonSimpleTaiChi,
} from "@phosphor-icons/react/dist/ssr";

interface Props {
  category: string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({ category, size = 16, className }: Props) {
  const weight = "fill" as const;
  switch (category) {
    case "All":
      return <MapPin size={size} weight={weight} className={className} />;
    case "Lifting":
      return <Barbell size={size} weight={weight} className={className} />;
    case "Pilates":
      return <PersonSimple size={size} weight={weight} className={className} />;
    case "Yoga":
      return <PersonSimpleTaiChi size={size} weight={weight} className={className} />;
    case "Cycling":
      return <PersonSimpleBike size={size} weight={weight} className={className} />;
    case "Run Club":
      return <PersonSimpleRun size={size} weight={weight} className={className} />;
    case "Wellness":
      return <Leaf size={size} weight={weight} className={className} />;
    case "Hyrox":
      return <Lightning size={size} weight={weight} className={className} />;
    default:
      return <MapPin size={size} weight={weight} className={className} />;
  }
}
