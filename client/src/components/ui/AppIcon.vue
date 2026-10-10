<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleHelp,
  CircleX,
  Copy,
  Crown,
  Download,
  EllipsisVertical,
  Eye,
  EyeOff,
  FastForward,
  Fingerprint,
  Gavel,
  Grid2X2,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Moon,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Skull,
  Smartphone,
  Sparkles,
  SquareStack,
  Timer,
  Trophy,
  User,
  UserRoundPlus,
  Users,
  VolumeX,
  WifiOff,
  X,
  Zap,
} from '@lucide/vue'

const props = defineProps<{ name: string }>()
// Compatibility map keeps gameplay phase names and component APIs stable.
const icons = {
  add: Plus,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  auto_awesome: Sparkles,
  badge: BadgeCheck,
  bedtime: Moon,
  cancel: CircleX,
  check: Check,
  check_circle: CheckCircle2,
  close: X,
  content_copy: Copy,
  crown: Crown,
  skull: Skull,
  dark_mode: Moon,
  dashboard: Grid2X2,
  domino_mask: Skull,
  download: Download,
  edit: Pencil,
  emergency: Zap,
  emoji_events: Trophy,
  error: CircleAlert,
  fast_forward: FastForward,
  fingerprint: Fingerprint,
  forum: MessageCircle,
  gavel: Gavel,
  groups: Users,
  info: Info,
  install_mobile: Smartphone,
  ios_share: Share2,
  key: KeyRound,
  keyboard_arrow_down: ChevronDown,
  keyboard_arrow_up: ChevronUp,
  local_police: ShieldCheck,
  lock: LockKeyhole,
  logout: LogOut,
  more_vert: EllipsisVertical,
  nights_stay: Moon,
  person: User,
  person_add: UserRoundPlus,
  play_arrow: Play,
  refresh: RotateCcw,
  replay: RotateCcw,
  restart_alt: RotateCcw,
  search: Search,
  share: Share2,
  shield: Shield,
  skip_next: FastForward,
  style: SquareStack,
  timer: Timer,
  visibility: Eye,
  visibility_off: EyeOff,
  volume_off: VolumeX,
  warning: CircleAlert,
  wifi_off: WifiOff,
}
const icon = computed(() => icons[props.name as keyof typeof icons] ?? CircleHelp)
</script>

<template>
  <component :is="icon" class="app-icon" :stroke-width="2" aria-hidden="true" focusable="false" />
</template>

<style scoped>
.app-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  vertical-align: -0.125em;
}
</style>
