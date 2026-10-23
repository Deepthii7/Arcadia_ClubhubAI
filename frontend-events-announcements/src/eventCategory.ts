export type EventCategory = "Technical" | "Non-Technical";
export type EventCategoryFilter = "ALL" | EventCategory;

interface SearchableEvent {
  title: string;
  category?: string;
  org: string;
  tags: string[];
}

function normalizeCategoryValue(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

export function classifyEventCategory(category?: string): EventCategory | null {
  if (!category?.trim()) return null;

  const normalized = normalizeCategoryValue(category);

  if (
    [
      "technical",
      "technology",
      "tech",
      "ai",
      "aiml",
      "aiandml",
      "aimlworkshop",
      "aimlworkshops",
      "artificialintelligence",
      "artificialintelligenceworkshop",
      "hackathon",
      "hackathons",
      "codingcompetition",
      "codingcompetitions",
      "programming",
      "programmingevent",
      "cybersecurity",
      "cybersecurityevent",
      "technicalseminar",
      "technicalseminars",
      "technicalworkshop",
      "technicalworkshops",
      "technicalprojectshowcase",
      "technicalprojectshowcases",
    ].includes(normalized)
  ) {
    return "Technical";
  }

  if (
    [
      "nontechnical",
      "cultural",
      "culturalfestival",
      "culturalfestivals",
      "sports",
      "sportstournament",
      "sportstournaments",
      "dance",
      "music",
      "danceandmusic",
      "danceandmusicperformance",
      "danceandmusicperformances",
      "arts",
      "art",
      "artsrecreation",
      "artsandrecreation",
      "artsandrecreationactivity",
      "artsandrecreationactivities",
      "recreation",
      "recreational",
      "recreationactivity",
      "recreationactivities",
      "community",
      "communityevent",
      "socialimpact",
      "communitysocialimpact",
      "communitysocialimpactevent",
      "communitysocialimpactevents",
      "communityandsocialimpact",
      "communityandsocialimpactevent",
      "communityandsocialimpactevents",
    ].includes(normalized)
  ) {
    return "Non-Technical";
  }

  return null;
}

export function getEventCategoryLabel(category?: string) {
  return classifyEventCategory(category) ?? "Needs category review";
}

export function matchesEventCategory(category: string | undefined, filter: EventCategoryFilter) {
  return filter === "ALL" || classifyEventCategory(category) === filter;
}

export function matchesEventSearch(event: SearchableEvent, query: string) {
  const searchTerm = query.trim().toLowerCase();
  return [
    event.title,
    getEventCategoryLabel(event.category),
    event.category ?? "",
    event.org,
    ...event.tags,
  ].some((value) => value.toLowerCase().includes(searchTerm));
}
