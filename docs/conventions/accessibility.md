# Accessibility conventions

Target: WCAG 2.1 AA, plus 2.2.2 (Pause, Stop, Hide) for motion.

## Interactive elements

- Visible focus states everywhere (`:focus-visible` is styled globally).
- Show/hide toggles carry `aria-expanded`; icon-only buttons carry `aria-label` (text from a placeholder, see [blocks.md](blocks.md#content-and-copy)).
- Use `scripts/utils/a11y.js` for tabs (`activateTab`, `rovingTabindex`), focus traps (`trapFocus`) and live announcements (`announce`) instead of per-block versions.
- `ak.js` injects the skip-to-content link; `main` must keep its id.

## Color and contrast

- 4.5:1 for normal text, 3:1 for large text.
- Semantic color tokens only; never hardcode colors in block JS.

## Motion

- `shouldAnimate()` in `scripts/utils/motion/motion.js` decides whether motion starts. It does not satisfy WCAG 2.2.2 on its own.
- Anything that moves, scrolls or auto-updates for 5 seconds or more needs a user-operable pause control: `addPauseToggle()` from the same module (see `logo-wall.js`).
- Video autoplay checks `shouldAnimate()` (see `hero.js`).

## Semantic HTML

- One `h1` per page and an unbroken heading hierarchy.
- Landmarks (`nav`, `main`, `footer`) where appropriate.
- `<details>`/`<summary>` for expand/collapse (see the `faq` block).
- Decorative image plus accessible name: `buildAccessibleLogo()` and the `.visually-hidden` class.
