import type { EventCategory } from "@/types";

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

export function isCanonicalEventCategory(category?: string): category is EventCategory {
  return category === "Technical" || category === "Non-Technical";
}

export function shouldSubmitEventCategory(category: string | undefined, touched: boolean) {
  return touched || isCanonicalEventCategory(category);
}
