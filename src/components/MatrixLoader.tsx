type MatrixLoaderProps = {
  label?: string
  small?: boolean
  className?: string
  showLabel?: boolean
  fullscreen?: boolean
}

export default function MatrixLoader({
  label = 'Loading...',
  small = false,
  className = '',
  showLabel = true,
  fullscreen = false,
}: MatrixLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fullscreen ? 'fixed inset-0 z-40 flex items-center justify-center bg-white/30 p-4 backdrop-blur-sm' : ''} ${className}`}
    >
      <div className="inline-flex items-center gap-3 rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm backdrop-blur-md">
        <span className={`matrix-loader ${small ? 'matrix-loader-sm' : ''}`} aria-hidden />
        {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
      </div>
    </div>
  )
}
