import {
  Type, AlignLeft, Hash, ToggleLeft, Calendar, CalendarClock, Clock,
  Braces, List, Link2, Mail, Lock, Globe, Image, ArrowLeftRight,
  Layers, LayoutGrid, FileText, Fingerprint,
} from "lucide-react";
import { FieldType } from "@/lib/types";

const ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  string: Type,
  text: AlignLeft,
  richtext: FileText,
  richblock: FileText,
  int: Hash,
  float: Hash,
  decimal: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  datetime: CalendarClock,
  time: Clock,
  json: Braces,
  enum: List,
  uid: Fingerprint,
  email: Mail,
  password: Lock,
  url: Globe,
  media: Image,
  relation: ArrowLeftRight,
  component: Layers,
  dynamiczone: LayoutGrid,
};

const LABELS: Record<FieldType, string> = {
  string: "Short Text",
  text: "Long Text",
  richtext: "Rich Text",
  richblock: "Rich Block",
  int: "Integer",
  float: "Float",
  decimal: "Decimal",
  boolean: "Boolean",
  date: "Date",
  datetime: "Date & Time",
  time: "Time",
  json: "JSON",
  enum: "Enumeration",
  uid: "UID",
  email: "Email",
  password: "Password",
  url: "URL",
  media: "Media",
  relation: "Relation",
  component: "Component",
  dynamiczone: "Dynamic Zone",
};

export function FieldTypeIcon({ type, className = "h-4 w-4" }: { type: FieldType; className?: string }) {
  const Icon = ICONS[type] ?? Type;
  return <Icon className={className} />;
}

export function fieldTypeLabel(type: FieldType): string {
  return LABELS[type] ?? type;
}

export { LABELS as FIELD_TYPE_LABELS };
