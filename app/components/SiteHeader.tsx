'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SiteHeader() {
  const pathname = usePathname()
  const isBandi = pathname.startsWith('/bandi')

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link href="/" className="text-sm font-bold text-emerald-700 tracking-tight hover:text-emerald-600">
          FondiRadar
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              !isBandi
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            PNRR per Comune
          </Link>
          <Link
            href="/bandi"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isBandi
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Bandi aperti
          </Link>
        </nav>
      </div>
    </header>
  )
}
