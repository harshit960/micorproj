'use client'

import { useState } from 'react'

export function VideoEmbed({ id, title, channel, duration }: { id: string; title: string; channel?: string; duration?: string }) {
  const [on, setOn] = useState(false)
  return (
    <div className="video">
      <div className="video-frame">
        {on ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
            <button type="button" className="video-play" onClick={() => setOn(true)} aria-label={`Play ${title}`} />
          </>
        )}
      </div>
      <div className="video-cap">
        <span>{title}</span>
        <span className="tnum">{channel}{duration ? `, ${duration}` : ''}</span>
      </div>
    </div>
  )
}
