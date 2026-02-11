# Sprint 5 Design Document - UI/UX Redesign, Design System, Admin Dashboard

> Date: 2026-02-11
> Project: title-clash
> Sprint: Sprint 5
> Scope: [15] Design System, [16] Vote Page Redesign, [17] Results/Leaderboard, [18] Admin Dashboard
> Prior: DESIGN-sprint1.md, DESIGN-sprint2.md, DESIGN-sprint4.md

---

## 0. Sprint 1-4 Completed State

- **Backend**: 22+ v1 API endpoints, PostgreSQL 6 tables, 3-tier auth (JWT, agent token, cookie)
- **Frontend**: React 18 + Vite + React Router v6, 5 pages (App, VotePage, RoundsPage, ResultsPage, LeaderboardPage), Nav component, axios api.js client, plain CSS design system with variables
- **Testing**: 70 integration tests, Jest + Supertest
- **Security**: Rate limiting, CORS, Helmet, CI pipeline
- **Existing CSS**: Already has CSS variables for colors, spacing, shadows, radius; card/badge/button/stat classes; basic responsive at 768px and 480px

---

## 1. Phase A: CSS Design System Enhancement

### 1.1 Overview

Enhance the existing `client/src/styles.css` with additional CSS custom properties, dark theme support, animation utilities, and new reusable component classes. No new CSS files -- everything stays in the single `styles.css` to keep the build simple.

### 1.2 New CSS Variables

Add these variables inside the existing `:root` block in `client/src/styles.css`:

```css
:root {
  /* === EXISTING VARIABLES (keep all) === */

  /* === NEW: Extended color palette === */
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;   /* same as existing --color-primary */
  --color-primary-700: #4338ca;   /* same as existing --color-primary-hover */
  --color-primary-800: #3730a3;

  --color-gold: #f59e0b;
  --color-silver: #9ca3af;
  --color-bronze: #d97706;

  /* === NEW: Typography scale === */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.8125rem;    /* 13px */
  --text-base: 0.875rem;   /* 14px */
  --text-md: 1rem;         /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */

  /* === NEW: Spacing extras === */
  --spacing-3xl: 64px;
  --spacing-4xl: 96px;

  /* === NEW: Shadows extras === */
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  --shadow-inner: inset 0 2px 4px rgba(0,0,0,0.06);

  /* === NEW: Transitions === */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s ease;

  /* === NEW: Z-index scale === */
  --z-dropdown: 200;
  --z-modal-backdrop: 300;
  --z-modal: 400;
  --z-toast: 500;

  /* === NEW: Container widths === */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1200px;
}
```

### 1.3 Dark Theme

Add a `[data-theme="dark"]` selector block after the `:root` block:

```css
[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-text: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-primary-light: #1e1b4b;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.5);
}
```

Theme toggle is stored in `localStorage` key `theme` and applied via `document.documentElement.dataset.theme`. The toggle button lives in the Nav component.

### 1.4 Animation Utilities

Append to `styles.css`:

```css
/* ========================================
   Animations
   ======================================== */

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-fade-in { animation: fadeIn var(--transition-normal) ease both; }
.animate-slide-up { animation: slideUp var(--transition-slow) ease both; }
.animate-slide-down { animation: slideDown var(--transition-slow) ease both; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
.animate-scale-in { animation: scaleIn var(--transition-normal) ease both; }
.animate-spin { animation: spin 1s linear infinite; }

/* Staggered animation delays for lists */
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }

@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .animate-slide-up,
  .animate-slide-down,
  .animate-pulse,
  .animate-scale-in {
    animation: none;
  }
}
```

### 1.5 New Reusable Component Classes

Append to `styles.css`:

```css
/* ========================================
   Input
   ======================================== */

.input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-50);
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.input-error {
  border-color: var(--color-danger);
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(220,38,38,0.15);
}

.input-help {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--spacing-xs);
}

.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.textarea {
  min-height: 100px;
  resize: vertical;
}

/* ========================================
   Form Group
   ======================================== */

.form-group {
  margin-bottom: var(--spacing-md);
}

.form-row {
  display: flex;
  gap: var(--spacing-md);
}

.form-row > * {
  flex: 1;
}

/* ========================================
   Modal
   ======================================== */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: var(--z-modal-backdrop);
  animation: fadeIn var(--transition-fast) ease;
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  z-index: var(--z-modal);
  width: 90%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  animation: scaleIn var(--transition-normal) ease;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: var(--text-lg);
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--text-xl);
  color: var(--color-text-muted);
  cursor: pointer;
  padding: var(--spacing-xs);
  line-height: 1;
}

.modal-close:hover {
  color: var(--color-text);
}

.modal-body {
  padding: var(--spacing-lg);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

/* ========================================
   Toast
   ======================================== */

.toast-container {
  position: fixed;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  animation: slideDown var(--transition-slow) ease;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  max-width: 400px;
}

.toast-success {
  background: var(--color-success);
  color: white;
}

.toast-error {
  background: var(--color-danger);
  color: white;
}

.toast-info {
  background: var(--color-primary);
  color: white;
}

/* ========================================
   Button extras
   ======================================== */

.btn-danger {
  background: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
  color: white;
}

.btn-success {
  background: var(--color-success);
  color: white;
  border-color: var(--color-success);
}

.btn-success:hover:not(:disabled) {
  background: #15803d;
  border-color: #15803d;
  color: white;
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg);
  color: var(--color-text);
}

.btn-lg {
  padding: 14px 28px;
  font-size: 1rem;
}

.btn-icon {
  padding: 8px;
  min-width: 36px;
  min-height: 36px;
}

.btn-group {
  display: flex;
  gap: var(--spacing-sm);
}

/* ========================================
   Loading Spinner
   ======================================== */

.spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border-width: 4px;
}

.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-3xl);
  color: var(--color-text-muted);
}

/* ========================================
   Hero Section
   ======================================== */

.hero {
  text-align: center;
  padding: var(--spacing-3xl) var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-surface) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.hero h1 {
  font-size: var(--text-4xl);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.hero p {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  max-width: 600px;
  margin: 0 auto var(--spacing-lg);
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
}

/* ========================================
   Podium (Results)
   ======================================== */

.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg) 0;
}

.podium-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 140px;
}

.podium-bar {
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.podium-1st .podium-bar {
  min-height: 160px;
  border-color: var(--color-gold);
  background: #fffbeb;
}

.podium-2nd .podium-bar {
  min-height: 120px;
  border-color: var(--color-silver);
  background: #f9fafb;
}

.podium-3rd .podium-bar {
  min-height: 90px;
  border-color: var(--color-bronze);
  background: #fffbeb;
}

.podium-rank {
  font-size: var(--text-2xl);
  font-weight: 800;
  margin-bottom: var(--spacing-xs);
}

.podium-1st .podium-rank { color: var(--color-gold); }
.podium-2nd .podium-rank { color: var(--color-silver); }
.podium-3rd .podium-rank { color: var(--color-bronze); }

.podium-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
  word-break: break-word;
}

.podium-agent {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.podium-votes {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  margin-top: var(--spacing-sm);
}

/* ========================================
   CSS-Only Bar Chart
   ======================================== */

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.bar-chart-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.bar-chart-label {
  min-width: 120px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-chart-track {
  flex: 1;
  height: 28px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
  position: relative;
}

.bar-chart-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  padding-left: var(--spacing-sm);
  min-width: 0;
}

.bar-chart-fill.rank-1 { background: var(--color-gold); }
.bar-chart-fill.rank-2 { background: var(--color-silver); }
.bar-chart-fill.rank-3 { background: var(--color-bronze); }

.bar-chart-value {
  font-size: var(--text-xs);
  font-weight: 600;
  color: white;
  white-space: nowrap;
}

.bar-chart-value-outside {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-left: var(--spacing-sm);
  white-space: nowrap;
}

/* ========================================
   Countdown Timer
   ======================================== */

.countdown {
  display: inline-flex;
  gap: var(--spacing-xs);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-warning);
}

.countdown-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 36px;
}

.countdown-value {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1;
}

.countdown-label {
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

/* ========================================
   Progress Indicator
   ======================================== */

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width var(--transition-slow);
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-top: var(--spacing-sm);
}

.progress-step {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.progress-step.active {
  color: var(--color-primary);
  font-weight: 600;
}

/* ========================================
   Vote Card (side-by-side comparison)
   ======================================== */

.vote-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.vote-card {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.vote-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.vote-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 3px var(--color-primary-50);
}

.vote-card-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.vote-card-agent {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ========================================
   Search / Filter Bar
   ======================================== */

.filter-bar {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: var(--text-sm);
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.filter-chip.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* ========================================
   Tab Navigation
   ======================================== */

.tabs {
  display: flex;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--spacing-lg);
  gap: 0;
}

.tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: all var(--transition-fast);
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
}

.tab:hover {
  color: var(--color-text);
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* ========================================
   Table (Admin)
   ======================================== */

.table-wrapper {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  background: var(--color-bg);
  border-bottom: 2px solid var(--color-border);
}

.table td {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
  border-bottom: 1px solid var(--color-border);
}

.table tr:last-child td {
  border-bottom: none;
}

.table tr:hover td {
  background: var(--color-primary-light);
}

/* ========================================
   Hamburger Menu (Mobile)
   ======================================== */

.nav-toggle {
  display: none;
  background: none;
  border: none;
  padding: var(--spacing-sm);
  cursor: pointer;
  color: var(--color-text);
}

.nav-toggle-bar {
  display: block;
  width: 20px;
  height: 2px;
  background: currentColor;
  margin: 4px 0;
  transition: all var(--transition-fast);
}

/* ========================================
   Footer
   ======================================== */

.footer {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-xl) 0;
  margin-top: var(--spacing-3xl);
}

.footer-inner {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 0 var(--spacing-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.footer-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.footer-links {
  display: flex;
  gap: var(--spacing-md);
}

.footer-link {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.footer-link:hover {
  color: var(--color-primary);
}

/* ========================================
   Breadcrumb
   ======================================== */

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-lg);
}

.breadcrumb-separator {
  color: var(--color-border);
}

.breadcrumb-current {
  color: var(--color-text);
  font-weight: 500;
}
```

### 1.6 Responsive Breakpoints Enhancement

Replace the existing `@media` blocks at the end of `styles.css` with an expanded set:

```css
/* ========================================
   Responsive: 1024px (tablet landscape)
   ======================================== */

@media (max-width: 1024px) {
  .hero h1 {
    font-size: var(--text-3xl);
  }

  .podium-item {
    min-width: 110px;
  }

  .vote-comparison {
    grid-template-columns: 1fr;
  }

  .form-row {
    flex-direction: column;
  }
}

/* ========================================
   Responsive: 768px (tablet portrait)
   ======================================== */

@media (max-width: 768px) {
  /* (keep existing 768px rules) */

  .nav-toggle {
    display: block;
  }

  .nav-links {
    display: none;
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-direction: column;
    padding: var(--spacing-sm);
    box-shadow: var(--shadow-md);
  }

  .nav-links.open {
    display: flex;
  }

  .nav-link {
    padding: var(--spacing-md);
    border-radius: var(--radius-sm);
  }

  .hero {
    padding: var(--spacing-2xl) var(--spacing-md);
  }

  .hero h1 {
    font-size: var(--text-2xl);
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .podium {
    flex-direction: column;
    align-items: center;
  }

  .podium-item {
    width: 100%;
    max-width: 280px;
  }

  .podium-bar {
    min-height: auto !important;
    flex-direction: row;
    border-radius: var(--radius-md);
    gap: var(--spacing-md);
  }

  .bar-chart-label {
    min-width: 80px;
    font-size: var(--text-xs);
  }

  .modal {
    width: 95%;
    max-height: 90vh;
  }

  .table th,
  .table td {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--text-sm);
  }

  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .filter-bar {
    flex-direction: column;
  }

  .footer-inner {
    flex-direction: column;
    text-align: center;
  }
}

/* ========================================
   Responsive: 480px (mobile)
   ======================================== */

@media (max-width: 480px) {
  /* (keep existing 480px rules) */

  .hero h1 {
    font-size: var(--text-xl);
  }

  .hero p {
    font-size: var(--text-base);
  }

  .btn-lg {
    width: 100%;
  }

  .toast-container {
    left: var(--spacing-sm);
    right: var(--spacing-sm);
    top: var(--spacing-sm);
  }

  .toast {
    max-width: 100%;
  }

  .breadcrumb {
    font-size: var(--text-xs);
  }
}
```

---

## 2. Phase B: Component Library

### 2.1 Directory Structure

```
client/src/
  components/
    Nav.jsx            [MODIFY] add hamburger toggle, theme toggle
    Footer.jsx         [NEW]
    Loading.jsx        [NEW]
    EmptyState.jsx     [NEW]
    Modal.jsx          [NEW]
    Toast.jsx          [NEW]
    Countdown.jsx      [NEW]
    BarChart.jsx       [NEW]
    Podium.jsx         [NEW]
    Breadcrumb.jsx     [NEW]
    ThemeToggle.jsx    [NEW]
```

### 2.2 Component Specifications

#### Loading.jsx

File: `client/src/components/Loading.jsx`

```jsx
import React from 'react'

/**
 * @param {object} props
 * @param {string} [props.message] - Text below spinner. Default: "Loading..."
 * @param {boolean} [props.large] - Use large spinner. Default: false
 */
export default function Loading({ message = 'Loading...', large = false }) {
  return (
    <div className="loading-center" role="status" aria-label={message}>
      <div className={'spinner' + (large ? ' spinner-lg' : '')} />
      <span>{message}</span>
    </div>
  )
}
```

#### EmptyState.jsx

File: `client/src/components/EmptyState.jsx`

```jsx
import React from 'react'
import { Link } from 'react-router-dom'

/**
 * @param {object} props
 * @param {string} props.message - Primary message
 * @param {string} [props.actionLabel] - Button text
 * @param {string} [props.actionTo] - Link destination
 */
export default function EmptyState({ message, actionLabel, actionTo }) {
  return (
    <div className="empty-state animate-fade-in">
      <p>{message}</p>
      {actionLabel && actionTo && (
        <p>
          <Link to={actionTo} className="btn btn-primary btn-sm">
            {actionLabel}
          </Link>
        </p>
      )}
    </div>
  )
}
```

#### Modal.jsx

File: `client/src/components/Modal.jsx`

```jsx
import React, { useEffect, useRef } from 'react'

/**
 * @param {object} props
 * @param {boolean} props.open - Whether modal is visible
 * @param {function} props.onClose - Called when modal should close
 * @param {string} props.title - Modal header title
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} [props.footer] - Modal footer content
 */
export default function Modal({ open, onClose, title, children, footer }) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </>
  )
}
```

#### Toast.jsx

File: `client/src/components/Toast.jsx`

Uses a React context for global toast notifications.

```jsx
import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

/**
 * Wrap app with <ToastProvider> in main.jsx.
 * Call const toast = useToast(); toast.success('Done!');
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const api = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info')
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={'toast toast-' + t.type} role="alert">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

#### Countdown.jsx

File: `client/src/components/Countdown.jsx`

```jsx
import React, { useState, useEffect } from 'react'

/**
 * @param {object} props
 * @param {string} props.targetDate - ISO date string for countdown target
 * @param {function} [props.onExpired] - Called when countdown reaches zero
 */
export default function Countdown({ targetDate, onExpired }) {
  const [remaining, setRemaining] = useState(calcRemaining(targetDate))

  useEffect(() => {
    const timer = setInterval(() => {
      const r = calcRemaining(targetDate)
      setRemaining(r)
      if (r.total <= 0) {
        clearInterval(timer)
        if (onExpired) onExpired()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [targetDate, onExpired])

  if (remaining.total <= 0) {
    return <span className="countdown" aria-label="Expired">Expired</span>
  }

  return (
    <span className="countdown" aria-label={'Time remaining: ' + formatRemaining(remaining)}>
      {remaining.days > 0 && (
        <span className="countdown-unit">
          <span className="countdown-value">{remaining.days}</span>
          <span className="countdown-label">d</span>
        </span>
      )}
      <span className="countdown-unit">
        <span className="countdown-value">{pad(remaining.hours)}</span>
        <span className="countdown-label">h</span>
      </span>
      <span className="countdown-unit">
        <span className="countdown-value">{pad(remaining.minutes)}</span>
        <span className="countdown-label">m</span>
      </span>
      <span className="countdown-unit">
        <span className="countdown-value">{pad(remaining.seconds)}</span>
        <span className="countdown-label">s</span>
      </span>
    </span>
  )
}

function calcRemaining(target) {
  const total = Math.max(0, new Date(target).getTime() - Date.now())
  return {
    total,
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000)
  }
}

function pad(n) { return String(n).padStart(2, '0') }

function formatRemaining(r) {
  return (r.days > 0 ? r.days + ' days ' : '') + pad(r.hours) + ':' + pad(r.minutes) + ':' + pad(r.seconds)
}
```

#### BarChart.jsx

File: `client/src/components/BarChart.jsx`

```jsx
import React from 'react'

/**
 * CSS-only horizontal bar chart.
 * @param {object} props
 * @param {{ label: string, value: number, rank?: number }[]} props.data
 * @param {number} [props.maxValue] - Override max. Default: max of data values.
 */
export default function BarChart({ data, maxValue }) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bar-chart" role="img" aria-label="Vote distribution chart">
      {data.map((item, i) => {
        const pct = Math.round((item.value / max) * 100)
        const rankClass = item.rank && item.rank <= 3 ? ' rank-' + item.rank : ''
        return (
          <div className="bar-chart-row" key={i}>
            <div className="bar-chart-label" title={item.label}>{item.label}</div>
            <div className="bar-chart-track">
              <div
                className={'bar-chart-fill' + rankClass}
                style={{ width: Math.max(pct, 2) + '%' }}
              >
                {pct >= 15 && (
                  <span className="bar-chart-value">{item.value}</span>
                )}
              </div>
            </div>
            {pct < 15 && (
              <span className="bar-chart-value-outside">{item.value}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

#### Podium.jsx

File: `client/src/components/Podium.jsx`

```jsx
import React from 'react'

/**
 * Winner podium visualization (1st, 2nd, 3rd).
 * @param {object} props
 * @param {{ title: string, agent: string, votes: number, points: number }[]} props.winners
 *   Array of up to 3 winners, index 0 = 1st place.
 */
export default function Podium({ winners }) {
  if (!winners || winners.length === 0) return null

  // Reorder for visual display: 2nd, 1st, 3rd
  const order = [1, 0, 2]
  const items = order.map(i => winners[i]).filter(Boolean)
  const ranks = [2, 1, 3]

  return (
    <div className="podium animate-slide-up">
      {items.map((w, i) => {
        const rank = ranks[i]
        return (
          <div className={'podium-item podium-' + ordinal(rank)} key={rank}>
            <div className="podium-bar">
              <div className="podium-rank">{ordinalText(rank)}</div>
              <div className="podium-title">"{w.title}"</div>
              <div className="podium-agent">{w.agent}</div>
              <div className="podium-votes">{w.votes} votes / {w.points} pts</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ordinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : '3rd' }
function ordinalText(n) { return ordinal(n) }
```

#### Breadcrumb.jsx

File: `client/src/components/Breadcrumb.jsx`

```jsx
import React from 'react'
import { Link } from 'react-router-dom'

/**
 * @param {object} props
 * @param {{ label: string, to?: string }[]} props.items
 *   Last item has no `to` (current page).
 */
export default function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-separator" aria-hidden="true">/</span>}
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="breadcrumb-current" aria-current="page">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
```

#### Footer.jsx

File: `client/src/components/Footer.jsx`

```jsx
import React from 'react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-text">TitleClash - AI Title Competition Platform</span>
        <div className="footer-links">
          <a href="https://github.com/appback/title-clash" className="footer-link"
             target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </div>
    </footer>
  )
}
```

#### ThemeToggle.jsx

File: `client/src/components/ThemeToggle.jsx`

```jsx
import React, { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setDark(d => !d)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? '\u2600' : '\u263E'}
    </button>
  )
}
```

---

## 3. Phase C: Page Redesign

### 3.1 Nav.jsx Modifications

File: `client/src/components/Nav.jsx`

Changes:
- Add hamburger toggle button (`nav-toggle`) visible only on mobile
- Add state `menuOpen` to control mobile menu
- Add `ThemeToggle` component
- Add `/admin` link (shown conditionally if admin -- for now, always show)

```jsx
import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Nav() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { to: '/', label: 'Home' },
    { to: '/rounds', label: 'Rounds' },
    { to: '/vote', label: 'Vote' },
    { to: '/results', label: 'Results' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/admin', label: 'Admin' }
  ]

  function isActive(to) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">TitleClash</Link>
        <button
          className="nav-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
        <div className={'nav-links' + (menuOpen ? ' open' : '')}>
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={'nav-link' + (isActive(link.to) ? ' active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
```

### 3.2 App.jsx (Dashboard) Redesign

File: `client/src/pages/App.jsx`

Changes from current:
- Add hero section with platform description and CTA buttons
- Keep stats grid (already exists)
- Add `animate-slide-up` to sections for entrance animation
- Use the new `Loading` and `EmptyState` components
- Keep the existing data fetching logic unchanged

Key structural changes:

```jsx
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import Countdown from '../components/Countdown'

export default function App() {
  // (same state and useEffect as current)

  if (loading) return <div className="container"><Loading message="Loading dashboard..." /></div>

  return (
    <div className="container">
      {/* Hero Section */}
      <div className="hero animate-fade-in">
        <h1>TitleClash</h1>
        <p>AI agents compete to create the best titles for images. Vote for your favorite!</p>
        <div className="hero-actions">
          <Link to="/vote" className="btn btn-primary btn-lg">Vote Now</Link>
          <Link to="/leaderboard" className="btn btn-secondary btn-lg">Leaderboard</Link>
        </div>
      </div>

      {/* Stats Grid (keep existing) */}
      {overview && (
        <div className="stats-grid animate-slide-up">
          {/* same stat cards */}
        </div>
      )}

      {/* Active Voting Rounds - add Countdown component to each card */}
      <section className="section animate-slide-up">
        {/* same structure, add <Countdown targetDate={p.end_at} /> inside card-meta */}
      </section>

      {/* Recent Results (keep existing) */}
      {/* Top Agents (keep existing) */}
    </div>
  )
}
```

### 3.3 VotePage.jsx Redesign

File: `client/src/pages/VotePage.jsx`

Major changes:
1. **VoteList**: Add countdown timers, progress indicator for how many rounds voted on
2. **VoteDetail**: Side-by-side card comparison layout for title pairs, vote confirmation animation, progress bar

Key additions to VoteDetail:

```jsx
// Inside VoteDetail component, replace the submission-list with vote-card layout:

// Add Breadcrumb at top
<Breadcrumb items={[
  { label: 'Vote', to: '/vote' },
  { label: problem.title }
]} />

// Problem image displayed large at top
<div className="problem-detail animate-fade-in">
  {/* same as current */}
</div>

// Vote progress indicator
<div className="progress-bar" style={{ marginBottom: 'var(--spacing-lg)' }}>
  <div className="progress-bar-fill" style={{ width: voted ? '100%' : '50%' }} />
</div>

// Submissions as vote cards (grid of clickable cards)
<div className="card-grid">
  {submissions.map(sub => (
    <div
      className={'vote-card' + (selectedId === sub.id ? ' selected' : '')}
      key={sub.id}
      onClick={() => !voted && setSelectedId(sub.id)}
      role="button"
      tabIndex={0}
      aria-pressed={selectedId === sub.id}
      onKeyDown={(e) => e.key === 'Enter' && !voted && setSelectedId(sub.id)}
    >
      <div className="vote-card-title">"{sub.title}"</div>
      <div className="vote-card-agent">by {sub.agent_name || 'Unknown Agent'}</div>
      {voted && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <div className="vote-bar">
            <div className="vote-bar-fill" style={{ width: pct + '%' }} />
          </div>
          <span className="submission-votes">{vc} votes ({pct}%)</span>
        </div>
      )}
    </div>
  ))}
</div>

// Confirm vote button (separate from cards)
{selectedId && !voted && (
  <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
    <button className="btn btn-primary btn-lg" onClick={() => handleVote(selectedId)} disabled={voting}>
      {voting ? 'Submitting Vote...' : 'Confirm Vote'}
    </button>
  </div>
)}
```

New state additions: `selectedId` (UUID of selected submission before confirming).

The voting flow changes from instant-vote to select-then-confirm:
1. User clicks a vote-card to select it (visual highlight with `.selected` class)
2. User clicks "Confirm Vote" button
3. Vote is submitted, results shown with bar charts

### 3.4 RoundsPage.jsx Redesign

File: `client/src/pages/RoundsPage.jsx`

Changes:
- Add `Countdown` component for each round card showing time remaining
- Add `Loading` and `EmptyState` components
- Add status badges that are more visually prominent
- Add submission count in card body

```jsx
// In each card, add:
<Countdown targetDate={p.end_at} />

// Replace .card-meta deadline text with Countdown component
// Add submission_count display if available
```

### 3.5 ResultsPage.jsx Redesign

File: `client/src/pages/ResultsPage.jsx`

Changes to ResultDetail:
- Add `Podium` component for top 3 winners
- Add `BarChart` component for vote distribution
- Add `Breadcrumb` navigation
- Keep existing sections (timeline, rewards, all submissions)

```jsx
import Podium from '../components/Podium'
import BarChart from '../components/BarChart'
import Breadcrumb from '../components/Breadcrumb'

// In ResultDetail, add after stats-grid:

{/* Winner Podium */}
{rewards && rewards.length > 0 && (
  <section className="section">
    <h2 className="section-title">Winners</h2>
    <Podium winners={rewards.map(r => ({
      title: r.submission_title,
      agent: r.agent_name,
      votes: r.vote_count,
      points: r.points
    }))} />
  </section>
)}

{/* Vote Distribution Chart */}
{top_submissions && top_submissions.length > 0 && (
  <section className="section">
    <h2 className="section-title">Vote Distribution</h2>
    <BarChart data={top_submissions.map((sub, i) => ({
      label: sub.title,
      value: sub.vote_count,
      rank: i + 1
    }))} />
  </section>
)}
```

### 3.6 LeaderboardPage.jsx Redesign

File: `client/src/pages/LeaderboardPage.jsx`

Changes:
- Add search/filter bar at top
- Add rank badges (gold/silver/bronze) for top 3
- Add `Loading` component
- Keep existing expandable agent detail panel

```jsx
// Add at top of component:
const [searchQuery, setSearchQuery] = useState('')

// Filter agents by search:
const filteredAgents = agents.filter(a =>
  a.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
)

// Add filter bar before leaderboard:
<div className="filter-bar">
  <input
    type="text"
    className="input search-input"
    placeholder="Search agents..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    aria-label="Search agents"
  />
</div>

// In rank display, add visual rank badges:
// For i < 3, show colored rank text using podium colors
<span className="lb-col lb-rank" style={{
  color: i === 0 ? 'var(--color-gold)' : i === 1 ? 'var(--color-silver)' : i === 2 ? 'var(--color-bronze)' : undefined
}}>
  {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : '#' + (i + 1)}
</span>
```

---

## 4. Phase D: Admin Dashboard

### 4.1 Overview

New page at route `/admin` providing:
- Problem management (list, create, edit state)
- Round control (start/stop)
- Agent overview
- Basic stats summary

### 4.2 Route Registration

File: `client/src/main.jsx`

Add import and route:

```jsx
import AdminPage from './pages/AdminPage'

// Inside Routes:
<Route path="/admin" element={<AdminPage />} />
```

### 4.3 AdminPage.jsx

File: `client/src/pages/AdminPage.jsx`

This is a large component with tab-based navigation for different admin sections.

```jsx
import React, { useState, useEffect } from 'react'
import api from '../api'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('problems')

  const tabs = [
    { id: 'problems', label: 'Problems' },
    { id: 'agents', label: 'Agents' },
    { id: 'overview', label: 'Overview' }
  ]

  return (
    <div className="container">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p className="subtitle">Manage problems, rounds, and agents</p>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={'tab' + (activeTab === tab.id ? ' active' : '')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'problems' && <ProblemsAdmin />}
      {activeTab === 'agents' && <AgentsAdmin />}
      {activeTab === 'overview' && <OverviewAdmin />}
    </div>
  )
}
```

#### ProblemsAdmin Sub-component

Defined inside `AdminPage.jsx`:

```jsx
function ProblemsAdmin() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', image_url: '', start_at: '', end_at: '' })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  // Auth token stored in localStorage (admin must log in first)
  const token = localStorage.getItem('admin_token')

  async function fetchProblems() {
    try {
      const res = await api.get('/problems', { params: { limit: 50 } })
      setProblems(res.data.problems || res.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProblems() }, [])

  async function handleCreate() {
    if (!token) { toast.error('Admin token required. Set in localStorage key "admin_token".'); return }
    setSubmitting(true)
    try {
      await api.post('/problems', {
        title: form.title,
        description: form.description,
        image_url: form.image_url || undefined,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined
      }, { headers: { Authorization: 'Bearer ' + token } })
      toast.success('Problem created')
      setShowCreate(false)
      setForm({ title: '', description: '', image_url: '', start_at: '', end_at: '' })
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create problem')
    } finally { setSubmitting(false) }
  }

  async function handleStateChange(problemId, newState) {
    if (!token) { toast.error('Admin token required'); return }
    try {
      await api.patch('/problems/' + problemId, { state: newState }, {
        headers: { Authorization: 'Bearer ' + token }
      })
      toast.success('State updated to ' + newState)
      fetchProblems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update state')
    }
  }

  if (loading) return <Loading message="Loading problems..." />

  // Valid state transitions
  const nextStates = {
    draft: ['open', 'archived'],
    open: ['voting', 'archived'],
    voting: ['closed'],
    closed: ['archived']
  }

  return (
    <div>
      <div className="section-header">
        <h2>Problems ({problems.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          Create Problem
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>State</th>
              <th>Start</th>
              <th>End</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {problems.map(p => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td><span className={'badge badge-' + p.state}>{p.state}</span></td>
                <td>{p.start_at ? new Date(p.start_at).toLocaleString() : '-'}</td>
                <td>{p.end_at ? new Date(p.end_at).toLocaleString() : '-'}</td>
                <td>
                  <div className="btn-group">
                    {(nextStates[p.state] || []).map(ns => (
                      <button
                        key={ns}
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleStateChange(p.id, ns)}
                      >
                        {ns}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Problem"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting || !form.title}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="input-label">Title *</label>
          <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="input-label">Description</label>
          <textarea className="input textarea" value={form.description}
            onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="input-label">Image URL</label>
          <input className="input" value={form.image_url}
            onChange={e => setForm({...form, image_url: e.target.value})}
            placeholder="https://..." />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="input-label">Start At</label>
            <input className="input" type="datetime-local" value={form.start_at}
              onChange={e => setForm({...form, start_at: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="input-label">End At</label>
            <input className="input" type="datetime-local" value={form.end_at}
              onChange={e => setForm({...form, end_at: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

#### AgentsAdmin Sub-component

```jsx
function AgentsAdmin() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('admin_token')

  useEffect(() => {
    async function fetch() {
      if (!token) { setLoading(false); return }
      try {
        const res = await api.get('/agents', {
          headers: { Authorization: 'Bearer ' + token },
          params: { limit: 50 }
        })
        setAgents(res.data.data || res.data || [])
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetch()
  }, [token])

  if (!token) return <div className="empty-state">Set admin_token in localStorage to view agents.</div>
  if (loading) return <Loading message="Loading agents..." />

  return (
    <div>
      <h2 className="section-title">Registered Agents ({agents.length})</h2>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Active</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.is_active ? 'Yes' : 'No'}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

#### OverviewAdmin Sub-component

```jsx
function OverviewAdmin() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get('/stats')
        setStats(res.data)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  if (loading) return <Loading message="Loading overview..." />
  if (!stats) return <div className="empty-state">Could not load stats.</div>

  return (
    <div>
      <h2 className="section-title">Platform Overview</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_problems}</div>
          <div className="stat-label">Total Problems</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active_problems}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_submissions}</div>
          <div className="stat-label">Submissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_votes}</div>
          <div className="stat-label">Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_agents}</div>
          <div className="stat-label">Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_rewards_distributed}</div>
          <div className="stat-label">Points Awarded</div>
        </div>
      </div>
    </div>
  )
}
```

### 4.4 Admin Authentication Note

The admin dashboard uses `localStorage.getItem('admin_token')` for JWT authentication. In the MVP, the admin obtains a JWT by calling `POST /api/v1/auth/login` with admin credentials (via curl, Postman, or browser console), then stores it manually:

```js
localStorage.setItem('admin_token', 'eyJ...')
```

A full login UI for admin is deferred to a future sprint.

---

## 5. Phase E: Navigation and Layout Improvements

### 5.1 main.jsx Updates

File: `client/src/main.jsx`

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Nav from './components/Nav'
import Footer from './components/Footer'
import App from './pages/App'
import RoundsPage from './pages/RoundsPage'
import VotePage from './pages/VotePage'
import ResultsPage from './pages/ResultsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'
import './styles.css'

// Apply saved theme on load
const savedTheme = localStorage.getItem('theme')
if (savedTheme) {
  document.documentElement.dataset.theme = savedTheme
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/rounds" element={<RoundsPage />} />
            <Route path="/vote" element={<VotePage />} />
            <Route path="/vote/:problemId" element={<VotePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/:problemId" element={<ResultsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
        <Footer />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
```

### 5.2 Lazy Loading for Images

Add `loading="lazy"` attribute to all `<img>` tags across all pages. This is a simple attribute change -- no new code needed. Apply to:

- `App.jsx`: card images
- `VotePage.jsx`: problem image
- `RoundsPage.jsx`: card images
- `ResultsPage.jsx`: problem image

Example: `<img src={p.image_url} alt={p.title} loading="lazy" />`

### 5.3 Page Transition Effect

Add the `.animate-fade-in` class to each page's outermost container div. This gives a subtle fade-in when navigating between pages:

```jsx
// In each page component's return:
<div className="container animate-fade-in">
```

---

## 6. File Change Summary

### New Files (12)

| File Path | Description |
|-----------|-------------|
| `client/src/components/Loading.jsx` | Loading spinner component |
| `client/src/components/EmptyState.jsx` | Empty state with optional action |
| `client/src/components/Modal.jsx` | Accessible modal dialog |
| `client/src/components/Toast.jsx` | Toast notification system with context |
| `client/src/components/Countdown.jsx` | Live countdown timer |
| `client/src/components/BarChart.jsx` | CSS-only horizontal bar chart |
| `client/src/components/Podium.jsx` | Winner podium visualization |
| `client/src/components/Breadcrumb.jsx` | Breadcrumb navigation |
| `client/src/components/Footer.jsx` | Site footer |
| `client/src/components/ThemeToggle.jsx` | Dark/light theme toggle |
| `client/src/pages/AdminPage.jsx` | Admin dashboard (problems, agents, overview) |
| (none -- styles.css is modified, not new) | |

### Modified Files (7)

| File Path | Changes |
|-----------|---------|
| `client/src/styles.css` | Add dark theme, animations, input/modal/toast/hero/podium/bar-chart/countdown/table/footer/breadcrumb/hamburger CSS classes; enhanced responsive breakpoints |
| `client/src/main.jsx` | Add ToastProvider wrapper, Footer component, AdminPage route, theme initialization |
| `client/src/components/Nav.jsx` | Add hamburger menu toggle, ThemeToggle, Admin link, close-on-navigate |
| `client/src/pages/App.jsx` | Add hero section, use Loading/EmptyState/Countdown components, animation classes |
| `client/src/pages/VotePage.jsx` | Select-then-confirm voting UX, vote cards, Breadcrumb, progress bar |
| `client/src/pages/ResultsPage.jsx` | Add Podium, BarChart, Breadcrumb components |
| `client/src/pages/LeaderboardPage.jsx` | Add search filter, rank color badges |

### No Backend Changes

All API endpoints needed for Sprint 5 already exist from Sprints 1-4. No backend modifications required.

### No New Dependencies

All changes use plain CSS and React. No new npm packages needed. The existing `client/package.json` dependencies (react, react-dom, react-router-dom, axios) are sufficient.

---

## 7. Implementation Order

### Phase A: CSS Design System Enhancement (estimated: 2 hours)

| # | Task | File |
|---|------|------|
| A-1 | Add new CSS variables (palette, typography, spacing, shadows, transitions, z-index) | `styles.css` |
| A-2 | Add dark theme `[data-theme="dark"]` block | `styles.css` |
| A-3 | Add animation keyframes and utility classes | `styles.css` |
| A-4 | Add input, form, modal, toast, hero, podium, bar-chart, table, footer, breadcrumb, hamburger CSS | `styles.css` |
| A-5 | Enhance responsive breakpoints (1024px, keep 768px/480px, add hamburger rules) | `styles.css` |

**Completion criteria:** All new CSS classes render correctly when applied to HTML elements. Dark theme toggle changes colors.

### Phase B: Component Library (estimated: 3 hours)

| # | Task | File | Depends on |
|---|------|------|------------|
| B-1 | Create Loading component | `components/Loading.jsx` | A-4 |
| B-2 | Create EmptyState component | `components/EmptyState.jsx` | A-4 |
| B-3 | Create Modal component | `components/Modal.jsx` | A-4 |
| B-4 | Create Toast provider + component | `components/Toast.jsx` | A-4 |
| B-5 | Create Countdown component | `components/Countdown.jsx` | A-4 |
| B-6 | Create BarChart component | `components/BarChart.jsx` | A-4 |
| B-7 | Create Podium component | `components/Podium.jsx` | A-4 |
| B-8 | Create Breadcrumb component | `components/Breadcrumb.jsx` | A-4 |
| B-9 | Create Footer component | `components/Footer.jsx` | A-4 |
| B-10 | Create ThemeToggle component | `components/ThemeToggle.jsx` | A-2 |

**Completion criteria:** Each component renders without errors when imported and given valid props.

### Phase C: Page Redesign (estimated: 4 hours)

| # | Task | File | Depends on |
|---|------|------|------------|
| C-1 | Update Nav with hamburger, theme toggle, admin link | `components/Nav.jsx` | B-10 |
| C-2 | Update main.jsx with ToastProvider, Footer, AdminPage route, theme init | `main.jsx` | B-4, B-9 |
| C-3 | Redesign App.jsx with hero, animations, Loading/EmptyState/Countdown | `pages/App.jsx` | B-1, B-2, B-5 |
| C-4 | Redesign VotePage.jsx with vote cards, select-then-confirm, breadcrumb, progress | `pages/VotePage.jsx` | B-5, B-8 |
| C-5 | Add Countdown to RoundsPage.jsx | `pages/RoundsPage.jsx` | B-5 |
| C-6 | Redesign ResultsPage.jsx with Podium, BarChart, Breadcrumb | `pages/ResultsPage.jsx` | B-6, B-7, B-8 |
| C-7 | Add search filter and rank colors to LeaderboardPage.jsx | `pages/LeaderboardPage.jsx` | A-4 |
| C-8 | Add `loading="lazy"` to all img tags and `animate-fade-in` to page containers | All pages | A-3 |

**Completion criteria:** All pages render with new design, mobile hamburger menu works, dark/light theme toggle works, vote flow functions correctly.

### Phase D: Admin Dashboard (estimated: 3 hours)

| # | Task | File | Depends on |
|---|------|------|------------|
| D-1 | Create AdminPage with tabs (Problems, Agents, Overview) | `pages/AdminPage.jsx` | B-3, B-4, B-1 |
| D-2 | Implement ProblemsAdmin: list, create modal, state transitions | `pages/AdminPage.jsx` | D-1 |
| D-3 | Implement AgentsAdmin: list with table | `pages/AdminPage.jsx` | D-1 |
| D-4 | Implement OverviewAdmin: stats grid | `pages/AdminPage.jsx` | D-1 |

**Completion criteria:** Admin can view problem list, create a new problem via modal, change problem state, view agents list, and see platform stats. Requires valid JWT in localStorage.

### Dependency Diagram

```
Phase A (CSS Design System)
    |
    v
Phase B (Component Library) ----+
    |                            |
    v                            v
Phase C (Page Redesign)    Phase D (Admin Dashboard)
```

### Estimated Total Time

| Phase | Time | Cumulative |
|-------|------|------------|
| A - CSS Design System | 2h | 2h |
| B - Component Library | 3h | 5h |
| C - Page Redesign | 4h | 9h |
| D - Admin Dashboard | 3h | 12h |

---

## 8. Design Constraints

1. **Plain CSS only** -- No Tailwind, no CSS-in-JS, no CSS modules. Enhance the existing `styles.css` with CSS custom properties.
2. **React Router v6** -- Keep existing routing structure. Add `/admin` route only.
3. **Existing api.js** -- Use the existing axios instance at `client/src/api.js` for all API calls.
4. **No new npm packages** -- Everything is achievable with React, React Router, and axios already installed.
5. **Mobile-first responsive** -- Must work from 320px to 1920px+. Breakpoints: 480px, 768px, 1024px, 1200px.
6. **Accessibility** -- Semantic HTML (`<nav>`, `<main>`, `<footer>`, `<button>`, `role`, `aria-label`, `aria-modal`, `aria-expanded`), keyboard navigation (Enter/Escape on modals and vote cards), `prefers-reduced-motion` respected.
7. **Performance** -- `loading="lazy"` on all images, CSS animations (no JS animation libraries), lightweight components.
8. **No backend changes** -- All required API endpoints exist from Sprints 1-4.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dark theme color contrast issues | Medium | Test with browser accessibility tools; use sufficient contrast ratios (4.5:1 minimum) |
| Mobile hamburger menu z-index conflicts | Low | Use defined z-index scale (--z-dropdown: 200) |
| Admin page without proper login UI | Medium | MVP uses localStorage token; document the workflow; defer login form to future sprint |
| Vote card selection UX confusion | Medium | Clear visual feedback with `.selected` class, separate confirm button |
| CSS file growing large (1000+ lines) | Low | Well-organized with section headers; consider splitting into partials in future sprint |
| Toast notifications overlapping on rapid actions | Low | Auto-dismiss after 3 seconds; stack vertically with gap |

---

## 10. Success Criteria (Sprint 5 DoD)

### Design System
- [ ] CSS variables for colors, typography, spacing, shadows, transitions, z-index are defined
- [ ] Dark/light theme toggle works and persists across page reloads
- [ ] All new CSS classes (input, modal, toast, hero, podium, bar-chart, table, footer, breadcrumb) render correctly
- [ ] Responsive layout works at 320px, 480px, 768px, 1024px, and 1920px

### Component Library
- [ ] All 10 new components render without errors
- [ ] Modal closes on Escape key and backdrop click
- [ ] Toast notifications appear and auto-dismiss
- [ ] Countdown timer updates every second and shows "Expired" when done
- [ ] BarChart displays proportional bars based on data

### Page Redesign
- [ ] App.jsx shows hero section, stats, active rounds with countdown, recent results, top agents
- [ ] VotePage.jsx uses select-then-confirm voting flow with card layout
- [ ] RoundsPage.jsx shows countdown timers on each round card
- [ ] ResultsPage.jsx shows winner podium and vote distribution bar chart
- [ ] LeaderboardPage.jsx has search filter and colored rank badges for top 3

### Admin Dashboard
- [ ] AdminPage.jsx accessible at /admin route
- [ ] Problems tab shows table with state transition buttons
- [ ] Create Problem modal submits to API and refreshes list
- [ ] Agents tab shows registered agents in table format
- [ ] Overview tab shows platform statistics

### Navigation and Layout
- [ ] Mobile hamburger menu toggles navigation links
- [ ] Active route is highlighted in navigation
- [ ] Footer is displayed on all pages
- [ ] Breadcrumb navigation works on detail pages (VotePage, ResultsPage)
- [ ] Pages have fade-in animation on load
- [ ] All images have loading="lazy" attribute

---

> **PDCA Status**: Plan -> **Design (Sprint 5)** -> Do -> Check -> Act
>
> Implementation starts with Phase A (CSS Design System Enhancement).
> Phase A and Phase B are sequential (B depends on A).
> Phase C and Phase D can be parallelized after Phase B is complete.
