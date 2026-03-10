const COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600',
  analyzing: 'bg-blue-100 text-blue-700 animate-pulse',
  analyzed: 'bg-green-100 text-green-700',
  resolved: 'bg-teal-100 text-teal-700',
}

const LABELS: Record<string, string> = {
  new: '待分析',
  analyzing: '分析中…',
  analyzed: '已分析',
  resolved: '已解决',
}

export function StatusBadge({ status }: { status: string }) {
  const cls = COLORS[status] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {LABELS[status] ?? status}
    </span>
  )
}
