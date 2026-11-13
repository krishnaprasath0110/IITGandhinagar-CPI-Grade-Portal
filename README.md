# IIT Gandhinagar — Cohort 2 CPI Admin Panel

A React admin panel for the Cohort 2 CPI model: **Student Overview**, **Class Overview**, and
**Settings**. Every grade, credit and CPI figure is computed in the browser by the CPI engine from
the real Week 0–3 marks. Only Build 1 (subject M1, 3 of 33 credits) is graded so far; the engine is
already built for Exam 1 through the Capstone, including the Module 2 regrade (Exam 1 + Build 2 on
170 marks).

## Run it locally (recommended)

Requires **Node.js 18+**.

```bash
npm install     # first time only
npm run dev     # starts the dev server at http://localhost:3000
```

Open the URL it prints. Edits reload instantly.

### Build for production
```bash
npm run build     # outputs static files to dist/
npm run preview   # serves the built dist/ locally to check it
```
Deploy the contents of `dist/` to any static host (Netlify, Vercel, GitHub Pages, S3, nginx…).
A prebuilt `dist/` is already included in this zip.

## No-install option
`standalone.html` is the whole app in a single file (React is loaded from a CDN, so it needs an
internet connection). Double-click it, or open it in a browser. Good for a quick look; use the Vite
project above for development.

## Project layout
```
index.html          Vite entry (loads /src/main.jsx, pulls in the Gelasio web font)
vite.config.js      Vite + @vitejs/plugin-react
src/
  main.jsx          mounts <App/> into #root
  App.jsx           all UI components + the three tabs (Student, Class, Settings)
  model.js          the CPI engine — events, grade scale, and every calculation (no React)
  data.js           one row per learner (STUDENTS)
  styles.css        all styling (light + dark, responsive)
standalone.html     single-file build, no npm needed (CDN React)
dist/               prebuilt production output
```

## Where things live
- **Change the grading rules** (events, credits, marks, the 11-point scale, Module 2): `src/model.js`.
- **Change the roster / marks**: `src/data.js`. Each learner is
  `{ roll, name, email, mock, gd, mini, mock100, proj100 }` where `mock` is out of 30, `gd` out of 30,
  `mini` out of 40 (the `*100` fields are the raw LMS values, kept for reference).
- **Adjust the look**: `src/styles.css`.
- The **7.00 / 6.00 lines, comfort buffer and trend band** are editable live in the Settings tab;
  their defaults are `DEFAULT_CFG` in `src/model.js`.

## Adding later events (Exam 1, Build 2, …)
The engine already knows the full 9-event structure. When marks arrive, extend each learner in
`src/data.js` with the new fields (e.g. `exam1`, and Build 2's `build2mock/build2gd/build2mini`) and
add the matching cases in `eventResult` / `module2` in `src/model.js`. The cards, tables, beeswarm
and trends fill in automatically.

## Notes on the data
Marks come from the Cohort 2 LMS exports (Weeks 0–3). Group discussion is from the Week 2 export
(/30); mock interview and project presentation are from the Week 3 export, converted to the model's
scale (mock → /30, project → mini-project /40) keeping each percentage. The dummy account
“Student 14” is excluded, leaving 39 students (38 graded; one is missing a mock-interview mark).
