import api from '../api'
import { useEffect, useState } from 'react'
import PinnedCard from '../components/PinnedCard'
import type { EventData } from '../data'
import {
  getEventCategoryLabel,
  matchesEventCategory,
  matchesEventSearch,
  type EventCategoryFilter,
} from '../eventCategory'
function formatEventDate(date: string) {
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return 'Date to be announced'
  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatEventTime(startTime?: string, endTime?: string) {
  if (!startTime) return 'Time TBA'
  return endTime ? `${startTime} — ${endTime}` : startTime
}

const CATEGORIES = [
  { value: 'ALL', label: 'All Events' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Non-Technical', label: 'Non-Technical' },
] as const

interface EventsPageProps {
  onSelectEvent: (event: EventData) => void
}

interface ApiEventRecord {
  _id: string
  title: string
  category?: string
  clubId?: string | { name?: string }
  description?: string
  date: string
  startTime?: string
  endTime?: string
  venue?: string
  registrationFormUrl?: string
  eligibility?: string
  participationType?: 'individual' | 'team'
  teamSize?: number
  capacity?: number
  prizes?: string
  coordinators?: EventData['coordinators']
  registrationDeadline?: string
}

interface RecommendationResponse {
  source: 'matched' | 'fallback'
  reasonSource: 'ai' | 'rules'
  message: string
  recommendations: {
    eventId: string
    reason: string
    reasonSource: 'ai' | 'rules'
    event: ApiEventRecord
  }[]
}

type StudentPreferences = {
  domain: string
  goal: string
  experience: string
  eventType: string
  availability: string
}

const PREFERENCE_QUESTIONS: {
  key: keyof StudentPreferences
  label: string
  options: string[]
}[] = [
  {
    key: 'domain',
    label: 'Domain',
    options: ['Technology', 'Arts & Culture', 'Sports & Social Activities'],
  },
  {
    key: 'goal',
    label: 'Goal',
    options: ['Learn New Skills', 'Win Competitions', 'Network & Have Fun'],
  },
  {
    key: 'experience',
    label: 'Experience',
    options: ['Beginner', 'Intermediate', 'Advanced'],
  },
  {
    key: 'eventType',
    label: 'Event type',
    options: [
      'Workshops',
      'Competitions & Hackathons',
      'Cultural & Club Events',
    ],
  },
  {
    key: 'availability',
    label: 'Availability',
    options: ['Weekdays', 'Weekends', 'Both'],
  },
]

function mapApiEvent(event: ApiEventRecord): EventData {
  return {
    id: event._id,
    title: event.title,
    category: event.category,
    org:
      typeof event.clubId === 'object'
        ? event.clubId?.name || 'Club information unavailable'
        : 'Club information unavailable',
    description: event.description || '',
    date: event.date,
    time: formatEventTime(event.startTime, event.endTime),
    venue: event.venue || '',
    registrationFormUrl: event.registrationFormUrl || '',
    startTime: event.startTime || undefined,
    endTime: event.endTime || undefined,
    eligibility: event.eligibility || undefined,
    participationType: event.participationType || undefined,
    teamSize: event.teamSize,
    capacity: event.capacity,
    prizes: event.prizes || undefined,
    coordinators: event.coordinators || [],
    registrationDeadline: event.registrationDeadline || undefined,
    tags: [],
    color: '#E04F3D',
    rotation: 0,
  }
}

export default function EventsPage({ onSelectEvent }: EventsPageProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<EventCategoryFilter>('ALL')
  const [events, setEvents] = useState<EventData[]>([])
  const [recommendations, setRecommendations] = useState<
    { event: EventData; reason: string; reasonSource: 'ai' | 'rules' }[]
  >([])
  const [recommendationMessage, setRecommendationMessage] = useState('')
  const [recommendationError, setRecommendationError] = useState('')
  const [recommendationSource, setRecommendationSource] =
    useState<'matched' | 'fallback' | null>(null)
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [preferences, setPreferences] = useState<
    Partial<StudentPreferences>
  >({})

  useEffect(() => {
  api.get('/events')
    .then(response => {
      console.log('BACKEND EVENTS:', JSON.stringify(response.data, null, 2))
      setEvents(response.data.map(mapApiEvent))
    })
    .catch(error => {
      console.error('Failed to fetch events:', error)
    })
  }, [])

  const loadRecommendations = async () => {
    if (
      !PREFERENCE_QUESTIONS.every((question) => preferences[question.key])
    ) {
      return
    }
    setRecommendationsLoading(true)
    setRecommendationMessage('')
    setRecommendationError('')
    setRecommendationSource(null)
    setRecommendations([])

    try {
      const response = await api.post<RecommendationResponse>(
        '/events/recommendations',
        preferences,
      )
      setRecommendations(
        response.data.recommendations.map(recommendation => ({
          event: mapApiEvent(recommendation.event),
          reason: recommendation.reason,
          reasonSource: recommendation.reasonSource,
        })),
      )
      setRecommendationMessage(response.data.message)
      setRecommendationSource(response.data.source)
    } catch (error) {
      console.error('Failed to fetch event recommendations:', error)
      setRecommendationError(
        'Recommendations could not be loaded. Check your connection and try again.',
      )
      setRecommendationSource(null)
    } finally {
      setRecommendationsLoading(false)
    }
  }
  const hasAllPreferences = PREFERENCE_QUESTIONS.every(
    (question) => preferences[question.key],
  )

  const filtered = events.filter(ev => {
    return (
      matchesEventCategory(ev.category, activeCategory) &&
      matchesEventSearch(ev, search)
    )
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#E04F3D', letterSpacing: '0.1em', marginBottom: 8 }}>
          UPCOMING EVENTS
        </p>
        <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: 52, margin: '0 0 12px' }}>Events Directory</h1>
        <p style={{ color: '#555', fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>
          Hackathons, workshops, makeathons, and CTFs — all in one place. Click any flyer to register.
        </p>
      </div>

      <section
        aria-labelledby="event-recommendations-heading"
        aria-busy={recommendationsLoading}
        style={{
          marginBottom: 40,
          padding: 20,
          border: '3px solid #111',
          backgroundColor: '#F4EBD8',
          boxShadow: '5px 5px 0 #111',
        }}
      >
        <h2
          id="event-recommendations-heading"
          style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, margin: '0 0 8px' }}
        >
          Find Events for You
        </h2>
        <p style={{ color: '#555', fontSize: 13, margin: '0 0 20px' }}>
          Choose one answer for each question. Update your choices any time to
          find a new set of events.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {PREFERENCE_QUESTIONS.map((question, questionIndex) => (
            <fieldset
              key={question.key}
              style={{
                minWidth: 0,
                margin: 0,
                padding: 12,
                border: '2px solid #111',
                background: '#fff',
              }}
            >
              <legend
                style={{
                  padding: '0 5px',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {questionIndex + 1}. {question.label}
              </legend>
              <div style={{ display: 'grid', gap: 8 }}>
                {question.options.map(option => (
                  <label
                    key={option}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: 13,
                      lineHeight: 1.4,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`recommendation-${question.key}`}
                      value={option}
                      checked={preferences[question.key] === option}
                      disabled={recommendationsLoading}
                      onChange={() =>
                        {
                          setPreferences(current => ({
                            ...current,
                            [question.key]: option,
                          }))
                          setRecommendations([])
                          setRecommendationMessage('')
                          setRecommendationError('')
                          setRecommendationSource(null)
                        }
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <button
          type="button"
          onClick={loadRecommendations}
          disabled={!hasAllPreferences || recommendationsLoading}
          className="filter-pill"
          style={{ marginTop: 18 }}
        >
          {recommendationsLoading ? 'Finding your events…' : 'Find My Events'}
        </button>
        {recommendationsLoading && (
          <p role="status" style={{ fontSize: 13, margin: '14px 0 0' }}>
            Finding upcoming events for you…
          </p>
        )}
        {recommendationError && (
          <div role="alert" style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>
              {recommendationError}
            </p>
            <button
              type="button"
              onClick={loadRecommendations}
              disabled={recommendationsLoading}
              className="filter-pill"
            >
              Retry
            </button>
          </div>
        )}
        {recommendationSource === 'matched' && (
          <p role="status" style={{ fontSize: 12, margin: '14px 0 0' }}>
            Ranked for your preferences
          </p>
        )}
        {recommendationSource === 'fallback' && (
          <p role="status" style={{ fontSize: 12, margin: '14px 0 0' }}>
            Showing other upcoming events
          </p>
        )}
        {recommendationSource &&
          recommendationMessage &&
          recommendations.length > 0 && (
          <p style={{ color: '#555', fontSize: 13, margin: '6px 0 0' }}>
            {recommendationMessage}
          </p>
        )}
        {recommendations.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 28,
              marginTop: 24,
            }}
          >
            {recommendations.map(({ event, reason, reasonSource }) => (
              <div key={event.id}>
                <PinnedCard
                  color={event.color}
                  rotation={event.rotation}
                  onClick={() => onSelectEvent(event)}
                  headerContent={
                    <div>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                        {recommendationSource === 'matched'
                          ? 'RECOMMENDED FOR YOU'
                          : 'UPCOMING EVENT'}
                      </p>
                      <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, color: '#111' }}>
                        {event.org}
                      </span>
                    </div>
                  }
                  bodyContent={
                    <div>
                      <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: 22, margin: '0 0 10px', lineHeight: 1.15 }}>
                        {event.title}
                      </h3>
                      <p style={{ fontSize: 13, color: '#444', lineHeight: 1.7, margin: '0 0 12px' }}>
                        {event.description}
                      </p>
                      <p style={{ fontSize: 12, color: '#333', lineHeight: 1.6, margin: 0 }}>
                        {reason}
                      </p>
                      {reasonSource === 'ai' && (
                        <p style={{ fontSize: 10, color: '#666', margin: '8px 0 0' }}>
                          AI-assisted reason
                        </p>
                      )}
                    </div>
                  }
                  footerContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#666' }}>
                        📅 {formatEventDate(event.date)}
                      </span>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#666' }}>
                        🕐 {event.time.split('—')[0].trim()}
                      </span>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#666' }}>
                        📍 {event.venue}
                      </span>
                    </div>
                  }
                />
              </div>
            ))}
          </div>
        )}
        {!recommendationsLoading &&
          !recommendationError &&
          recommendationSource &&
          recommendations.length === 0 && (
            <p role="status" style={{ fontSize: 13, margin: '14px 0 0' }}>
              {recommendationMessage || 'No upcoming events are currently available.'}
            </p>
        )}
      </section>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 540 }}>
        <svg
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search events, tags, tech stacks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="brute-input"
          style={{
            width: '100%',
            padding: '12px 16px 12px 42px',
            border: '3px solid #111',
            backgroundColor: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            boxShadow: '5px 5px 0px 0px #111',
            outline: 'none',
          }}
        />
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`filter-pill ${activeCategory === cat.value ? 'active' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#888', letterSpacing: '0.08em', marginBottom: 28 }}>
        {filtered.length} {filtered.length === 1 ? 'EVENT' : 'EVENTS'} FOUND
      </p>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 36 }}>
        {filtered.map(ev => (
          <PinnedCard
            key={ev.id}
            color={ev.color}
            rotation={ev.rotation}
            onClick={() => onSelectEvent(ev)}
            headerContent={
              <>
                <div>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: ev.color === '#111111' ? '#999' : 'rgba(0,0,0,0.5)', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                    HOSTED BY
                  </p>
                  <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, color: ev.color === '#111111' ? '#fff' : '#111', letterSpacing: '0.01em' }}>
                    {ev.org}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span
                    style={{
                      backgroundColor: '#fff',
                      border: '1.5px solid #111',
                      padding: '3px 8px',
                      fontSize: 8,
                      fontFamily: 'Space Mono, monospace',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: '#111',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    RSVP OPEN
                  </span>
                  <span
                    style={{
                      backgroundColor: 'transparent',
                      border: '1.5px solid rgba(255,255,255,0.5)',
                      padding: '2px 7px',
                      fontSize: 8,
                      fontFamily: 'Space Mono, monospace',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: ev.color === '#111111' ? '#fff' : '#111',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getEventCategoryLabel(ev.category)}
                  </span>
                </div>
              </>
            }
            bodyContent={
              <div>
                <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: 22, margin: '0 0 10px', lineHeight: 1.15 }}>{ev.title}</h3>
                <p style={{ fontSize: 13, color: '#444', lineHeight: 1.7, margin: '0 0 12px' }}>{ev.description}</p>
                {/* Tech stack tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ev.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        backgroundColor: '#F4EBD8',
                        border: '1.5px solid #bbb',
                        padding: '2px 8px',
                        fontSize: 10,
                        fontFamily: 'Space Mono, monospace',
                        color: '#555',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            }
            footerContent={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#666' }}>📅 {formatEventDate(ev.date)}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#666' }}>🕐 {ev.time.split('—')[0].trim()}</span>
                </div>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#666' }}>📍 {ev.venue}</span>
              </div>
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
          <p style={{ fontFamily: 'Anton, sans-serif', fontSize: 32, marginBottom: 12 }}>Nothing pinned here.</p>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12 }}>Try a different search or category.</p>
        </div>
      )}
    </div>
  )
}
