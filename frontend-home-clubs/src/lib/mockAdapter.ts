import MockAdapter from "axios-mock-adapter";
import { apiClient } from "./axiosClient";
import { classifyClubCategory } from "./clubCategory";
import { mockClubs } from "@/data/mockClubs";

// Simulated network latency so loading states are visible in the demo.
const mock = new MockAdapter(apiClient, { delayResponse: 500 });

// GET /clubs?search=&category=
mock.onGet(/\/clubs$/).reply((config) => {
  const { search: rawSearch, category } = (config.params ?? {}) as {
    search?: string;
    category?: string;
  };

  const search = (rawSearch ?? "").toLowerCase();

  let results = mockClubs.map((club) => ({
    ...club,
    category: classifyClubCategory(club.category, club),
  }));
  if (search) {
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.tagline.toLowerCase().includes(search) ||
        c.tags.some((t) => t.toLowerCase().includes(search))
    );
  }
  if (category && category !== "All Clubs") {
    results = results.filter((c) => c.category === category);
  }
  return [200, results];
});

// GET /clubs/:slug
mock.onGet(/\/clubs\/[\w-]+$/).reply((config) => {
  const slug = config.url?.split("/").pop();
  const club = mockClubs.find((c) => c.slug === slug);
  if (!club) return [404, { message: "Club not found" }];
  return [
    200,
    {
      ...club,
      category: classifyClubCategory(club.category, club),
    },
  ];
});

// GET /categories
mock.onGet(/\/categories$/).reply(() => {
  const categories = Array.from(
    new Set(
      mockClubs
        .map((club) => classifyClubCategory(club.category, club))
        .filter((category) => category !== null)
    )
  );
  return [200, categories];
});

export default mock;
