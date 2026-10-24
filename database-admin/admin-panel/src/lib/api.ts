import axiosClient from "./axiosClient";
import type {
  Announcement,
  AnnouncementInput,
  Club,
  ClubEvent,
  ClubEventInput,
  ClubInput,
  DashboardSummary,
  Registration,
} from "@/types";

export interface EventAdvisorConflict {
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  directOverlap: boolean;
  bufferMinutes: number;
}

export interface EventAdvisorAlternative {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  source?: "ai" | "rule-based";
}

export interface EventAdvisorResponse {
  status: "available" | "conflict_found" | "no_slot_found" | "error";
  conflicts: EventAdvisorConflict[];
  alternatives: EventAdvisorAlternative[];
  explanations: string[];
  error: { code: string; message: string } | null;
}

// ---- Clubs ----
export const clubsApi = {
  list: () => axiosClient.get<Club[]>("/clubs").then((r) => r.data),
  get: (id: string) => axiosClient.get<Club>(`/clubs/${id}`).then((r) => r.data),
  create: (data: ClubInput) => axiosClient.post<Club>("/clubs", data).then((r) => r.data),
  update: (id: string, data: Partial<ClubInput>) =>
    axiosClient.put<Club>(`/clubs/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosClient.delete(`/clubs/${id}`).then((r) => r.data),
};

// ---- Events ----
export const eventsApi = {
  list: () => axiosClient.get<ClubEvent[]>("/events").then((r) => r.data),
  get: (id: string) => axiosClient.get<ClubEvent>(`/events/${id}`).then((r) => r.data),
  create: (data: ClubEventInput) =>
    axiosClient.post<ClubEvent>("/events", data).then((r) => r.data),
  update: (id: string, data: Partial<ClubEventInput>) =>
    axiosClient.put<ClubEvent>(`/events/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosClient.delete(`/events/${id}`).then((r) => r.data),
  registrations: (eventId: string) =>
    axiosClient.get<Registration[]>(`/events/${eventId}/registrations`).then((r) => r.data),
  advise: (params: {
    date: string;
    startTime: string;
    endTime: string;
    venue: string;
    clubId: string;
  }) =>
    axiosClient
      .get<EventAdvisorResponse>("/events/advisor", { params })
      .then((r) => r.data),
};

// ---- Announcements ----
export const announcementsApi = {
  list: () => axiosClient.get<Announcement[]>("/announcements").then((r) => r.data),
  create: (data: AnnouncementInput) =>
    axiosClient.post<Announcement>("/announcements", data).then((r) => r.data),
  update: (id: string, data: Partial<AnnouncementInput>) =>
    axiosClient.put<Announcement>(`/announcements/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosClient.delete(`/announcements/${id}`).then((r) => r.data),
};

// ---- Registrations (all events) ----
export const registrationsApi = {
  list: () => axiosClient.get<Registration[]>("/registrations").then((r) => r.data),
  remove: (id: string) => axiosClient.delete(`/registrations/${id}`).then((r) => r.data),
};

// ---- Dashboard ----
export const dashboardApi = {
  summary: () => axiosClient.get<DashboardSummary>("/dashboard").then((r) => r.data),
};
