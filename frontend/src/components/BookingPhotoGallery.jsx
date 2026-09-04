import { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiRequest } from '../services/api'
import './BookingPhotoGallery.css'

const photoUrl = (photo) => {
  const value = String(photo?.url || '')
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/api/')) return `${API_BASE}${value.slice(4)}`
  if (value.startsWith('/')) return `${API_BASE}${value}`
  return `${API_BASE}/uploads/photos/${photo.id}`
}

const AuthenticatedPhoto = ({ photo, token, className = '' }) => {
  const [source, setSource] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    setSource('')
    setFailed(false)

    fetch(photoUrl(photo), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Photo could not be loaded (${response.status})`)
        return response.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setSource(objectUrl)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setFailed(true)
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photo, token])

  if (failed) return <span className={`bpg-photo-state ${className}`}>Image unavailable</span>
  if (!source) return <span className={`bpg-photo-state bpg-photo-state--loading ${className}`}>Loading photo…</span>
  return <img className={className} src={source} alt={`${photo.kind === 'AFTER' ? 'After' : 'Before'} service evidence: ${photo.original_name || 'photo'}`} />
}

const PhotoGroup = ({ kind, photos, token, onOpen }) => (
  <section className="bpg-group" aria-label={`${kind.toLowerCase()} service photos`}>
    <div className="bpg-group__heading">
      <span>{kind} SERVICE</span>
      <small>{photos.length} PHOTO{photos.length === 1 ? '' : 'S'}</small>
    </div>
    {photos.length ? (
      <div className="bpg-grid">
        {photos.map((photo, index) => (
          <button
            type="button"
            className="bpg-thumbnail"
            key={photo.id}
            onClick={() => onOpen(photo)}
            aria-label={`Open ${kind.toLowerCase()} photo ${index + 1}`}
          >
            <AuthenticatedPhoto photo={photo} token={token} />
            <span>{photo.original_name || `${kind.toLowerCase()} photo ${index + 1}`}</span>
          </button>
        ))}
      </div>
    ) : (
      <p className="bpg-empty">No {kind.toLowerCase()} photos stored.</p>
    )}
  </section>
)

const BookingPhotoGallery = ({ bookingId, token: tokenProp, refreshKey = 0, title = 'SERVICE PHOTO RECORD' }) => {
  const token = tokenProp || sessionStorage.getItem('token')
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openPhoto, setOpenPhoto] = useState(null)

  useEffect(() => {
    if (!bookingId || !token) {
      setPhotos([])
      setLoading(false)
      setError(!token ? 'Sign in to view service photos.' : '')
      return
    }

    let active = true
    setLoading(true)
    setError('')
    apiRequest(`/bookings/${bookingId}/photos`, 'GET', null, token)
      .then((result) => {
        if (active) setPhotos(Array.isArray(result?.photos) ? result.photos : [])
      })
      .catch((requestError) => {
        if (active) {
          setPhotos([])
          setError(requestError.message || 'Service photos could not be loaded.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [bookingId, refreshKey, token])

  const grouped = useMemo(() => ({
    BEFORE: photos.filter((photo) => photo.kind === 'BEFORE'),
    AFTER: photos.filter((photo) => photo.kind === 'AFTER'),
  }), [photos])

  return (
    <div className="bpg">
      <div className="bpg-heading">
        <div>
          <span className="bpg-heading__eyebrow">BOOKING #{bookingId}</span>
          <h4>{title}</h4>
        </div>
        {!loading && !error && <span className="bpg-heading__count">{photos.length} FILE{photos.length === 1 ? '' : 'S'}</span>}
      </div>

      {loading ? (
        <p className="bpg-message">Loading saved service photos…</p>
      ) : error ? (
        <p className="bpg-message bpg-message--error" role="alert">{error}</p>
      ) : (
        <div className="bpg-groups">
          <PhotoGroup kind="BEFORE" photos={grouped.BEFORE} token={token} onOpen={setOpenPhoto} />
          <PhotoGroup kind="AFTER" photos={grouped.AFTER} token={token} onOpen={setOpenPhoto} />
        </div>
      )}

      {openPhoto && (
        <div className="bpg-lightbox" role="dialog" aria-modal="true" aria-label={`${openPhoto.kind.toLowerCase()} service photo`} onClick={() => setOpenPhoto(null)}>
          <div className="bpg-lightbox__panel" onClick={(event) => event.stopPropagation()}>
            <div className="bpg-lightbox__header">
              <div>
                <strong>{openPhoto.kind} SERVICE PHOTO</strong>
                <small>{openPhoto.original_name || 'Service evidence'}</small>
              </div>
              <button type="button" onClick={() => setOpenPhoto(null)} aria-label="Close photo">✕</button>
            </div>
            <AuthenticatedPhoto photo={openPhoto} token={token} className="bpg-lightbox__image" />
          </div>
        </div>
      )}
    </div>
  )
}

export default BookingPhotoGallery
