import {
  IconBolt,
  IconBriefcase,
  IconBulb,
  IconCamera,
  IconChartArrowsVertical,
  IconCode,
  IconHeadset,
  IconLayoutKanban,
  IconMovie,
  IconPalette,
  IconRocket,
  IconSend,
  IconSparkles,
  IconSpeakerphone,
  IconTarget,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

/** Icons a team or board can pick. Stored by name in the database. */
export const ICONS: Record<string, Icon> = {
  "layout-kanban": IconLayoutKanban,
  code: IconCode,
  palette: IconPalette,
  "chart-arrows-vertical": IconChartArrowsVertical,
  speakerphone: IconSpeakerphone,
  send: IconSend,
  users: IconUsers,
  sparkles: IconSparkles,
  rocket: IconRocket,
  bulb: IconBulb,
  target: IconTarget,
  briefcase: IconBriefcase,
  camera: IconCamera,
  movie: IconMovie,
  headset: IconHeadset,
  bolt: IconBolt,
};

export function DynamicIcon({ name, className, stroke = 1.75 }: { name: string; className?: string; stroke?: number }) {
  const Component = ICONS[name] ?? IconLayoutKanban;
  return <Component className={className} stroke={stroke} />;
}
