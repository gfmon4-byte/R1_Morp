# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** RunMorp
**Generated:** 2026-07-02 (revised — Cute/Kawaii Pastel direction, ref: cieloheart.com)
**Category:** Running & Cycling GPS

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#FF8FA3` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#C9A7EB` | `--color-secondary` |
| Accent/CTA | `#7FDBB6` | `--color-accent` |
| Background | `#FFF8F4` | `--color-background` |
| Foreground | `#4A3B52` | `--color-foreground` |
| Muted | `#FDECF1` | `--color-muted` |
| Border | `rgba(255,143,163,0.25)` | `--color-border` |
| Destructive | `#FF6B81` | `--color-destructive` |
| Ring | `#FF8FA3` | `--color-ring` |
| Sky (extra accent) | `#8ECDF0` | `--color-sky` |
| Sun (extra accent) | `#FFD87A` | `--color-sun` |

**Color Notes:** โทนพาสเทลอบอุ่น (candy pastel) — ชมพูพีช + ลาเวนเดอร์ + มินต์ บนพื้นครีมสว่าง ฟีลน่ารักสดใสแบบ Care Bears แทนธีม dark OLED เดิม

### Typography

- **Heading Font:** Baloo 2 (มนกลม หนา น่ารัก อ่านง่ายทั้งอังกฤษ/ตัวเลข)
- **Body Font:** Mali (ฟอนต์ไทยทรงมนเขียนด้วยมือ ให้ฟีล kawaii/friendly)
- **Mood:** cute, kawaii, playful, bubbly, pastel, friendly, whimsical, wholesome
- **Google Fonts:** [Baloo 2 + Mali](https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Mali:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Mali:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths (Soft "Candy" Shadows)

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 2px 6px rgba(255,143,163,0.15)` | Subtle lift |
| `--shadow-md` | `0 6px 16px rgba(255,143,163,0.20)` | Cards, buttons |
| `--shadow-lg` | `0 12px 24px rgba(201,167,235,0.22)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 40px rgba(255,143,163,0.25)` | Hero images, featured cards |

> เงาใช้สีอมชมพู/ม่วงแทนสีดำล้วน เพื่อให้เข้ากับโทนพาสเทลและดูนุ่มนวลไม่หนักเกินไป

---

## Component Specs

### Buttons

```css
/* Primary Button — pill / capsule shape */
.btn-primary {
  background: linear-gradient(135deg, #FF8FA3, #FFB4C6);
  color: white;
  padding: 14px 28px;
  border-radius: 999px;
  font-family: 'Baloo 2', sans-serif;
  font-weight: 700;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: var(--shadow-lg);
}

.btn-primary:active {
  transform: translateY(0) scale(0.98);
}

/* Secondary Button */
.btn-secondary {
  background: #FFFFFF;
  color: #FF8FA3;
  border: 2px solid #FF8FA3;
  padding: 12px 26px;
  border-radius: 999px;
  font-family: 'Baloo 2', sans-serif;
  font-weight: 700;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--color-muted);
  transform: translateY(-2px);
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 2px solid var(--color-border);
  border-radius: 24px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 250ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px) rotate(-0.5deg);
  border-color: var(--color-primary);
}
```

### Inputs

```css
.input {
  background: #FFFFFF;
  padding: 14px 18px;
  border: 2px solid var(--color-border);
  border-radius: 16px;
  font-family: 'Mali', sans-serif;
  font-size: 16px;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 4px rgba(255,143,163,0.20);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(74, 59, 82, 0.35);
  backdrop-filter: blur(6px);
}

.modal {
  background: #FFFFFF;
  border-radius: 28px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
  border: 3px solid var(--color-muted);
}
```

---

## Style Guidelines

**Style:** Light & Pastel (Kawaii / Cute Cartoon) — ref: cieloheart.com (Cieloheart x Care Bears)

**Keywords:** Pastel, rounded, bubbly, soft candy shadows, sticker-style icons, playful, wholesome, sunny, friendly, sky/mint/lavender/coral

**Best For:** Lifestyle & fitness apps ที่ต้องการฟีลอบอุ่น เข้าถึงง่าย ไม่กดดันผู้ใช้ (สวนทางกับความ "จริงจังโหด" ของแอปวิ่งทั่วไป) — เหมาะกับ RunMorp ที่อยากให้การวิ่งดูสนุก ไม่ hardcore จนน่ากลัว

**Key Effects:** Soft tinted shadows (สีชมพู/ม่วงแทนสีดำ), fully rounded pill buttons, card tilt on hover, gradient accents, generous corner radius (16–28px), sticker-style badge elements, gentle bounce transitions

### Page Pattern

**Pattern Name:** Webinar Registration

- **Conversion Strategy:** Limited seats logic. 'Live' indicator. Auto-fill timezone.
- **CTA Placement:** Hero (Right side form) + Bottom anchor
- **Section Order:** 1. Hero (Topic + Timer + Form), 2. What you'll learn, 3. Speaker Bio, 4. Urgency/Bonuses, 5. Form (again)

---

## Anti-Patterns (Do NOT Use)

- ❌ Dark / OLED backgrounds — ธีมนี้คือ light & pastel เท่านั้น
- ❌ Sharp/square corners (border-radius < 12px) — ทุกอย่างต้องมนกลม
- ❌ Cold corporate colors (navy, gray-only, pure black text)
- ❌ Harsh pure-black shadows — ใช้ tinted shadow (ชมพู/ม่วง) แทน
- ❌ Aggressive/intense energetic tone — ต้องการฟีลอบอุ่น น่ารัก ไม่ดุ

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — ใช้ SVG แบบ sticker/rounded outline (เช่น Phosphor Icons rounded, Heroicons) แทน
- ❌ **Missing cursor:pointer** — ทุก element ที่คลิกได้ต้องมี cursor:pointer
- ❌ **Layout-shifting hovers** — หลีกเลี่ยง transform ที่ทำให้ layout เพี้ยน (ใช้ translateY/scale เล็กน้อยพอ)
- ❌ **Low contrast text** — คง contrast ขั้นต่ำ 4.5:1 แม้บนพื้นพาสเทลอ่อน
- ❌ **Instant state changes** — ใช้ transition เสมอ (150–300ms)
- ❌ **Invisible focus states** — ต้องเห็น focus ring ชัดเจนเพื่อ a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] ใช้โทนพาสเทล (ชมพู/ลาเวนเดอร์/มินต์) บนพื้นหลังสว่าง ไม่ใช่ dark mode
- [ ] มุมโค้งมนทุกจุด (ปุ่ม = pill/999px, การ์ด/โมดัล = 16–28px)
- [ ] เงาเป็นแบบ tinted soft shadow ไม่ใช่สีดำล้วน
- [ ] No emojis used as icons (ใช้ SVG แบบมน/สติ๊กเกอร์)
- [ ] All icons from consistent icon set
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150–300ms)
- [ ] Text contrast 4.5:1 minimum แม้บนพื้นอ่อน
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
