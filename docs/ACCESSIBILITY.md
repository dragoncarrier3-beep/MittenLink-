# Accessibility

MittenLink is built toward **WCAG 2.2 Level AA** from the start. The primary users are people with disabilities and their families, so accessibility is part of every component, not a final polish step.

## What is built in

- **Semantic structure.** Landmarks (`header`, `nav` with labels, `main`, `footer`), one `h1` per page, and logical heading order. A skip link ("Skip to main content") is the first focusable element.
- **Keyboard.** Every feature works without a mouse. A high-visibility 3px amber focus outline is applied globally.
  - Menus and the filter drawer close with Escape and return focus to the button that opened them.
  - The location autocomplete follows the WAI-ARIA combobox pattern.
- **Target sizes.** Buttons, inputs, and navigation links are at least 44px tall. The WCAG 2.2 minimum is 24px.
- **Forms.** Every form has:
  - a visible label on every field;
  - required fields marked both visually (`*`) and for screen readers ("required");
  - hints and errors linked with `aria-describedby`, and `aria-invalid` set on invalid fields;
  - an error summary that receives focus and links to each invalid field;
  - the user's values restored after a failed submit.
- **Status updates.** Search result counts and form outcomes are announced through `role="status"` and `role="alert"` live regions.
- **Color and contrast.** All body text meets at least 4.5:1, and muted text is at least 7:1. Form control borders meet 3:1. Status is never shown by color alone: badges always include text and an icon.
- **Maps are optional.** The accessible list is the primary search experience. Every mapped result also appears in the list, and if the map fails, a friendly message appears while the list keeps working.
- **Tables.** On desktop they are real tables with captions and scoped headers. On phones they become stacked cards, with no horizontal scrolling.
- **Pagination.** Uses real links, `aria-current="page"`, and descriptive labels.
- **Motion and contrast preferences.** `prefers-reduced-motion` disables transitions. `prefers-contrast: more` strengthens borders. Forced-colors (Windows High Contrast) mode is supported.
- **Zoom and reflow.** Layouts use relative units and reflow down to 320px wide and at 200% or higher zoom.
- **Readable type.** Body text is 17px in Atkinson Hyperlegible, a typeface designed by the Braille Institute for low-vision readers.
- **Content.** Plain language, descriptive link text, and no disability stereotypes. Images need meaningful alt text; uploaded logos require alt text.

## Testing

Automated:
```bash
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright end-to-end flows + axe-core scans of critical pages
```
The axe scans cover: homepage, search and filters, provider profile, sign-in, provider claim, provider dashboard, verifier queue, and admin review forms. They fail on any WCAG 2.0/2.1/2.2 A or AA violation.

Automated tests do not replace manual review. Before each release:

| Check | How |
|---|---|
| Keyboard only | Complete the full demo script without a mouse; focus must always be visible and in a logical order |
| Screen reader | NVDA + Firefox/Chrome (Windows) and VoiceOver + Safari (macOS/iOS): search, filters, results, profile, claim, and report forms |
| 200% / 400% zoom | No lost content or horizontal scrolling at 1280px wide and 400% zoom |
| Mobile widths | 320, 375, 390, 768, 1024, 1440px |
| Reduced motion | Enable the OS setting and confirm no animated transitions |
| High contrast | Windows contrast themes: badges, buttons, and focus remain visible |

Report accessibility barriers using the contact details in the accessibility statement at `/about#accessibility`.
