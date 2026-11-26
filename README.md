# HireRefugee — Verified Skills Passport (Kenya)

A lightweight hackathon prototype built with **HTML5**, **CSS3**, **Vanilla JavaScript**, and **JSON Server** (with a `localStorage` fetch mock for zero-backend static hosting). Designed around **ILO Mini-Hackathon** goals and **UN SDGs 4, 8, 10, 16, and 17**, HireRefugee helps refugees in Kenya prove their skills—even when formal certificates or documents were lost during displacement—and connects them with inclusive employers.

---

## Project Structure

```text
HireRefugee/
├── index.html      # Application UI (Landing, Jobs, Kenya Guide, Auth, 4 Dashboards, Modals)
├── styles.css      # Core layout, navy/teal/white theme, cards, forms, tables, and responsive rules
├── extra.css       # Tabs, skill-test modal, apply modal, badges, checklist, and bridging callouts
├── mock-api.js     # Intercepts localhost:3000 fetch calls using localStorage + db.json fallback
├── app.js          # Auth, skill matching, micro-assessments, verifications, and role dashboards
├── db.json         # Sample seed data (users, jobs, credentials, support requests, applications)
└── README.md       # Project overview and setup instructions