
import type { EventData } from '../data'
import { getEventCategoryLabel } from '../eventCategory'

function formatDate(date: string) {
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return 'Date to be announced'
  return parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDeadline(deadline?: string) {
  if (!deadline) return 'Not specified'
  const parsedDate = new Date(deadline)
  if (Number.isNaN(parsedDate.getTime())) return 'Not specified'
  return parsedDate.toLocaleString()
}

function getStartTime(event: EventData) {
  if (event.startTime) return event.startTime
  const parsedDate = new Date(event.date)
  if (Number.isNaN(parsedDate.getTime())) return ''
  if (parsedDate.getHours() === 0 && parsedDate.getMinutes() === 0) return ''
  return parsedDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface EventDetailsPageProps {
  event: EventData
  onBack: () => void
}

export default function EventDetailsPage({
  event,
  onBack,
}: EventDetailsPageProps) {
  const startTime = getStartTime(event)
  const coordinators = (event.coordinators ?? []).filter(
    (coordinator) => coordinator.name || coordinator.phone || coordinator.email
  )

  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '56px 24px',
        minHeight: '65vh',
      }}
    >
      <button
        onClick={onBack}
        style={{
          border: '2px solid #111',
          padding: '10px 16px',
          background: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 32,
        }}
      >
        ← Back to Events
      </button>

      <article
        style={{
          background: '#fff',
          border: '3px solid #111',
          boxShadow: '8px 8px 0 #111',
          padding: '32px',
        }}
      >
        <p
          style={{
            fontFamily: 'monospace',
            color: '#E04F3D',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {getEventCategoryLabel(event.category)} · Hosted by {event.org || 'Club information unavailable'}
        </p>

        <h1
          style={{
            fontFamily: 'Anton, sans-serif',
            fontSize: 42,
            margin: '16px 0',
          }}
        >
          {event.title}
        </h1>

        <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {event.description || 'Description not provided.'}
        </p>

        <div style={{ marginTop: 28, lineHeight: 2 }}>
          <p><strong>Date:</strong> {formatDate(event.date)}</p>
          <p>
            <strong>Time:</strong>{' '}
            {startTime
              ? `${startTime}${event.endTime ? ` — ${event.endTime}` : ''}`
              : 'To be announced'}
          </p>
          <p><strong>Venue:</strong> {event.venue || 'Venue to be announced'}</p>
        </div>

        <section
          style={{
            borderTop: '2px solid #ddd',
            marginTop: 28,
            paddingTop: 24,
            lineHeight: 1.8,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 0 }}>
            Event information
          </h2>
          <p>
            <strong>Eligibility:</strong>{' '}
            {event.eligibility || 'Eligibility details not specified.'}
          </p>
          <p>
            <strong>Participation:</strong>{' '}
            {event.participationType
              ? event.participationType === 'team'
                ? `Team${event.teamSize ? ` (up to ${event.teamSize} members)` : ''}`
                : 'Individual'
              : 'Not specified'}
          </p>
          <p>
            <strong>Maximum participants:</strong>{' '}
            {event.capacity === undefined
              ? 'Not specified'
              : event.capacity === 0
                ? 'No participant limit'
                : event.capacity}
          </p>
          <p>
            <strong>Prizes and rewards:</strong>{' '}
            {event.prizes || 'Not specified'}
          </p>
          <p>
            <strong>Registration deadline:</strong>{' '}
            {formatDeadline(event.registrationDeadline)}
          </p>
        </section>

        <section
          style={{
            borderTop: '2px solid #ddd',
            marginTop: 28,
            paddingTop: 24,
            lineHeight: 1.8,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 0 }}>
            Coordinators
          </h2>
          {coordinators.length > 0 ? (
            coordinators.map((coordinator, index) => (
              <div key={`${coordinator.email || coordinator.phone || coordinator.name}-${index}`}>
                <p><strong>Name:</strong> {coordinator.name || 'Not provided'}</p>
                <p><strong>Phone:</strong> {coordinator.phone || 'Not provided'}</p>
                <p><strong>Email:</strong> {coordinator.email || 'Not provided'}</p>
              </div>
            ))
          ) : (
            <p>Coordinator contact details not provided.</p>
          )}
        </section>

        <div
          style={{
            borderTop: '2px solid #ddd',
            marginTop: 28,
            paddingTop: 24,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>
            Registration
          </h2>

          {event.registrationFormUrl ? (
            <a
              href={event.registrationFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: 16,
                padding: '14px 22px',
                background: '#E04F3D',
                color: '#fff',
                border: '2px solid #111',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '4px 4px 0 #111',
              }}
            >
              Register Now ↗
            </a>
          ) : (
            <p style={{ marginTop: 12, color: '#666' }}>
              Registration link not provided.
            </p>
          )}
        </div>
      </article>
    </main>
  )
}
