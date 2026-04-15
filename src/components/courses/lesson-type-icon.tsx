import {
  BookOpen,
  CalendarDays,
  ExternalLink,
  FileText,
  ListChecks,
  MapPin,
  MessageSquare,
  Video,
} from 'lucide-react'

export function LessonTypeIcon({ type }: { type: string }) {
  const iconCls = 'size-4 shrink-0'
  switch (type) {
    case 'video':
      return <Video className={`${iconCls} text-blue-500`} aria-hidden />
    case 'assignment':
      return <FileText className={`${iconCls} text-green-500`} aria-hidden />
    case 'live_session':
      return <CalendarDays className={`${iconCls} text-purple-500`} aria-hidden />
    case 'offline_session':
      return <MapPin className={`${iconCls} text-amber-500`} aria-hidden />
    case 'mcq':
      return <ListChecks className={`${iconCls} text-cyan-600`} aria-hidden />
    case 'feedback':
      return <MessageSquare className={`${iconCls} text-rose-500`} aria-hidden />
    case 'external_resource':
      return <ExternalLink className={`${iconCls} text-indigo-500`} aria-hidden />
    default:
      return <BookOpen className={`${iconCls} text-slate-400`} aria-hidden />
  }
}
