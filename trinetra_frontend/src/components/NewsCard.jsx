import { ExternalLink, Clock, Shield, ChevronRight } from 'lucide-react'

function timeAgo(dateString) {
  const now = new Date()
  const then = new Date(dateString)
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NewsCard({ article }) {
  const { title, description, image, url, published_at, source } = article

  return (
    <article className="card group flex flex-col hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300 animate-fade-in">
      {/* Image */}
      {image ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute top-3 left-3">
            <div className="flex items-center gap-1.5 bg-navy-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg">
              <Shield className="w-3 h-3 text-trinetra-green" />
              <span className="text-white text-xs font-medium">{source?.name || 'News'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-2 bg-gradient-to-r from-trinetra-blue to-trinetra-blue-light" />
      )}

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {!image && (
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-trinetra-green flex-shrink-0" />
            <span className="text-trinetra-blue text-xs font-semibold uppercase tracking-wide truncate">{source?.name || 'News'}</span>
          </div>
        )}

        <h3 className="text-slate-800 font-semibold text-base leading-snug line-clamp-3 mb-3 group-hover:text-trinetra-blue transition-colors duration-200">
          {title}
        </h3>

        {description && (
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4 flex-1">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeAgo(published_at)}</span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-trinetra-blue text-xs font-semibold hover:text-trinetra-blue-light transition-colors group/link"
            aria-label={`Read full article: ${title}`}
          >
            Read article
            <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </article>
  )
}
