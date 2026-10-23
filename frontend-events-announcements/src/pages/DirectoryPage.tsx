import { useEffect, useState } from 'react'
import PinnedCard from '../components/PinnedCard'
import api from '../api'
import type { Page } from '../data'
import { classifyClubCategory, getClubCategoryLabel } from '../clubCategory'

const CATEGORY_FILTERS = [
  { value: 'ALL', label: 'All Clubs' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Non-Technical', label: 'Non-Technical' },
] as const

interface ClubTeamMember {
  name: string
  role: string
}

interface DirectoryClub {
  _id?: string
  id?: string | number
  name: string
  category: string
  description: string
  tagline?: string
  facultyCoordinator?: string
  teamMembers?: ClubTeamMember[]
  domains?: string[]
  memberCount?: number | null
  members?: number | string
  meetingFrequency?: string
  meetDay?: string
  linkedinUrl?: string
  recruitmentStatus?: 'Open' | 'Closed' | null
  recruitmentFormUrl?: string
  status?: string
  color?: string
  rotation?: number
  isActive?: boolean
}

function isSafeExternalUrl(value?: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function isRecruitmentOpen(club: DirectoryClub) {
  return club.recruitmentStatus === 'Open' ||
    (!club.recruitmentStatus && club.status === 'RECRUITING')
}

interface DirectoryPageProps {
  onNavigate?: (page: Page) => void
}

export default function DirectoryPage({ onNavigate: _onNavigate }: DirectoryPageProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [clubs, setClubs] = useState<DirectoryClub[]>([])
  const [selectedClub, setSelectedClub] = useState<DirectoryClub | null>(null)
  useEffect(() => {
    api.get('/clubs')
      .then(response => {
        setClubs(response.data as DirectoryClub[])
      })
      .catch(error => {
        console.error('Failed to fetch clubs:', error)
      })
  }, [])
  const filtered = clubs.filter(club => {
    const normalizedSearch = search.trim().toLowerCase()
    const searchableValues = [
      club.name,
      club.category,
      club.description,
      club.tagline ?? '',
      ...(club.domains ?? []),
    ]
    const normalizedCategory = classifyClubCategory(club.category, club)
    const matchCat = activeCategory === 'ALL' || normalizedCategory === activeCategory
    const matchSearch = searchableValues.some(value =>
      value.toLowerCase().includes(normalizedSearch)
    )
    return matchCat && matchSearch
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#E04F3D', letterSpacing: '0.1em', marginBottom: 8 }}>
          THE FULL BOARD
        </p>
        <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: 52, margin: '0 0 12px' }}>Club Directory</h1>
        <p style={{ color: '#555', fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>
          Search by name or interest, filter by category, and click any flyer to see meeting times, officers, and how to join.
        </p>
      </div>

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
          placeholder="Search clubs, tags, vibes..."
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
        {CATEGORY_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            className={`filter-pill ${activeCategory === value ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#888', letterSpacing: '0.08em', marginBottom: 28 }}>
        {filtered.length} {filtered.length === 1 ? 'CLUB' : 'CLUBS'} FOUND
      </p>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 36 }}>
        {filtered.map(club => (
          <PinnedCard
            key={club._id ?? club.id}
            color={club.color ?? '#E04F3D'}
            rotation={club.rotation ?? 0}
            onClick={() => setSelectedClub(club)}
            headerContent={
              <>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: club.color === '#111111' ? '#fff' : '#111' }}>
                  {getClubCategoryLabel(club.category, club)}
                </span>
                {isRecruitmentOpen(club) && (
                  <span style={{ backgroundColor: '#fff', border: '1.5px solid #111', padding: '2px 8px', fontSize: 9, fontFamily: 'Space Mono, monospace', fontWeight: 700, letterSpacing: '0.06em', color: '#111' }}>
                    RECRUITING
                  </span>
                )}
              </>
            }
            bodyContent={
              <div>
                <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: 26, margin: '0 0 8px', lineHeight: 1.1 }}>{club.name}</h3>
                <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 }}>{club.description}</p>
              </div>
            }
            footerContent={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {(club.memberCount ?? club.members) != null && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#666' }}>👥 {club.memberCount ?? club.members}</span>
                )}
                {(club.meetingFrequency || club.meetDay) && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#666' }}>📍 {club.meetingFrequency ?? club.meetDay}</span>
                )}
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
      {selectedClub && (
        <div
          onClick={() => setSelectedClub(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              backgroundColor: '#fff',
              border: '3px solid #111',
              boxShadow: '10px 10px 0 #111',
            }}
          >
            <div
              style={{
                backgroundColor: selectedClub.color ?? '#E04F3D',
                padding: '20px 24px',
                borderBottom: '3px solid #111',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 20,
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    margin: '0 0 8px',
                    color: selectedClub.color === '#111111' ? '#fff' : '#111',
                  }}
                >
                  {getClubCategoryLabel(selectedClub.category, selectedClub)}
                </p>

                <h2
                  style={{
                    fontFamily: 'Anton, sans-serif',
                    fontSize: 34,
                    lineHeight: 1.05,
                    margin: 0,
                    color: selectedClub.color === '#111111' ? '#fff' : '#111',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {selectedClub.name}
                </h2>
              </div>

              <button
                onClick={() => setSelectedClub(null)}
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: '#fff',
                  border: '2px solid #111',
                  fontFamily: 'Space Mono, monospace',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {selectedClub.tagline && (
                <p style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.5, margin: '0 0 12px' }}>
                  {selectedClub.tagline}
                </p>
              )}
              <section>
                <h3 style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.08em', margin: '0 0 8px' }}>
                  ABOUT THE CLUB
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#444', margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
                  {selectedClub.description || 'Overview not provided.'}
                </p>
              </section>

              {((selectedClub.memberCount ?? selectedClub.members) != null ||
                selectedClub.meetingFrequency || selectedClub.meetDay) && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {(selectedClub.memberCount ?? selectedClub.members) != null && (
                    <div style={{ border: '2px solid #111', padding: 14 }}>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#888', margin: '0 0 6px', letterSpacing: '0.08em' }}>
                        MEMBERS
                      </p>
                      <strong style={{ fontFamily: 'Anton, sans-serif', fontSize: 24 }}>
                        {selectedClub.memberCount ?? selectedClub.members}
                      </strong>
                    </div>
                  )}
                  {(selectedClub.meetingFrequency || selectedClub.meetDay) && (
                    <div style={{ border: '2px solid #111', padding: 14 }}>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#888', margin: '0 0 6px', letterSpacing: '0.08em' }}>
                        MEETS
                      </p>
                      <strong style={{ fontFamily: 'Space Mono, monospace', fontSize: 13 }}>
                        {selectedClub.meetingFrequency ?? selectedClub.meetDay}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {(selectedClub.facultyCoordinator || (selectedClub.teamMembers?.length ?? 0) > 0) && (
                <section style={{ borderTop: '2px dashed #bbb', paddingTop: 18, marginBottom: 20 }}>
                  <h3 style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.08em', margin: '0 0 10px' }}>
                    CLUB TEAM
                  </h3>
                  {selectedClub.facultyCoordinator && (
                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 8px' }}>
                      <strong>Faculty coordinator:</strong> {selectedClub.facultyCoordinator}
                    </p>
                  )}
                  {(selectedClub.teamMembers ?? []).map((member, index) => (
                    <p key={`${member.name}-${member.role}-${index}`} style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 6px' }}>
                      <strong>{member.name}</strong>{member.role ? ` — ${member.role}` : ''}
                    </p>
                  ))}
                </section>
              )}

              {(selectedClub.domains?.length ?? 0) > 0 && (
                <section style={{ marginBottom: 20 }}>
                  <h3 style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.08em', margin: '0 0 10px' }}>
                    DOMAINS
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(selectedClub.domains ?? []).map((domain, index) => (
                      <span key={`${domain}-${index}`} style={{ border: '1.5px solid #111', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
                        {domain}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {isSafeExternalUrl(selectedClub.linkedinUrl) && (
                <p style={{ fontSize: 13, margin: '0 0 20px' }}>
                  <a href={selectedClub.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    LinkedIn page ↗
                  </a>
                </p>
              )}

              <div style={{ borderTop: '2px dashed #bbb', paddingTop: 18 }}>
                <p
                  style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    margin: '0 0 10px',
                  }}
                >
                  HOW TO JOIN
                </p>
                {selectedClub.recruitmentStatus === 'Closed' ? (
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: 0 }}>
                    This club is currently closed for recruitment. Check back later for new openings.
                  </p>
                ) : (
                  <>
                    {isRecruitmentOpen(selectedClub) && (
                      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 12px' }}>
                        Recruitment is currently open.
                      </p>
                    )}
                    {isRecruitmentOpen(selectedClub) && isSafeExternalUrl(selectedClub.recruitmentFormUrl) && (
                      <a
                        href={selectedClub.recruitmentFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '12px 18px',
                          backgroundColor: '#E04F3D',
                          color: '#fff',
                          border: '2px solid #111',
                          boxShadow: '4px 4px 0 #111',
                          fontFamily: 'Space Mono, monospace',
                          fontWeight: 700,
                          fontSize: 12,
                          textDecoration: 'none',
                        }}
                      >
                        Apply to Join ↗
                      </a>
                    )}
                    {isRecruitmentOpen(selectedClub) && !isSafeExternalUrl(selectedClub.recruitmentFormUrl) && (
                      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: 0 }}>
                        The application form is not available yet.
                      </p>
                    )}
                    {!isRecruitmentOpen(selectedClub) && (
                      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: 0 }}>
                        Recruitment status has not been provided.
                      </p>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => setSelectedClub(null)}
                style={{
                  width: '100%',
                  marginTop: 24,
                  padding: '14px 20px',
                  backgroundColor: '#111',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '5px 5px 0 #E04F3D',
                  fontFamily: 'Space Mono, monospace',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
