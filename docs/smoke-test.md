# Smoke test (manual)

Check these on **mobile** (e.g. 390px or real device) and **desktop** (e.g. 1280px). Use Chrome DevTools device toolbar for viewports.

## Auth & onboarding

1. **Login** – Open `/login`, enter credentials, submit. Redirects to dashboard (or onboarding).
2. **Register** – Open `/register`, create account. Redirects to onboarding or dashboard.
3. **Logout** – User menu → Sign out. Redirects to home.

## App shell & nav

4. **Sidebar (desktop)** – All nav links work (Dashboard, Today, Calendar, Season, Diary, Progress, Coach, Simulator, Settings).
5. **Mobile menu** – Hamburger opens drawer; links work; close and reopen.
6. **Sticky header** – Scroll down; header stays visible. No content hidden under it.
7. **Legal footer (sidebar)** – Privacy, Terms, Cookies, Contact, Data deletion open correct pages.

## Dashboard

8. **Dashboard load** – No horizontal scroll. KPI cards and sections visible.
9. **Empty state** – If no data, friendly empty state and CTA (e.g. Connect data / Do check-in) where applicable.

## Calendar

10. **Calendar scroll** – Month grid and list scroll vertically without “stuck” scroll. No accidental drag.
11. **Calendar nav** – Prev/Next month, Today. Side panel (Day/Week/Month) switches and shows content.
12. **Add workout** – Quick add or new workout; save. Appears in calendar.

## AI Coach

13. **Coach chat** – Open `/coach`. Messages load; input visible; send message.
14. **Quick actions** – Chips (Generate today, Add swim, Plan week, etc.) insert text or send.
15. **Add to calendar** – If Coach suggests a plan, “Add to calendar” (or similar) works.

## Settings

16. **Settings tabs** – Profile, Zones, AI, Billing switch without error. Forms render.
17. **Billing tab** – Shows plan and Manage subscription (if Pro). No layout break.

## Legal & consent

18. **Legal pages** – `/privacy`, `/terms`, `/cookies`, `/contact`, `/data-deletion` load and show content.
19. **Cookie banner** – On first visit, banner appears. Accept or Reject; reload — banner does not reappear. Manage opens modal.

## PWA & install

20. **Install prompt** – On supported browser (Chrome/Edge), Install app or Add to Home Screen available. After install, icon and name (AdaptivAI) correct. Open from home screen; app loads.

---

**Viewports to test**: 390px (mobile), 768px (tablet), 1280px (desktop).  
**Browsers**: Chrome (desktop + mobile), Safari iOS if possible.
