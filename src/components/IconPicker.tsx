import { useEffect, useRef, useState } from "react";
import { useAppIsActive } from "../hooks/useAppInteraction";
import {
  Box,
  Calendar,
  CheckSquare,
  Database,
  FileText,
  Flag,
  Folder,
  Gauge,
  GraduationCap,
  Grid,
  Heart,
  Key,
  Layers,
  Lightbulb,
  Link2,
  List,
  Lock,
  Map,
  Music,
  Package,
  PieChart,
  Settings,
  Shield,
  Sparkles,
  Star,
  Tag,
  Target,
  Trash2,
  TreePine,
  Truck,
  Users,
  Zap,
  X,
  Wand2,
  Sword,
  Crown,
  Skull,
  Scroll,
  Compass,
  Flame,
  Droplet,
  Wind,
  Cloud,
  Sun,
  Moon,
  Anchor,
  Ship,
  Gift,
  Gem,
  Coins,
  Eye,
  Feather,
  PenTool,
  Palette,
  Trophy,
  Beaker,
  Microscope,
  Bookmark,
  Hourglass,
  Clock,
  AlertCircle,
  Info,
  Crosshair,
  Hexagon,
  Activity,
  Aperture,
  Barcode,
  Bell,
  Briefcase,
} from "lucide-react";
import "../App.css";

export type IconName =
  | "default"
  | "bookmark"
  | "box"
  | "calendar"
  | "checkbox"
  | "database"
  | "document"
  | "flag"
  | "folder"
  | "gauge"
  | "graduation"
  | "grid"
  | "heart"
  | "key"
  | "lightbulb"
  | "link"
  | "list"
  | "lock"
  | "map"
  | "music"
  | "package"
  | "chart"
  | "settings"
  | "shield"
  | "sparkles"
  | "star"
  | "tag"
  | "target"
  | "trash"
  | "tree"
  | "layers"
  | "truck"
  | "users"
  | "zap"
  | "wand"
  | "sword"
  | "crown"
  | "skull"
  | "scroll"
  | "compass"
  | "flame"
  | "droplet"
  | "wind"
  | "cloud"
  | "sun"
  | "moon"
  | "anchor"
  | "ship"
  | "gift"
  | "gem"
  | "coins"
  | "eye"
  | "feather"
  | "pen"
  | "palette"
  | "trophy"
  | "beaker"
  | "microscope"
  | "bookmarked"
  | "hourglass"
  | "clock"
  | "alert"
  | "info"
  | "crosshair"
  | "hexagon"
  | "activity"
  | "aperture"
  | "barcode"
  | "bell"
  | "briefcase";

interface IconPickerProps {
  onSelect: (iconName: IconName) => void;
  onClose: () => void;
  x?: number;
  y?: number;
}

const ICON_OPTIONS: Array<{ name: IconName; label: string; Icon: any }> = [
  { name: "default", label: "Default", Icon: Folder },
  { name: "bookmark", label: "Bookmark", Icon: Bookmark },
  { name: "box", label: "Box", Icon: Box },
  { name: "calendar", label: "Calendar", Icon: Calendar },
  { name: "checkbox", label: "Checkbox", Icon: CheckSquare },
  { name: "database", label: "Database", Icon: Database },
  { name: "document", label: "Document", Icon: FileText },
  { name: "flag", label: "Flag", Icon: Flag },
  { name: "folder", label: "Folder", Icon: Folder },
  { name: "gauge", label: "Gauge", Icon: Gauge },
  { name: "graduation", label: "Graduation", Icon: GraduationCap },
  { name: "grid", label: "Grid", Icon: Grid },
  { name: "heart", label: "Heart", Icon: Heart },
  { name: "key", label: "Key", Icon: Key },
  { name: "lightbulb", label: "Lightbulb", Icon: Lightbulb },
  { name: "link", label: "Link", Icon: Link2 },
  { name: "list", label: "List", Icon: List },
  { name: "lock", label: "Lock", Icon: Lock },
  { name: "map", label: "Map", Icon: Map },
  { name: "music", label: "Music", Icon: Music },
  { name: "package", label: "Package", Icon: Package },
  { name: "chart", label: "Chart", Icon: PieChart },
  { name: "settings", label: "Settings", Icon: Settings },
  { name: "shield", label: "Shield", Icon: Shield },
  { name: "sparkles", label: "Sparkles", Icon: Sparkles },
  { name: "star", label: "Star", Icon: Star },
  { name: "tag", label: "Tag", Icon: Tag },
  { name: "target", label: "Target", Icon: Target },
  { name: "trash", label: "Trash", Icon: Trash2 },
  { name: "tree", label: "Tree", Icon: TreePine },
  { name: "layers", label: "Layers", Icon: Layers },
  { name: "truck", label: "Truck", Icon: Truck },
  { name: "users", label: "Users", Icon: Users },
  { name: "zap", label: "Zap", Icon: Zap },
  // Worldbuilding & Fantasy
  { name: "wand", label: "Wand", Icon: Wand2 },
  { name: "sword", label: "Sword", Icon: Sword },
  { name: "crown", label: "Crown", Icon: Crown },
  { name: "skull", label: "Skull", Icon: Skull },
  { name: "scroll", label: "Scroll", Icon: Scroll },
  { name: "compass", label: "Compass", Icon: Compass },
  // Elements & Nature
  { name: "flame", label: "Flame", Icon: Flame },
  { name: "droplet", label: "Droplet", Icon: Droplet },
  { name: "wind", label: "Wind", Icon: Wind },
  { name: "cloud", label: "Cloud", Icon: Cloud },
  { name: "sun", label: "Sun", Icon: Sun },
  { name: "moon", label: "Moon", Icon: Moon },
  // Exploration & Adventure
  { name: "anchor", label: "Anchor", Icon: Anchor },
  { name: "ship", label: "Ship", Icon: Ship },
  { name: "gift", label: "Gift", Icon: Gift },
  { name: "gem", label: "Gem", Icon: Gem },
  { name: "coins", label: "Coins", Icon: Coins },
  { name: "eye", label: "Eye", Icon: Eye },
  // Knowledge & Creativity
  { name: "feather", label: "Feather", Icon: Feather },
  { name: "pen", label: "Pen", Icon: PenTool },
  { name: "palette", label: "Palette", Icon: Palette },
  { name: "trophy", label: "Trophy", Icon: Trophy },
  { name: "beaker", label: "Beaker", Icon: Beaker },
  { name: "microscope", label: "Microscope", Icon: Microscope },

  { name: "hourglass", label: "Hourglass", Icon: Hourglass },
  { name: "clock", label: "Clock", Icon: Clock },
  // Status & State
  { name: "alert", label: "Alert", Icon: AlertCircle },
  { name: "info", label: "Info", Icon: Info },
  { name: "crosshair", label: "Crosshair", Icon: Crosshair },
  { name: "hexagon", label: "Hexagon", Icon: Hexagon },
  { name: "activity", label: "Activity", Icon: Activity },
  { name: "aperture", label: "Aperture", Icon: Aperture },
  { name: "barcode", label: "Barcode", Icon: Barcode },
  { name: "bell", label: "Bell", Icon: Bell },
  { name: "briefcase", label: "Briefcase", Icon: Briefcase },
];

export function IconPicker({ onSelect, onClose, x = 0, y = 0 }: IconPickerProps) {
  const appActive = useAppIsActive();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > window.innerWidth) {
      adjustedX = Math.max(10, window.innerWidth - rect.width - 10);
    }

    if (y + rect.height > window.innerHeight) {
      adjustedY = Math.max(10, window.innerHeight - rect.height - 10);
    }

    setAdjustedPos({ x: adjustedX, y: adjustedY });
  }, [x, y]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (!appActive) return;
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, appActive]);

  return (
    <div
      ref={menuRef}
      className="icon-picker"
      style={{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px` }}
    >
      <div className="icon-picker-header">
        <span>Choose Icon</span>
        <button type="button" onClick={onClose} className="icon-picker-close">
          <X size={16} />
        </button>
      </div>
      <div className="icon-picker-grid">
        {ICON_OPTIONS.map(({ name, label, Icon }) => (
          <button
            key={name}
            type="button"
            className="icon-picker-item"
            onClick={() => {
              onSelect(name);
              onClose();
            }}
            title={label}
          >
            <Icon size={18} />
            <span className="icon-picker-item-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function getIconComponent(iconName: IconName | undefined | string) {
  if (!iconName || iconName === "default") return Folder;
  const option = ICON_OPTIONS.find((o) => o.name === iconName);
  return option?.Icon || Folder;
}
