# LightPay — Design System

## Brand Identity

**LightPay** — Fast. Simple. Yours.

A modern African fintech brand that feels premium, approachable, and trustworthy. The visual language draws from Nigerian vibrancy while maintaining international fintech credibility.

---

## Color Palette

### Primary Colors
```
Brand Green (Primary)     #00C853   — CTAs, positive states, success
Brand Green Dark          #009624   — Pressed states, dark mode accents
Brand Green Light         #5EFC82   — Highlights, backgrounds
Brand Green Pale          #E8F5E9   — Subtle backgrounds, chip fills
```

### Neutral Colors
```
Ink Black                 #0A0A0F   — Primary text, headings
Ink Dark                  #1A1A2E   — App background (dark mode)
Ink Gray 900              #1C1C2E   — Cards (dark mode)
Gray 700                  #374151   — Secondary text
Gray 500                  #6B7280   — Tertiary text, placeholders
Gray 300                  #D1D5DB   — Dividers, borders
Gray 100                  #F3F4F6   — Input backgrounds
White                     #FFFFFF   — App background (light mode)
```

### Semantic Colors
```
Success                   #00C853   — Completed transactions
Warning                   #FFA726   — Pending, attention required
Error                     #EF4444   — Failed, destructive
Info                      #3B82F6   — Informational states

Credit (Money In)         #00C853   — Green for income
Debit (Money Out)         #EF4444   — Red for spending
```

### Gradient Palette
```
Primary Gradient          linear-gradient(135deg, #00C853 0%, #1DE9B6 100%)
Dark Gradient             linear-gradient(135deg, #0A0A0F 0%, #1A1A2E 100%)
Card Gradient             linear-gradient(135deg, #1A1A2E 0%, #2D2D44 100%)
Gold Accent               linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)
```

---

## Typography

### Font Families
```
Primary:    Plus Jakarta Sans   — Headings, CTAs, amounts
Secondary:  Inter               — Body text, descriptions, labels
Mono:       JetBrains Mono      — Account numbers, references, codes
```

### Type Scale
```
Display XL:   48px / 700 weight / -1px tracking   — Splash screen
Display L:    36px / 700 weight / -0.5px tracking  — Balance amount
Heading 1:    28px / 700 weight / -0.3px tracking  — Screen titles
Heading 2:    22px / 600 weight / 0px tracking     — Section titles
Heading 3:    18px / 600 weight / 0px tracking     — Card titles
Body Large:   16px / 400 weight / 0px tracking     — Primary body
Body:         14px / 400 weight / 0px tracking     — Standard body
Body Small:   12px / 400 weight / 0.1px tracking   — Meta, labels
Caption:      11px / 400 weight / 0.2px tracking   — Legal, footnotes
```

### Amount Display Rules
- Wallet balance: Display L, Plus Jakarta Sans 700
- Transaction amounts: Body Large, Plus Jakarta Sans 600
- Credit amounts: Green (#00C853), always prefixed with +
- Debit amounts: Gray 700 (light) / Gray 300 (dark), prefixed with -

---

## Spacing System

Base unit: 4px

```
xs:   4px
sm:   8px
md:   12px
lg:   16px
xl:   20px
2xl:  24px
3xl:  32px
4xl:  40px
5xl:  48px
6xl:  64px
7xl:  80px
```

---

## Border Radius

```
none:   0px
xs:     4px    — Chips, tags
sm:     8px    — Inputs, small cards
md:     12px   — Cards, modals
lg:     16px   — Bottom sheets, large cards
xl:     20px   — Feature cards
full:   9999px — Pills, avatars, FABs
```

---

## Shadows (Light Mode)

```
sm:   0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
md:   0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)
lg:   0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)
xl:   0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)
card: 0 2px 20px rgba(0,200,83,0.08)  — Green-tinted card shadow
```

---

## Component Specifications

### Buttons

**Primary Button**
```
Height: 56px
Border radius: 16px
Background: #00C853
Text: White, 16px, Plus Jakarta Sans 700
Padding: 0 24px
State — Pressed: scale(0.97), darken 10%
State — Disabled: opacity 0.4
State — Loading: spinner replaces text
```

**Secondary Button**
```
Height: 56px
Border radius: 16px
Background: #E8F5E9
Text: #00C853, 16px, Plus Jakarta Sans 600
Border: 1.5px solid #00C853
```

**Ghost Button**
```
Height: 48px
Background: transparent
Text: #374151, 14px, Inter 500
Border: 1px solid #D1D5DB
```

**Danger Button**
```
Same as Primary but background: #EF4444
```

### Input Fields

```
Height: 56px
Border radius: 12px
Background: #F3F4F6 (light) / #1C1C2E (dark)
Border: 1.5px solid transparent
Border focused: 1.5px solid #00C853
Label: 12px, Inter 500, #6B7280, above input
Placeholder: #9CA3AF
Text: 16px, Inter 400, #0A0A0F
Error text: 12px, Inter 400, #EF4444
```

### Cards

**Wallet Balance Card**
```
Background: Card Gradient (dark) or White (light)
Border radius: 20px
Padding: 24px
Shadow: card shadow
Contains: currency name, balance, account number, quick actions
```

**Transaction List Item**
```
Height: 72px
Layout: horizontal (icon | description + date | amount)
Icon: 40px circle, colored by transaction type
Amount color: Green (credit) / default (debit)
Separator: 1px #F3F4F6
```

**Quick Action Tile**
```
Size: flexible grid (4 per row on 375px screens)
Layout: vertical (icon | label)
Icon background: #E8F5E9
Icon: 24px, #00C853
Label: 11px, Inter 500, #374151
Border radius: 12px
```

### Navigation

**Bottom Tab Bar**
```
Height: 64px + safe area
Background: White (light) / #1A1A2E (dark)
Border top: 1px #F3F4F6
Active tab: icon + label in #00C853
Inactive tab: icon + label in #9CA3AF
Tab items: Home | Transact | Wallets | Profile
```

**Header**
```
Height: 56px
Back button: left, 24px arrow icon
Title: center, 16px Plus Jakarta Sans 600
Action: right, context-specific
```

---

## Iconography

Library: **Phosphor Icons** (React Native)
Style: Regular weight icons; bold for emphasis states
Size: 24px standard, 20px small, 32px feature icons

Icon mapping:
```
Wallet        → Wallet
Send          → PaperPlaneRight
Receive       → ArrowCircleDown
Transfer      → ArrowsLeftRight
Airtime       → Phone
Data          → WifiHigh
Bills         → Lightning
QR            → QrCode
History       → ClockCounterClockwise
Beneficiaries → UsersThree
Home          → House
Profile       → UserCircle
Settings      → GearSix
Notification  → Bell
```

---

## Animation Principles

Library: **React Native Reanimated 3**

```
Duration:
  Instant:    100ms — Tap feedback
  Fast:       200ms — State changes, toggles
  Normal:     300ms — Screen transitions
  Slow:       500ms — Onboarding, splash

Easing:
  Enter:      easeOut  (starts fast, ends smooth)
  Exit:       easeIn   (starts smooth, ends fast)
  Spring:     spring(damping: 20, stiffness: 300)

Key Animations:
  - Screen transitions: shared element + slide
  - Number counting (balance): animated number roll
  - Success state: confetti + checkmark spring
  - Loading: skeleton shimmer (LinearGradient)
  - FAB: spring scale on mount
  - Bottom sheet: spring slide-up
```

---

## Dark Mode

LightPay supports system-default dark mode with manual override.

```
Background:       #0A0A0F → White
Surface:          #1A1A2E → #F9FAFB
Card:             #1C1C2E → White
Border:           #2D2D44 → #E5E7EB
Primary text:     #FFFFFF → #0A0A0F
Secondary text:   #9CA3AF → #6B7280
Accent (Brand):   #00C853 → #00C853  (unchanged)
```
