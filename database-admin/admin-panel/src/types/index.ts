export type Category = "Technical" | "Non-Technical";

export interface ClubTeamMember {
  name: string;
  role: string;
}

export type RecruitmentStatus = "Open" | "Closed";

export interface Club {
  _id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  contactEmail?: string;
  isActive?: boolean;
  tagline?: string;
  facultyCoordinator?: string;
  teamMembers?: ClubTeamMember[];
  domains?: string[];
  memberCount?: number | null;
  meetingFrequency?: string;
  linkedinUrl?: string;
  recruitmentStatus?: RecruitmentStatus | null;
  recruitmentFormUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ClubInput = Omit<Club, "_id" | "createdAt" | "updatedAt">;

export interface EventCoordinator {
  name: string;
  phone: string;
  email: string;
}

export type EventCategory = "Technical" | "Non-Technical";

export interface ClubEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  category?: string;
  clubId: Club | string;
  bannerUrl?: string;
  capacity?: number;
  registrationFormUrl?: string;
  startTime?: string;
  endTime?: string;
  eligibility?: string;
  participationType?: "individual" | "team";
  teamSize?: number;
  prizes?: string;
  coordinators?: EventCoordinator[];
  registrationDeadline?: string;
  createdAt: string;
  updatedAt: string;
}

export type ClubEventInput = Omit<
  ClubEvent,
  "_id" | "createdAt" | "updatedAt" | "clubId"
> & { clubId: string };

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  clubId?: Club | string;
  pinned?: boolean;
  date?: string;
  time?: string;
  venue?: string;
  createdAt: string;
  updatedAt: string;
}

export type AnnouncementInput = Omit<
  Announcement,
  "_id" | "createdAt" | "updatedAt" | "clubId"
> & { clubId?: string };

export interface Registration {
  _id: string;
  eventId: ClubEvent | string;
  name: string;
  email: string;
  phone?: string;
  rollNo?: string;
  createdAt: string;
}

export interface DashboardSummary {
  counts: {
    clubs: number;
    events: number;
    announcements: number;
    registrations: number;
  };
  upcomingEvents: ClubEvent[];
  recentRegistrations: Registration[];
}
