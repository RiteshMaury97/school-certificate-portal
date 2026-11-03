/** Controls intentionally exempt from required validation, with their product reason. */
export const formExceptions: Readonly<Record<string, string>> = {
  "search and filter controls": "These narrow an existing result set and may be empty.",
  "single non-consent checkboxes": "These are optional preferences, not a consent gate.",
  "conditionally shown fields": "These fields are only relevant when their parent option is selected.",
  "optional notes": "Notes are supplemental and may be omitted by the user.",
};
