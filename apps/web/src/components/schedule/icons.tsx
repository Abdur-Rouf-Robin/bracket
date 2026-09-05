'use client';

// Thin re-exports so schedule components share one icon import surface.
export {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Expand,
  GripVertical,
  Link2,
  List,
  LayoutGrid,
  Maximize2,
  MonitorPlay,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Flag, LoaderCircle, TriangleAlert } from 'lucide-react';

export const AlertTriangle = TriangleAlert;
export const Loader2 = LoaderCircle;
/** lucide has no whistle icon; a flag reads as "official" well enough. */
export const Whistle = Flag;
