const COLORS: Record<string, string> = {
  js: 'bg-red-100 text-red-700',
  promise: 'bg-orange-100 text-orange-700',
  resource: 'bg-yellow-100 text-yellow-700',
  react: 'bg-pink-100 text-pink-700',
  xhr: 'bg-purple-100 text-purple-700',
  fetch: 'bg-blue-100 text-blue-700',
  'white-screen': 'bg-gray-100 text-gray-600',
}

const LABELS: Record<string, string> = {
  js: 'JS 错误',
  promise: 'Promise',
  resource: '资源错误',
  react: 'React',
  xhr: 'XHR',
  fetch: 'Fetch',
  'white-screen': '白屏',
}

export function SubTypeBadge({ subType }: { subType: string }) {
  const cls = COLORS[subType] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {LABELS[subType] ?? subType}
    </span>
  )
}
