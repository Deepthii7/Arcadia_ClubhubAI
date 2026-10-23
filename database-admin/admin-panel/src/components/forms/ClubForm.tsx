import { FormEvent, useState } from "react";
import type {
  Category,
  Club,
  ClubInput,
  ClubTeamMember,
  RecruitmentStatus,
} from "@/types";
import { classifyClubCategory } from "@/lib/clubCategory";
import { getChangedClubFields } from "@/lib/clubFormChanges";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

const categories: Category[] = [
  "Technical",
  "Non-Technical",
];
const NEEDS_REVIEW = "__needs-category-review__";

interface ClubFormProps {
  initial?: Club;
  onSubmit: (data: ClubInput, changedFields: Partial<ClubInput>) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export default function ClubForm({ initial, onSubmit, onCancel, submitting }: ClubFormProps) {
  const [form, setForm] = useState<ClubInput>(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "Technical",
    logoUrl: initial?.logoUrl,
    contactEmail: initial?.contactEmail,
    isActive: initial?.isActive,
    tagline: initial?.tagline,
    facultyCoordinator: initial?.facultyCoordinator,
    teamMembers: initial?.teamMembers,
    domains: initial?.domains,
    memberCount: initial?.memberCount,
    meetingFrequency: initial?.meetingFrequency,
    linkedinUrl: initial?.linkedinUrl,
    recruitmentStatus: initial?.recruitmentStatus,
    recruitmentFormUrl: initial?.recruitmentFormUrl,
  }));
  const [domainDraft, setDomainDraft] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const categorySelection = categoryTouched
    ? form.category
    : initial
      ? classifyClubCategory(initial.category, initial)
      : form.category;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form, getChangedClubFields(form, initial, categoryTouched));
  }

  function updateTeamMember(index: number, updates: Partial<ClubTeamMember>) {
    setForm((current) => ({
      ...current,
      teamMembers: (current.teamMembers ?? []).map((member, memberIndex) =>
        memberIndex === index ? { ...member, ...updates } : member
      ),
    }));
  }

  function addDomain() {
    const domain = domainDraft.trim();
    if (!domain) return;
    setForm((current) => ({
      ...current,
      domains: [...(current.domains ?? []), domain],
    }));
    setDomainDraft("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Club name"
        name="name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="e.g. Codeverse"
      />
      <Select
        label="Category"
        name="category"
        value={categorySelection ?? NEEDS_REVIEW}
        onChange={(e) => {
          setCategoryTouched(true);
          setForm({ ...form, category: e.target.value as Category });
        }}
      >
        {categorySelection === null && (
          <option value={NEEDS_REVIEW} disabled>
            Needs category review ({initial?.category})
          </option>
        )}
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input
        label="Contact email"
        name="contactEmail"
        type="email"
        value={form.contactEmail ?? ""}
        onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        placeholder="club@college.edu"
      />
      <Input
        label="Logo URL (optional)"
        name="logoUrl"
        value={form.logoUrl ?? ""}
        onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
        placeholder="https://..."
      />
      <Input
        label="Short tagline (optional)"
        name="tagline"
        value={form.tagline ?? ""}
        onChange={(e) => setForm({ ...form, tagline: e.target.value })}
        placeholder="A short description of the club"
      />
      <Textarea
        label="Overview"
        name="description"
        required
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="What does this club do?"
      />
      <Input
        label="Faculty coordinator (optional)"
        name="facultyCoordinator"
        value={form.facultyCoordinator ?? ""}
        onChange={(e) => setForm({ ...form, facultyCoordinator: e.target.value })}
        placeholder="Coordinator name"
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Student team members</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setForm((current) => ({
                ...current,
                teamMembers: [...(current.teamMembers ?? []), { name: "", role: "" }],
              }))
            }
          >
            Add member
          </Button>
        </div>
        {(form.teamMembers ?? []).map((member, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Input
              label={index === 0 ? "Name" : undefined}
              name={`teamMemberName-${index}`}
              required
              value={member.name}
              onChange={(e) => updateTeamMember(index, { name: e.target.value })}
              placeholder="Student name"
            />
            <Input
              label={index === 0 ? "Role" : undefined}
              name={`teamMemberRole-${index}`}
              required
              value={member.role}
              onChange={(e) => updateTeamMember(index, { role: e.target.value })}
              placeholder="e.g. President"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove team member ${index + 1}`}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  teamMembers: (current.teamMembers ?? []).filter(
                    (_, memberIndex) => memberIndex !== index
                  ),
                }))
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Domains</h3>
        <div className="flex gap-2">
          <Input
            label="Add a domain"
            name="domainDraft"
            value={domainDraft}
            onChange={(e) => setDomainDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain();
              }
            }}
            placeholder="e.g. Robotics"
          />
          <Button type="button" variant="secondary" onClick={addDomain}>
            Add
          </Button>
        </div>
        {(form.domains ?? []).length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {(form.domains ?? []).map((domain, index) => (
              <li
                key={`${domain}-${index}`}
                className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
              >
                {domain}
                <button
                  type="button"
                  aria-label={`Remove ${domain} domain`}
                  className="font-semibold text-slate-500 hover:text-red-600"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      domains: (current.domains ?? []).filter(
                        (_, domainIndex) => domainIndex !== index
                      ),
                    }))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Member count (optional)"
          name="memberCount"
          type="number"
          min="0"
          value={form.memberCount ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              memberCount: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
        <Input
          label="Meeting frequency (optional)"
          name="meetingFrequency"
          value={form.meetingFrequency ?? ""}
          onChange={(e) => setForm({ ...form, meetingFrequency: e.target.value })}
          placeholder="e.g. Weekly"
        />
      </div>
      <Input
        label="LinkedIn page URL (optional)"
        name="linkedinUrl"
        type="url"
        value={form.linkedinUrl ?? ""}
        onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
        placeholder="https://www.linkedin.com/..."
      />
      <Select
        label="Recruitment status"
        name="recruitmentStatus"
        value={form.recruitmentStatus ?? ""}
        onChange={(e) =>
          setForm({
            ...form,
            recruitmentStatus: e.target.value
              ? (e.target.value as RecruitmentStatus)
              : null,
          })
        }
      >
        <option value="">Not specified</option>
        <option value="Open">Open</option>
        <option value="Closed">Closed</option>
      </Select>
      <Input
        label="Google Forms recruitment URL (optional)"
        name="recruitmentFormUrl"
        type="url"
        value={form.recruitmentFormUrl ?? ""}
        onChange={(e) => setForm({ ...form, recruitmentFormUrl: e.target.value })}
        placeholder="https://forms.google.com/..."
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.isActive ?? true}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        Active
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initial ? "Save changes" : "Create club"}
        </Button>
      </div>
    </form>
  );
}
