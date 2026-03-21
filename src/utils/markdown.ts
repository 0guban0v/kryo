export function heading(title: string, level = 2): string {
  return `${"#".repeat(level)} ${title}`;
}

export function bullet(items: Array<string | null | undefined>): string {
  return items
    .filter((item): item is string => Boolean(item))
    .map((item) => `- ${item}`)
    .join("\n");
}

export function codeFence(content: string, language = ""): string {
  return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
}

export function joinSections(
  sections: Array<string | null | undefined>,
): string {
  return sections
    .filter((section): section is string => Boolean(section?.trim()))
    .join("\n\n")
    .trim();
}

export function truncate(value: string, maxLength = 400): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
