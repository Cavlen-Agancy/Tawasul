# Tawasul Academy — UI Rules
## Anti-Generic Design Constitution

These rules exist for one reason: to prevent the platform from looking like it was built by an AI following a template. Every decision here is intentional. If a rule conflicts with a framework default, the rule wins.

---

## The Core Principle

This is a mental health platform. The visual language must communicate calm, warmth, and human care — not efficiency, not technology, not corporate polish. A user opening this app may be anxious, vulnerable, or in distress. The UI must feel like a warm room, not a SaaS dashboard.

---

## 1. Colors

### Brand Palette
```
Primary Magenta:   #E91E8C   — CTAs, active states, key highlights only
Primary Deep:      #C4157A   — hover states on primary elements
Primary Soft:      #FCE4F3   — backgrounds, selected states, soft highlights
Ink:               #2D2D2D   — all body text, headings
Body Text:         #4D4D4D   — secondary text, descriptions
Muted:             #888888   — placeholders, captions, disabled labels
Hairline:          #EBEBEB   — borders, dividers
Canvas:            #FFFFFF   — main background
Canvas Soft:       #FAFAFA   — section backgrounds, card backgrounds
Success:           #22C55E   — confirmations, completed states
Error:             #EF4444   — errors, destructive actions
Warning:           #F59E0B   — warnings, pending states
```

### Color Rules

**DO:**
- Use `#E91E8C` (Primary Magenta) exclusively for: primary CTA buttons, active nav indicators, selected states, progress indicators, and key brand moments.
- Use `#FCE4F3` (Primary Soft) as a background tint for: selected cards, tag backgrounds, soft call-out sections, and input focus rings.
- Use `#2D2D2D` (Ink) for all headings and body text — it is warmer than pure black and matches the logo.
- Alternate page sections between `#FFFFFF` and `#FAFAFA` for depth without heavy borders.
- Use green (`#22C55E`) only for genuine success states — confirmed booking, verified email, successful payment.

**DO NOT:**
- Do not use `#E91E8C` as a large background fill for content sections. It is a highlight color, not a canvas.
- Do not use blue anywhere. There is no blue in this design system.
- Do not use pure black (`#000000`) for text.
- Do not use gray as the primary color for any interactive element — gray means disabled.
- Do not use more than two colors in a single component.
- Do not add a new accent color for any reason. The palette is complete.

---

## 2. Typography

### Fonts
```
Headings / UI Labels / Buttons:  Inter (weights: 400, 500, 600)
Body Text / Descriptions:        DM Sans (weights: 400, 500)
```

Load both fonts from Google Fonts. Inter is the structural voice. DM Sans is the conversational voice.

### Type Scale
```
Display XL:   Inter 600 / 48px / line-height 1.15 / tracking -0.02em
Display LG:   Inter 600 / 40px / line-height 1.2  / tracking -0.02em
Display MD:   Inter 600 / 32px / line-height 1.25 / tracking -0.01em
H1:           Inter 600 / 28px / line-height 1.3
H2:           Inter 500 / 24px / line-height 1.35
H3:           Inter 500 / 20px / line-height 1.4
Body LG:      DM Sans 400 / 18px / line-height 1.6
Body MD:      DM Sans 400 / 16px / line-height 1.6
Body SM:      DM Sans 400 / 14px / line-height 1.5
Caption:      DM Sans 400 / 12px / line-height 1.5
Button LG:    Inter 600 / 16px / letter-spacing 0
Button SM:    Inter 500 / 14px / letter-spacing 0
```

### Typography Rules

**DO:**
- Use Inter 600 for all headings, button labels, and navigation items.
- Use DM Sans 400 for all body text, descriptions, form labels, and helper text.
- Use sentence case for all headings and buttons. ("Book your session" not "Book Your Session")
- Apply negative letter-spacing (−0.01em to −0.02em) to display-size headings only.
- Keep line-height between 1.5 and 1.6 for body text — mental health content needs breathing room.

**DO NOT:**
- Do not use all-caps for anything except badge labels and status chips — and even then, use it sparingly.
- Do not use font weights above 600. Bold (700+) feels aggressive in this context.
- Do not mix Inter and DM Sans in the same text block.
- Do not set body text below 14px anywhere.
- Do not use condensed or tight letter-spacing on body text.

---

## 3. Spacing

### Base Grid: 8px
Every spacing value must be a multiple of 8px.

```
4px   — micro gaps (icon to label, badge padding)
8px   — tight spacing (within components)
12px  — small internal padding
16px  — standard component padding
24px  — section sub-spacing
32px  — component separation
48px  — section spacing (mobile)
64px  — section spacing (desktop)
80px  — hero/large section padding
```

### Spacing Rules

**DO:**
- Give every section generous top and bottom padding. Minimum 48px on mobile, 64px on desktop.
- Use consistent internal padding on cards: 24px on desktop, 16px on mobile.
- Add more whitespace than you think you need. Mental health context requires visual breathing room.
- Align all elements to the 8px grid.

**DO NOT:**
- Do not use odd spacing values (15px, 22px, 37px).
- Do not collapse spacing between sections to save vertical space — the whitespace is intentional.
- Do not use padding below 16px inside any card or modal.

---

## 4. Border Radius

```
Extra Small:  8px   — input fields, small chips, tooltips
Small:        12px  — small cards, secondary buttons
Medium:       16px  — standard cards, primary buttons
Large:        20px  — modals, drawers, large cards
Extra Large:  24px  — hero cards, feature cards
Full:         9999px — pill buttons, avatar images, tags
```

### Radius Rules

**DO:**
- Use 16px radius on all primary buttons and standard cards.
- Use 9999px (pill) for small badge-style tags, status chips, and avatar images.
- Use 24px for any card that takes up significant visual space (feature cards, booking summary, session cards).
- Use the same radius consistently within a component type — all booking cards use the same radius.

**DO NOT:**
- Do not use 0px radius (sharp corners) anywhere. Sharp corners feel clinical, not warm.
- Do not mix multiple radius values within a single card or modal.
- Do not use different radius values for the same component in different contexts.

---

## 5. Shadows

```
Soft:    0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)
Medium:  0 4px 16px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)
Strong:  0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)
Magenta: 0 4px 24px rgba(233,30,140,0.15)   — primary buttons on hover only
```

### Shadow Rules

**DO:**
- Use `Soft` shadow on all cards in their default state.
- Use `Medium` shadow when a card is hovered or focused.
- Use `Strong` shadow for modals and drawers only.
- Use `Magenta` shadow exclusively on the primary CTA button on hover — this creates a signature brand moment.
- Stack two shadow values (ambient + directional) on every shadow — single-value shadows look flat and AI-generated.

**DO NOT:**
- Do not use `box-shadow: 0 1px 3px rgba(0,0,0,0.1)` — this is the default AI shadow and it looks generic.
- Do not apply shadows to flat UI elements like dividers, navigation bars, or text.
- Do not use dark-colored shadows. All shadows use black at very low opacity.
- Do not use hard drop shadows (high blur, high opacity, visible offset).

---

## 6. Buttons

### Button Types
```
Primary:    Background #E91E8C, text white, radius 16px, height 48px (LG) / 40px (SM)
Secondary:  Background white, border 1.5px solid #E91E8C, text #E91E8C, radius 16px
Ghost:      Background transparent, no border, text #E91E8C, underline on hover
Danger:     Background #EF4444, text white, radius 16px
Disabled:   Background #EBEBEB, text #888888, cursor not-allowed, no hover effect
```

### Button States
```
Default:  base styles above
Hover:    primary → #C4157A background + magenta shadow / secondary → #FCE4F3 background
Pressed:  scale(0.98) transform + slightly darker background
Disabled: #EBEBEB background, #888888 text, no interaction
Loading:  spinner inside button, button stays same width, text hidden
```

### Button Rules

**DO:**
- Always show a loading spinner inside the button (not outside) when an API call is in progress.
- Keep the button the same width during loading — do not let it shrink or expand.
- Use primary button only once per visual section. Multiple primary buttons on the same screen dilute the CTA.
- Use ghost/text buttons for secondary navigation actions ("Back", "Cancel", "Skip").
- Add transition: `all 0.15s ease` to all button states.

**DO NOT:**
- Do not use square buttons (radius: 0). Every button has at least 12px radius.
- Do not use uppercase text on buttons.
- Do not rely on color alone to indicate disabled state — also reduce opacity to 0.5.
- Do not place two primary buttons side by side.
- Do not write button labels longer than 4 words. "Book a Session" not "Click here to book your counseling session".

---

## 7. Input Fields

### Input Styles
```
Default:   Border 1.5px solid #EBEBEB, radius 12px, background #FAFAFA, height 48px
Focus:     Border 1.5px solid #E91E8C, background white, ring: 0 0 0 3px #FCE4F3
Error:     Border 1.5px solid #EF4444, background #FEF2F2
Success:   Border 1.5px solid #22C55E, background #F0FDF4
Disabled:  Background #F5F5F5, border #EBEBEB, text #888888, cursor not-allowed
```

### Input Rules

**DO:**
- Show field labels above the input — not as floating labels. Floating labels cause confusion.
- Show error messages directly below the input they relate to in `DM Sans 400 12px #EF4444`.
- Show a checkmark icon inside the input on successful validation (e.g. valid email format).
- Use placeholder text as an example, not as the label. (`placeholder="ahmed@example.com"` not `placeholder="Email"`)
- Add `transition: all 0.15s ease` to border and background on all inputs.

**DO NOT:**
- Do not use outline-style inputs (bottom border only). Use full-border inputs always.
- Do not show all error messages at the top of the form — show them inline below each field.
- Do not use red backgrounds on error inputs — use a very light tint (`#FEF2F2`) only.
- Do not make input fields full-width on desktop if they are standalone — max-width 480px for single inputs.

---

## 8. Cards

### Card Anatomy
Every card must have:
- Consistent internal padding (24px desktop, 16px mobile)
- Radius of 16px minimum (24px for large/feature cards)
- Soft shadow (not a border)
- Clear visual hierarchy: one primary piece of information, supporting details below

### Card Rules

**DO:**
- Use cards to group related information — not just as a visual container for everything.
- Give cards a hover state: shadow increases from Soft to Medium, subtle translateY(-2px).
- Use a hairline border (`1px solid #EBEBEB`) on cards that sit on white backgrounds to define edges without using shadow alone.
- Keep card content left-aligned for readability.

**DO NOT:**
- Do not stack more than 3 levels of visual hierarchy inside a single card.
- Do not put a card inside a card (nested cards).
- Do not use card titles in all-caps.
- Do not add background colors to cards unless they serve a semantic purpose (e.g. a success card is `#F0FDF4`).
- Do not make all cards the same height artificially — let content define height.

---

## 9. Navigation

### Sidebar (Dashboard)
```
Width:        240px desktop
Background:   #FAFAFA
Border right: 1px solid #EBEBEB
Item height:  48px
Active state: Background #FCE4F3, left border 3px solid #E91E8C, text #E91E8C, weight 600
Hover state:  Background #F5F5F5, text #2D2D2D
Inactive:     Text #4D4D4D, weight 400
Logo area:    64px height, centered or left-aligned
```

### Top Navigation Bar (Marketing Pages)
```
Height:       64px
Background:   white
Border bottom: 1px solid #EBEBEB
Sticky:       yes — stays at top on scroll
Logo:         left-aligned
Links:        center, DM Sans 400 16px #4D4D4D, hover #E91E8C with 0.15s transition
CTA:          right, primary button (Book Now)
```

### Navigation Rules

**DO:**
- Keep the active state obvious — use both a background tint AND a left border AND a color change for sidebar items.
- Collapse the sidebar to a bottom navigation bar on mobile (max 4 items, icons + labels).
- Use smooth transitions (0.2s ease) on sidebar collapse/expand.

**DO NOT:**
- Do not underline navigation links in the top bar — use color change on hover instead.
- Do not use icons without labels in the sidebar — always show both.
- Do not add more than 6 items to the sidebar. If there are more, group them.

---

## 10. Status & Feedback

### Status Chips / Badges
```
Confirmed / Success:  Background #DCFCE7, text #15803D, radius 9999px
Cancelled:            Background #F3F4F6, text #6B7280, radius 9999px
Pending:              Background #FEF9C3, text #854D0E, radius 9999px
Failed:               Background #FEE2E2, text #991B1B, radius 9999px
Active:               Background #FCE4F3, text #C4157A, radius 9999px
```

### Toast Notifications
```
Position:    Top center, 16px from top
Width:       Max 480px, min 320px
Radius:      12px
Shadow:      Strong
Duration:    4 seconds auto-dismiss
Types:       Success (green left border), Error (red left border), Info (magenta left border)
```

### Empty States
Every list, table, or grid must have an empty state. The empty state must include:
- An illustration or icon (not just text)
- A short headline ("No appointments yet")
- A one-sentence description
- A primary CTA if applicable ("Book your first session")

### Loading States
- Use skeleton screens, not spinners, for page-level loading (list of appointments, calendar).
- Use spinners inside buttons only — not on page level.
- Skeleton color: `#EBEBEB` with a shimmer animation from left to right.
- Never show a blank white page while loading.

---

## 11. Spacing & Layout Patterns

### Page Layout
```
Max content width:    1200px
Side padding desktop: 48px
Side padding mobile:  16px
Section padding:      64px top and bottom (desktop), 48px (mobile)
```

### Grid
- Use a 12-column grid on desktop.
- Cards and content blocks snap to the grid.
- Never center a single column of text wider than 680px — this is the comfortable reading width.

### Responsive Breakpoints
```
Mobile:  < 768px
Tablet:  768px – 1024px
Desktop: > 1024px
```

---

## 12. What Generic AI UI Looks Like (Avoid All of This)

The following patterns make a UI look AI-generated. Never use them:

| Pattern | Why It Looks Generic | What To Do Instead |
|---|---|---|
| Blue primary color | Default Tailwind blue, used everywhere | Use brand magenta only |
| `shadow-md` (single shadow) | Tailwind default, flat and dull | Use stacked two-value shadows |
| `rounded-lg` on everything | Inconsistent, no hierarchy | Define specific radius per component type |
| Full-width buttons everywhere | No visual hierarchy | Size buttons to their context |
| `gray-500` text for descriptions | No warmth or personality | Use `#4D4D4D` or `#888888` specifically |
| Cards with visible heavy borders | Looks like a wireframe | Use soft shadows instead of borders on white |
| All-caps section labels | Overused pattern | Use sentence-case with weight and size for hierarchy |
| Loading spinners on page level | Feels unfinished | Use skeleton screens with shimmer |
| Empty states with only text | Bare, undesigned | Always pair with an icon/illustration and a CTA |
| Modals with sharp corners | Cold and clinical | Minimum 20px radius on all modals |
| Navigation links in `font-medium` gray | Invisible hierarchy | Use `#4D4D4D` with clear active/hover states |
| Form with all fields the same width | No visual flow | Vary field widths by content type (email wider, phone shorter) |
| Success/error colors without background tint | Hard to scan | Always pair color with a soft background tint |

---

## 13. Voice & Microcopy

The words on screen are part of the design. Mental health context requires specific care.

**DO:**
- Use warm, direct language. "Your session is confirmed" not "Booking successful."
- Use the patient's name when known. "Welcome back, Ahmed" not "Welcome back, User."
- Explain what happens next after every action. After booking: "You'll receive a confirmation email shortly."
- Use soft language for errors. "We couldn't process your payment — please try again" not "Payment failed."

**DO NOT:**
- Do not use technical jargon in user-facing text (no "500 error", no "null value", no "timeout").
- Do not use exclamation marks excessively. One per session maximum.
- Do not use passive voice. "We sent you an email" not "An email has been sent."
- Do not use the word "invalid" directly to users. Say "Please check your email address" instead of "Invalid email."

---

## 14. Animation & Transitions

```
Micro interactions:  0.15s ease (button hover, input focus, link hover)
Component transitions: 0.2s ease (sidebar collapse, tab switch, dropdown open)
Page transitions:    0.3s ease (route changes)
Skeleton shimmer:    1.5s ease-in-out infinite
```

**DO:**
- Animate every interactive state change — no instant jumps.
- Use `transform` and `opacity` for animations (GPU-accelerated, smooth).
- Add `transition: all 0.15s ease` as a base on all interactive elements.

**DO NOT:**
- Do not animate anything longer than 0.4s — it feels slow.
- Do not use `transition: all` on elements with many changing properties — be specific.
- Do not use bounce or elastic easing — it feels playful, not calm.
- Do not animate layout properties (width, height, padding) — use transform instead.

---

*Tawasul Academy — UI Rules v1.0*
*Every rule here exists to serve the user's emotional state, not to follow a convention.*
