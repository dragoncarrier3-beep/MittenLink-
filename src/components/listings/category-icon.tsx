import {
  Activity,
  Baby,
  Briefcase,
  Bus,
  Coffee,
  Cpu,
  Ear,
  Eye,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  House,
  KeyRound,
  LayoutGrid,
  PiggyBank,
  Puzzle,
  Scale,
  Stethoscope,
  Trees,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  puzzle: Puzzle,
  briefcase: Briefcase,
  bus: Bus,
  home: House,
  "heart-handshake": HeartHandshake,
  cpu: Cpu,
  "graduation-cap": GraduationCap,
  trees: Trees,
  "key-round": KeyRound,
  "hand-heart": HandHeart,
  scale: Scale,
  "piggy-bank": PiggyBank,
  activity: Activity,
  coffee: Coffee,
  baby: Baby,
  ear: Ear,
  eye: Eye,
  stethoscope: Stethoscope,
};

/** Decorative icon for a category (lucide name stored in categories.icon). */
export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || LayoutGrid;
  return <Icon className={className} aria-hidden />;
}
