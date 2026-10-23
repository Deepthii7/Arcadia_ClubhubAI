export type MainClubCategory = 'Technical' | 'Non-Technical'

interface ClubCategoryContext {
  name?: string
  description?: string
  domains?: string[]
}

function normalizeCategoryValue(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

export function classifyClubCategory(
  category: string,
  context: ClubCategoryContext = {}
): MainClubCategory | null {
  const normalized = normalizeCategoryValue(category)

  if (
    [
      'technical',
      'technology',
      'tech',
      'ai',
      'aiml',
      'aiandml',
      'aiaiml',
      'academic',
      'gaming',
      'business',
    ].includes(normalized)
  ) {
    return 'Technical'
  }

  if (
    [
      'nontechnical',
      'arts',
      'artsculture',
      'cultural',
      'literary',
      'sports',
      'music',
      'socialimpact',
    ].includes(normalized)
  ) {
    return 'Non-Technical'
  }

  if (normalized === 'social') {
    const evidence = [
      context.name ?? '',
      context.description ?? '',
      ...(context.domains ?? []),
    ]
      .join(' ')
      .replace(/[^a-z0-9]+/gi, ' ')
    return /\b(community|mutual aid|volunteer(?:s|ing)?|social impact|community service|social club|social events?|social activities|campus gatherings?|outreach|charit(?:y|able))\b/i.test(
      evidence
    )
      ? 'Non-Technical'
      : null
  }

  return null
}

export function getClubCategoryLabel(
  category: string,
  context: ClubCategoryContext = {}
) {
  return classifyClubCategory(category, context) ?? 'Needs category review'
}
