// HireRefugee: Verified Skills Passport (ILO Mini-Hackathon)
const API_URL = "http://localhost:3000"; // handled by mock-api.js on hosted version

let currentUser = JSON.parse(localStorage.getItem("hireRefugeeUser")) || null;
let allJobs = [];
let currentTest = null;
let pendingApplyJobId = null;

/* ---------- Helpers ---------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().split("T")[0];
const $ = (id) => document.getElementById(id);

async function api(path, method = "GET", body) {
  const opts = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, opts);
  return res.json();
}

const badge = (status) =>
  `<span class="status status-${esc(String(status).toLowerCase().replace(/\s+/g, "-"))}">${esc(status)}</span>`;

/* ---------- Skills: normalisation, tests, matching ---------- */
const ALIASES = {
  excel: "microsoft excel", "ms excel": "microsoft excel", spreadsheets: "microsoft excel",
  "customer support": "customer service", "communication skills": "communication"
};
const normSkill = (s) => { const k = s.toLowerCase().trim(); return ALIASES[k] || k; };
const parseSkills = (str) => [...new Set(String(str || "").split(",").map(normSkill).filter(Boolean))];

// [question, correct answer, wrong, wrong, wrong]
const SKILL_TESTS = {
  "Microsoft Excel": { covers: ["microsoft excel"], questions: [
    ["Which function adds up a range of cells?", "SUM", "ADD", "TOTAL", "PLUS"],
    ["Every Excel formula starts with which symbol?", "=", "#", "@", "$"],
    ["What does VLOOKUP do?", "Finds a value in the first column and returns a value from the same row", "Sorts a column alphabetically", "Removes duplicate rows", "Draws a chart"],
    ["What does the reference $A$1 mean?", "An absolute reference that does not change when copied", "A reference that changes when copied", "A reference to another file", "An error"]
  ]},
  "English": { covers: ["english"], questions: [
    ["Choose the correct sentence.", "She has worked here for three years.", "She have worked here for three years.", "She working here since three years.", "She work here for three year."],
    ["Please ___ me the report by Friday.", "send", "sent", "sending", "sends"],
    ["What does 'deadline' mean?", "The time by which work must be finished", "The start of a project", "A type of meeting", "A salary payment"],
    ["Which is the most professional way to start an email?", "Dear Ms. Otieno,", "Hey you,", "Yo,", "Listen,"]
  ]},
  "Customer Service": { covers: ["customer service"], questions: [
    ["A customer is angry. What should you do first?", "Listen calmly and acknowledge the problem", "Argue to prove them wrong", "Ignore them", "End the call"],
    ["You do not know the answer to a question. What is best?", "Say you will find out and follow up", "Guess an answer", "Tell them to go away", "Make something up"],
    ["What is 'first-contact resolution'?", "Solving the issue in the first interaction", "Answering within one hour", "Greeting the customer", "Sending a survey"],
    ["How can a business learn if customers are happy?", "Ask for feedback or run a short survey", "Assume they are", "Count the employees", "Check the weather"]
  ]},
  "Data Entry": { covers: ["data entry"], questions: [
    ["What is the most important quality in data entry?", "Accuracy", "Speed only", "Creativity", "Loud typing"],
    ["You typed 'Nairbi' instead of 'Nairobi'. What do you do?", "Correct it and check nearby entries", "Leave it", "Delete the whole file", "Tell no one"],
    ["Best way to protect clients' personal data?", "Password-protected files with limited access", "Share in a public group", "Write it on sticky notes", "Post it online"],
    ["You find duplicate records. What now?", "Check them, then merge or remove the duplicates", "Ignore them", "Delete all records", "Add more duplicates"]
  ]},
  "Web Development": { covers: ["web development", "html", "css", "javascript"], questions: [
    ["What does HTML stand for?", "HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink Text Machine Language"],
    ["What is CSS used for?", "Styling web pages", "Storing databases", "Sending email", "Compiling code"],
    ["Which tag creates a link?", "<a>", "<link-me>", "<url>", "<p>"],
    ["Which JavaScript call selects an element by its id?", "document.getElementById('x')", "document.find('x')", "window.select('x')", "html.get('x')"]
  ]},
  "Communication": { covers: ["communication"], questions: [
    ["What does active listening mean?", "Fully focusing, then confirming what you understood", "Waiting for your turn to talk", "Looking at your phone", "Interrupting with advice"],
    ["Someone has limited English. How do you explain a task?", "Use simple words and check they understood", "Talk faster", "Use technical jargon", "Skip the explanation"],
    ["Best channel for an urgent problem?", "A phone call or direct message", "An email to everyone next week", "A notice on the wall", "Wait until it is fixed"],
    ["Good feedback is...", "Specific, respectful and focused on the work", "Vague and personal", "Public embarrassment", "Only negative"]
  ]}
};
const PASS_MARK = 3;

function verifiedSet(u) {
  const s = new Set();
  (u.verifiedSkills || []).forEach((v) => {
    const t = SKILL_TESTS[v.skill];
    (t ? t.covers : [normSkill(v.skill)]).forEach((c) => s.add(c));
  });
  return s;
}

function matchInfo(user, job) {
  const jobSk = parseSkills(job.requiredSkills);
  const userSk = new Set(parseSkills(user.skills));
  const vset = verifiedSet(user);
  const matched = jobSk.filter((s) => userSk.has(s));
  return {
    pct: jobSk.length ? Math.round((matched.length / jobSk.length) * 100) : 0,
    matched,
    verified: matched.filter((s) => vset.has(s)),
    missing: jobSk.filter((s) => !userSk.has(s))
  };
}

/* ---------- Work readiness ---------- */
const CHECKLIST = [
  { key: "refugeeId", title: "Valid Refugee ID or proof of registration", how: "Issued by the Department of Refugee Services (DRS) or UNHCR partners. Keep a copy; you will need it for every step below." },
  { key: "kraPin", title: "KRA PIN (tax number)", how: "Register on the KRA iTax portal using your ID. Employers need it for payroll. Ask a partner for help if you do not have a phone or internet." },
  { key: "bank", title: "Bank or M-Pesa account for salary", how: "Register an M-Pesa line at a Safaricom shop, or open a bank account. Requirements for refugee IDs differ by provider, so confirm before you go." },
  { key: "permit", title: "Work permit (Class M) arranged", how: "Your employer applies through the Immigration eFNS portal on DRS recommendation. Share your Refugee ID and ask the employer to confirm current requirements." },
  { key: "contract", title: "Signed employment contract", how: "Read it carefully. It should state your pay, hours and duties. Keep a signed copy." }
];
const readiness = (u) => {
  const c = u.checklist || {};
  return Math.round((CHECKLIST.filter((i) => c[i.key]).length / CHECKLIST.length) * 100);
};
const isWorkReady = (u) => readiness(u) >= 80;

/* ---------- UI core ---------- */
function showSection(name) {
  document.querySelectorAll(".view-section").forEach((s) => s.classList.add("hidden"));
  const t = $(`section-${name}`);
  if (t) t.classList.remove("hidden");
  window.scrollTo(0, 0);
  if (name === "landing") loadLandingStats();
  if (name === "jobs") loadJobs();
  if (name === "refugee-dash") loadRefugeeDashboard();
  if (name === "employer-dash") loadEmployerDashboard();
  if (name === "verifier-dash") loadVerifierDashboard();
  if (name === "admin-dash") loadAdminDashboard();
}

function showTab(name) {
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.add("hidden"));
  $(`tab-${name}`).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function updateNavigation() {
  const nav = $("auth-nav");
  if (!currentUser) {
    nav.innerHTML = `<button class="btn btn-outline" onclick="showSection('auth')">Login / Register</button>`;
    return;
  }
  nav.innerHTML = `
    <button class="btn btn-primary" onclick="routeToDashboard()">My dashboard</button>
    <button class="btn btn-outline" onclick="logout()">Logout (${esc(currentUser.name.split(" ")[0])})</button>`;
}

function routeToDashboard() {
  if (!currentUser) return showSection("auth");
  const map = { refugee: "refugee-dash", employer: "employer-dash", verifier: "verifier-dash", admin: "admin-dash" };
  showSection(map[currentUser.role] || "landing");
}

function logout() {
  localStorage.removeItem("hireRefugeeUser");
  currentUser = null;
  updateNavigation();
  showToast("Logged out.");
  showSection("landing");
}

function toggleRegisterFields() {
  const role = $("reg-role").value;
  $("reg-name-label").textContent = role === "refugee" ? "Full name" : "Company / organization name";
  $("refugee-reg-fields").classList.toggle("hidden", role !== "refugee");
  $("employer-reg-fields").classList.toggle("hidden", role === "refugee");
}

/* ---------- Auth ---------- */
async function doLogin(email, password) {
  try {
    const users = await api(`/users?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
    if (users.length === 0) return showToast("Invalid email or password.");
    currentUser = users[0];
    localStorage.setItem("hireRefugeeUser", JSON.stringify(currentUser));
    updateNavigation();
    showToast(`Welcome, ${currentUser.name}!`);
    routeToDashboard();
  } catch (err) {
    showToast("Cannot reach the data service. If running locally, start JSON Server on port 3000.");
  }
}
const demoLogin = (email) => doLogin(email, "password123");

$("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin($("login-email").value.trim(), $("login-password").value.trim());
});

$("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = $("reg-role").value;
  const name = $("reg-name").value.trim();
  const email = $("reg-email").value.trim();
  const existing = await api(`/users?email=${encodeURIComponent(email)}`);
  if (existing.length > 0) return showToast("An account with this email already exists.");

  const newUser = {
    name,
    email,
    password: $("reg-password").value.trim(),
    role,
    location: $("reg-location").value.trim()
  };
  if (role === "refugee") {
    Object.assign(newUser, {
      skills: $("reg-skills").value.trim(),
      education: "",
      experience: "",
      cvName: "Not uploaded",
      docStatus: "Refugee ID Holder",
      verifiedSkills: [],
      checklist: { refugeeId: false, kraPin: false, bank: false, permit: false, contract: false }
    });
  } else {
    Object.assign(newUser, {
      companyName: name,
      industry: $("reg-industry").value.trim()
    });
  }

  await api("/users", "POST", newUser);
  e.target.reset();
  $("login-email").value = email;
  $("login-password").focus();
  showToast("Account created! Please log in with your email and password.");
});

/* ---------- Landing stats ---------- */
async function loadLandingStats() {
  try {
    const [users, creds] = await Promise.all([api("/users"), api("/credentials")]);
    const refugees = users.filter((u) => u.role === "refugee");
    const skillsVerified = refugees.reduce((n, u) => n + (u.verifiedSkills || []).length, 0);
    $("landing-stats").innerHTML = `
      <div class="stat-box light"><h3>${refugees.length}</h3><p>Refugee talent profiles</p></div>
      <div class="stat-box light"><h3>${creds.filter((c) => c.status === "Verified").length}</h3><p>Credentials verified</p></div>
      <div class="stat-box light"><h3>${skillsVerified}</h3><p>Skills proven by test</p></div>
      <div class="stat-box light"><h3>${refugees.filter(isWorkReady).length}</h3><p>Work-ready candidates</p></div>`;
  } catch (e) { /* stats are optional */ }
}

/* ---------- Jobs ---------- */
async function loadJobs() {
  try {
    allJobs = await api("/jobs");
    if (currentUser && currentUser.role === "refugee") currentUser = await api(`/users/${currentUser.id}`);
    renderJobsList(allJobs);
  } catch (err) { console.error("Failed to load jobs:", err); }
}

function filterJobs() {
  const q = $("job-search-input").value.toLowerCase();
  renderJobsList(allJobs.filter((j) =>
    [j.title, j.location, j.requiredSkills, j.companyName].some((f) => String(f).toLowerCase().includes(q))));
}

function renderJobsList(jobs) {
  const box = $("jobs-list");
  if (jobs.length === 0) { box.innerHTML = `<p class="muted">No matching jobs found. Try a different word.</p>`; return; }
  const isRef = currentUser && currentUser.role === "refugee";
  box.innerHTML = jobs.map((job) => {
    const m = isRef ? matchInfo(currentUser, job) : null;
    const vset = isRef ? verifiedSet(currentUser) : new Set();
    const tags = job.requiredSkills.split(",").map((s) => {
      const v = vset.has(normSkill(s));
      return `<span class="tag ${v ? "verified" : ""}">${v ? "✓ " : ""}${esc(s.trim())}</span>`;
    }).join("");
    const action = isRef
      ? `<button class="btn btn-primary" onclick="applyToJob('${esc(job.id)}')">Apply now</button>`
      : `<button class="btn btn-secondary" onclick="showSection('auth')">Log in as a refugee to apply</button>`;
    return `
      <div class="card job-card">
        <div>
          <h3>${esc(job.title)}</h3>
          <p class="job-meta"><strong>${esc(job.companyName)}</strong> &bull; ${esc(job.location)} &bull; ${esc(job.type)}</p>
          <p class="job-meta">Pay: ${esc(job.salary || "Negotiable")}</p>
          ${m ? `<p style="margin-top:0.4rem;"><span class="match-badge">${m.pct}% match</span></p>` : ""}
          <p style="margin-top:0.6rem;">${esc(job.description)}</p>
          <div class="skill-tags">${tags}</div>
        </div>
        <div>${action}</div>
      </div>`;
  }).join("");
}

async function applyToJob(jobId) {
  if (!currentUser || currentUser.role !== "refugee") {
    return showToast("Please log in as a refugee to apply.");
  }
  const existing = await api(`/applications?jobId=${jobId}&refugeeId=${currentUser.id}`);
  if (existing.length > 0) {
    return showToast("You have already applied for this job.");
  }
  const job = allJobs.find((j) => String(j.id) === String(jobId));
  if (!job) return;

  pendingApplyJobId = job.id;
  $("apply-content").innerHTML = `
    <h3>Apply for ${esc(job.title)}</h3>
    <p class="job-meta"><strong>${esc(job.companyName)}</strong> &bull; ${esc(job.location)}</p>
    <p class="small-note" style="margin-top:0.6rem;">
      Applying as <strong>${esc(currentUser.name)}</strong> with CV: <strong>${esc(currentUser.cvName || "No CV uploaded")}</strong>.
    </p>
    <label for="apply-note">Short note to employer (optional)</label>
    <textarea id="apply-note" rows="3" placeholder="Why are you a strong fit for this role?"></textarea>
    <div class="row-actions">
      <button class="btn btn-primary" onclick="confirmApplyJob()">Confirm &amp; send application</button>
      <button class="btn btn-light" onclick="closeApplyModal()">Cancel</button>
    </div>`;
  $("apply-modal").classList.remove("hidden");
}

function closeApplyModal() {
  pendingApplyJobId = null;
  $("apply-modal").classList.add("hidden");
}

async function confirmApplyJob() {
  if (!pendingApplyJobId || !currentUser) return;
  const job = allJobs.find((j) => String(j.id) === String(pendingApplyJobId));
  if (!job) return closeApplyModal();

  const note = $("apply-note") ? $("apply-note").value.trim() : "";
  await api("/applications", "POST", {
    jobId: job.id,
    jobTitle: job.title,
    companyName: job.companyName,
    employerId: job.employerId,
    refugeeId: currentUser.id,
    refugeeName: currentUser.name,
    refugeeSkills: currentUser.skills || "Not specified",
    cvName: currentUser.cvName || "No CV uploaded",
    note,
    status: "Submitted",
    appliedDate: today()
  });

  closeApplyModal();
  showToast(`Application sent for ${job.title}.`);
  if (!$("section-refugee-dash").classList.contains("hidden")) {
    loadRefugeeDashboard();
  }
}

/* ======================================================
   REFUGEE DASHBOARD
   ====================================================== */
async function loadRefugeeDashboard() {
  if (!currentUser) return;
  const fresh = await api(`/users/${currentUser.id}`);
  if (!fresh.id) return logout();
  currentUser = fresh;
  localStorage.setItem("hireRefugeeUser", JSON.stringify(currentUser));

  $("refugee-welcome").textContent = `${currentUser.name} (${currentUser.email})`;
  $("prof-location").value = currentUser.location || "";
  $("prof-skills").value = currentUser.skills || "";
  $("prof-education").value = currentUser.education || "";
  $("prof-experience").value = currentUser.experience || "";
  $("prof-docStatus").value = currentUser.docStatus || "Refugee ID Holder";
  $("current-cv-name").textContent = currentUser.cvName || "None";

  allJobs = await api("/jobs");
  const creds = await api(`/credentials?refugeeId=${currentUser.id}`);

  $("passport-stats").innerHTML = `
    <div class="stat-box"><h3>${creds.filter((c) => c.status === "Verified").length}/${creds.length}</h3><p>Credentials verified</p></div>
    <div class="stat-box"><h3>${(currentUser.verifiedSkills || []).length}</h3><p>Verified skills</p></div>
    <div class="stat-box"><h3>${readiness(currentUser)}%</h3><p>Work readiness ${isWorkReady(currentUser) ? "(work-ready)" : ""}</p></div>`;

  renderCredentials(creds);
  renderSkillTests();
  renderChecklist();
  await renderSupport();
  renderSkillMatches();
  await renderMyApplications();
}

/* --- Credentials --- */
function renderCredentials(creds) {
  const box = $("credentials-list");
  if (creds.length === 0) {
    box.innerHTML = `<p class="muted">No credentials yet. Add one below, even if your papers are lost.</p>`;
  } else {
    box.innerHTML = creds.map((c) => `
      <div class="list-item">
        <strong>${esc(c.title)}</strong> ${badge(c.status)}<br/>
        <span class="job-meta">${esc(c.institution)} &bull; ${esc(c.type)} &bull; Evidence: ${esc(c.evidenceType)}</span>
        ${c.verifierNote ? `<div class="note-box">Verifier note: ${esc(c.verifierNote)}</div>` : ""}
      </div>`).join("");
  }
  const rejected = creds.filter((c) => c.status === "Rejected");
  $("bridging-box").innerHTML = rejected.length === 0 ? "" : `
    <div class="callout">
      <h4>Bridging pathway: ${esc(rejected[0].title)} was not recognised yet</h4>
      <ol>
        <li>Read the verifier note above and add the missing evidence.</li>
        <li>Prove the skill now: take the matching skill test.</li>
        <li>Ask KNQA (or CUE for university degrees) about recognition of foreign qualifications.</li>
        <li>If a bridging course or exam is needed, request a fee waiver under "Ask for support".</li>
      </ol>
    </div>`;
}

$("credential-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/credentials", "POST", {
    refugeeId: currentUser.id, refugeeName: currentUser.name,
    title: $("cred-title").value.trim(), institution: $("cred-institution").value.trim(),
    type: $("cred-type").value, evidenceType: $("cred-evidence-type").value,
    evidence: $("cred-evidence").value.trim(), status: "Pending",
    verifierNote: "", reviewedBy: "", reviewedDate: "", submittedDate: today()
  });
  e.target.reset();
  showToast("Credential submitted. A verifier will review it.");
  loadRefugeeDashboard();
});

/* --- Skill tests (safe data-attribute binding) --- */
function renderSkillTests() {
  const done = {};
  (currentUser.verifiedSkills || []).forEach((v) => (done[v.skill] = v));
  const container = $("skill-tests-list");
  container.innerHTML = Object.keys(SKILL_TESTS).map((skill) => {
    const v = done[skill];
    return `
      <div class="list-item" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
        <div>
          <strong>${esc(skill)}</strong><br/>
          ${v ? `<span class="verified-mark">✓ Verified</span> <span class="job-meta">${v.score}/${v.total} on ${esc(v.date)}</span>`
              : `<span class="job-meta">Not verified yet</span>`}
        </div>
        <button class="btn ${v ? "btn-light" : "btn-primary"} start-test-btn" data-skill="${esc(skill)}">${v ? "Retake" : "Take test"}</button>
      </div>`;
  }).join("");

  container.querySelectorAll(".start-test-btn").forEach((btn) => {
    btn.addEventListener("click", () => startTest(btn.dataset.skill));
  });
}

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function startTest(skill) {
  const t = SKILL_TESTS[skill];
  if (!t) return;
  currentTest = { skill, items: t.questions.map(([q, ans, ...wrong]) => ({ q, answer: ans, options: shuffle([ans, ...wrong]) })) };
  $("test-content").innerHTML = `
    <h3>${esc(skill)} test</h3>
    <p class="muted small-note">Answer all ${currentTest.items.length} questions. Pass mark: ${PASS_MARK}.</p>
    ${currentTest.items.map((it, i) => `
      <div class="question"><p>${i + 1}. ${esc(it.q)}</p>
        ${it.options.map((o, k) => `<label><input type="radio" name="q${i}" value="${k}" /> ${esc(o)}</label>`).join("")}
      </div>`).join("")}
    <div class="row-actions">
      <button class="btn btn-primary" onclick="submitTest()">Submit answers</button>
      <button class="btn btn-light" onclick="closeTest()">Cancel</button>
    </div>`;
  $("test-modal").classList.remove("hidden");
}

function closeTest() { $("test-modal").classList.add("hidden"); }

async function submitTest() {
  let score = 0;
  for (let i = 0; i < currentTest.items.length; i++) {
    const sel = document.querySelector(`input[name="q${i}"]:checked`);
    if (!sel) return showToast("Please answer every question.");
    if (currentTest.items[i].options[Number(sel.value)] === currentTest.items[i].answer) score++;
  }
  const total = currentTest.items.length;
  const passed = score >= PASS_MARK;
  if (passed) {
    const list = (currentUser.verifiedSkills || []).filter((v) => v.skill !== currentTest.skill);
    list.push({ skill: currentTest.skill, score, total, date: today() });
    currentUser = await api(`/users/${currentUser.id}`, "PATCH", { verifiedSkills: list });
    localStorage.setItem("hireRefugeeUser", JSON.stringify(currentUser));
  }
  $("test-content").innerHTML = `
    <h3 class="${passed ? "result-good" : "result-bad"}">${passed ? "Passed! Verified Skill badge earned" : "Not passed this time"}</h3>
    <p style="margin:0.6rem 0;">You scored <strong>${score}/${total}</strong> in ${esc(currentTest.skill)}.
    ${passed ? "This badge now shows on your profile and to employers." : "You can retake the test at any time."}</p>
    <button class="btn btn-primary" onclick="closeTest()">Close</button>`;
  loadRefugeeDashboard();
}

/* --- Support requests --- */
async function renderSupport() {
  const rows = await api(`/supportRequests?refugeeId=${currentUser.id}`);
  $("support-list").innerHTML = rows.length === 0 ? "" : rows.map((r) => `
    <div class="list-item"><strong>${esc(r.type)}</strong> ${badge(r.status)}<br/><span class="job-meta">${esc(r.note)}</span></div>`).join("");
}

$("support-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/supportRequests", "POST", {
    refugeeId: currentUser.id, refugeeName: currentUser.name, type: $("support-type").value,
    note: $("support-note").value.trim(), status: "Pending", date: today()
  });
  e.target.reset();
  showToast("Support request sent.");
  renderSupport();
});

/* --- Checklist --- */
function renderChecklist() {
  const pct = readiness(currentUser);
  const c = currentUser.checklist || {};
  $("readiness-bar").innerHTML = `
    <strong>${pct}% ready</strong> ${isWorkReady(currentUser) ? `<span class="status status-verified">Work-ready</span>` : ""}
    <div class="progress"><div style="width:${pct}%"></div></div>`;
  $("checklist").innerHTML = CHECKLIST.map((i) => `
    <div class="check-item">
      <label><input type="checkbox" ${c[i.key] ? "checked" : ""} onchange="toggleChecklist('${i.key}', this.checked)" /> ${esc(i.title)}</label>
      <details><summary>How to do this</summary><p style="margin-top:0.3rem;">${esc(i.how)}</p></details>
    </div>`).join("");
}

async function toggleChecklist(key, value) {
  const checklist = { ...(currentUser.checklist || {}), [key]: value };
  currentUser = await api(`/users/${currentUser.id}`, "PATCH", { checklist });
  localStorage.setItem("hireRefugeeUser", JSON.stringify(currentUser));
  renderChecklist();
  loadRefugeeDashboard();
}

/* --- Matches & applications --- */
function renderSkillMatches() {
  const box = $("matched-jobs-list");
  if (parseSkills(currentUser.skills).length === 0) {
    box.innerHTML = `<p class="muted">Add skills to your profile to see matches.</p>`;
    return;
  }
  const vset = verifiedSet(currentUser);
  const ranked = allJobs.map((j) => ({ job: j, m: matchInfo(currentUser, j) }))
    .filter((x) => x.m.pct > 0).sort((a, b) => b.m.pct - a.m.pct);
  if (ranked.length === 0) { box.innerHTML = `<p class="muted">No matches yet. Browse all jobs to explore roles.</p>`; return; }
  box.innerHTML = ranked.map(({ job, m }) => `
    <div class="list-item">
      <span class="match-badge">${m.pct}% match</span>
      <h4>${esc(job.title)} (${esc(job.companyName)})</h4>
      <p class="job-meta">${esc(job.location)} &bull; ${esc(job.type)} &bull; ${esc(job.salary)}</p>
      <div class="skill-tags">${m.matched.map((s) => `<span class="tag ${vset.has(s) ? "verified" : ""}">${vset.has(s) ? "✓ " : ""}${esc(s)}</span>`).join("")}</div>
      ${m.missing.length ? `<p class="job-meta">Skills to add: ${esc(m.missing.join(", "))}</p>` : ""}
      <button class="btn btn-primary" style="margin-top:0.4rem;" onclick="applyToJob('${esc(job.id)}')">Quick apply</button>
    </div>`).join("");
}

async function renderMyApplications() {
  const apps = await api(`/applications?refugeeId=${currentUser.id}`);
  $("refugee-applications-list").innerHTML = apps.length === 0
    ? `<p class="muted">You have not applied to any jobs yet.</p>`
    : apps.map((a) => `
      <div class="list-item"><strong>${esc(a.jobTitle)}</strong> at ${esc(a.companyName)}<br/>
      <span class="job-meta">Applied: ${esc(a.appliedDate)}</span> ${badge(a.status)}</div>`).join("");
}

$("refugee-profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = $("prof-cv-file").files;
  currentUser = await api(`/users/${currentUser.id}`, "PATCH", {
    location: $("prof-location").value.trim(), skills: $("prof-skills").value.trim(),
    education: $("prof-education").value.trim(), experience: $("prof-experience").value.trim(),
    docStatus: $("prof-docStatus").value, cvName: f.length > 0 ? f[0].name : currentUser.cvName
  });
  localStorage.setItem("hireRefugeeUser", JSON.stringify(currentUser));
  showToast("Profile updated.");
  loadRefugeeDashboard();
});

/* ======================================================
   EMPLOYER DASHBOARD
   ====================================================== */
async function loadEmployerDashboard() {
  if (!currentUser) return;
  $("employer-welcome").textContent = `Organization: ${currentUser.companyName || currentUser.name}`;

  const [fetchedAllJobs, apps, users, creds] = await Promise.all([
    api("/jobs"),
    api(`/applications?employerId=${currentUser.id}`),
    api("/users?role=refugee"),
    api("/credentials")
  ]);

  allJobs = fetchedAllJobs;
  const myJobs = allJobs.filter((j) => String(j.employerId) === String(currentUser.id));
  const jobsById = {};
  allJobs.forEach((j) => (jobsById[j.id] = j));

  $("employer-jobs-list").innerHTML = myJobs.length === 0
    ? `<p class="muted">You have not posted any jobs yet.</p>`
    : myJobs.map((j) => `<div class="list-item"><strong>${esc(j.title)}</strong> (${esc(j.location)}) &bull; ${esc(j.type)}<br/>
        <span class="job-meta">Skills: ${esc(j.requiredSkills)}</span></div>`).join("");

  const onlyVerified = $("filter-verified").checked;
  const onlyReady = $("filter-ready").checked;

  const enriched = apps.map((a) => {
    const u = users.find((x) => String(x.id) === String(a.refugeeId)) || {};
    const job = jobsById[a.jobId];
    const myCreds = creds.filter((c) => String(c.refugeeId) === String(a.refugeeId));
    return {
      a, u, myCreds,
      verifiedCreds: myCreds.filter((c) => c.status === "Verified"),
      ready: readiness(u), m: job && u.skills ? matchInfo(u, job) : { pct: 0, verified: [], matched: [] }
    };
  }).filter((x) => (!onlyVerified || x.verifiedCreds.length > 0 || (x.u.verifiedSkills || []).length > 0) && (!onlyReady || x.ready >= 80))
    .sort((x, y) => y.m.pct - x.m.pct);

  $("employer-applications-list").innerHTML = enriched.length === 0
    ? `<p class="muted">No candidates match these filters yet.</p>`
    : enriched.map(({ a, u, myCreds, verifiedCreds, ready, m }) => `
      <div class="list-item">
        <strong>${esc(a.refugeeName)}</strong> for <strong>${esc(a.jobTitle)}</strong> ${badge(a.status)}
        <div class="mini">
          <span>Match: <strong>${m.pct}%</strong></span>
          <span>Work readiness: <strong>${ready}%</strong> ${ready >= 80 ? "✓" : ""}</span>
          <span>Credentials verified: <strong>${verifiedCreds.length}/${myCreds.length}</strong></span>
        </div>
        <div class="progress small"><div style="width:${ready}%"></div></div>
        <div class="skill-tags">${parseSkills(a.refugeeSkills).map((s) => {
          const v = verifiedSet(u).has(s);
          return `<span class="tag ${v ? "verified" : ""}">${v ? "✓ " : ""}${esc(s)}</span>`;
        }).join("")}</div>
        ${a.note ? `<div class="note-box">Applicant note: ${esc(a.note)}</div>` : ""}
        <details><summary class="job-meta">View credentials &amp; evidence</summary>
          ${myCreds.length === 0 ? `<p class="job-meta">None submitted.</p>` : myCreds.map((c) => `
            <p class="job-meta">${esc(c.title)} ${badge(c.status)} &bull; ${esc(c.evidenceType)}</p>`).join("")}
          <p class="job-meta">CV: ${esc(a.cvName)} &bull; Documents: ${esc(u.docStatus || "n/a")}</p>
        </details>
        <div class="row-actions">
          <button class="btn btn-primary" onclick="updateApplicationStatus('${esc(a.id)}','Shortlisted')">Shortlist</button>
          <button class="btn btn-secondary" onclick="updateApplicationStatus('${esc(a.id)}','Interview Scheduled')">Interview</button>
          <button class="btn btn-primary" onclick="updateApplicationStatus('${esc(a.id)}','Hired')">Hire</button>
          <button class="btn btn-danger" onclick="updateApplicationStatus('${esc(a.id)}','Rejected')">Reject</button>
        </div>
      </div>`).join("");
}

$("post-job-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/jobs", "POST", {
    employerId: currentUser.id, companyName: currentUser.companyName || currentUser.name,
    title: $("job-title").value.trim(), location: $("job-location").value.trim(), type: $("job-type").value,
    salary: $("job-salary").value.trim(), requiredSkills: $("job-skills").value.trim(), description: $("job-desc").value.trim()
  });
  e.target.reset();
  showToast("Job published.");
  loadEmployerDashboard();
});

async function updateApplicationStatus(id, status) {
  const body = { status };
  if (status === "Hired") body.hiredDate = today();
  await api(`/applications/${id}`, "PATCH", body);
  showToast(`Application updated: ${status}`);
  loadEmployerDashboard();
}

/* ======================================================
   VERIFIER + ADMIN
   ====================================================== */
function refreshStaff() {
  return currentUser.role === "verifier" ? loadVerifierDashboard() : loadAdminDashboard();
}

async function renderCredentialQueue(containerId) {
  const creds = await api("/credentials?status=Pending");
  $(containerId).innerHTML = creds.length === 0
    ? `<p class="muted">Nothing waiting. All credentials are reviewed.</p>`
    : creds.map((c) => `
      <div class="list-item">
        <strong>${esc(c.title)}</strong> ${badge(c.status)}<br/>
        <span class="job-meta">${esc(c.refugeeName)} &bull; ${esc(c.institution)} &bull; ${esc(c.type)}</span>
        <p class="job-meta">Evidence type: <strong>${esc(c.evidenceType)}</strong></p>
        <div class="note-box">${esc(c.evidence)}</div>
        <div class="row-actions">
          <input type="text" id="note-${esc(c.id)}-${containerId}" placeholder="Note to the candidate (what is missing or confirmed)" />
          <button class="btn btn-primary" onclick="reviewCredential('${esc(c.id)}','Verified','${containerId}')">Verify</button>
          <button class="btn btn-danger" onclick="reviewCredential('${esc(c.id)}','Rejected','${containerId}')">Reject</button>
        </div>
      </div>`).join("");
}

async function reviewCredential(id, status, containerId) {
  const note = $(`note-${id}-${containerId}`).value.trim();
  if (status === "Rejected" && !note) return showToast("Please add a note so the candidate knows what to fix.");
  await api(`/credentials/${id}`, "PATCH", { status, verifierNote: note, reviewedBy: currentUser.name, reviewedDate: today() });
  showToast(`Credential ${status.toLowerCase()}.`);
  refreshStaff();
}

async function renderSupportQueue(containerId) {
  const rows = await api("/supportRequests?status=Pending");
  $(containerId).innerHTML = rows.length === 0
    ? `<p class="muted">No pending requests.</p>`
    : rows.map((r) => `
      <div class="list-item"><strong>${esc(r.type)}</strong><br/>
        <span class="job-meta">${esc(r.refugeeName)} &bull; ${esc(r.date)}</span>
        <div class="note-box">${esc(r.note)}</div>
        <div class="row-actions">
          <button class="btn btn-primary" onclick="reviewSupport('${esc(r.id)}','Approved')">Approve</button>
          <button class="btn btn-light" onclick="reviewSupport('${esc(r.id)}','Declined')">Decline</button>
        </div></div>`).join("");
}

async function reviewSupport(id, status) {
  await api(`/supportRequests/${id}`, "PATCH", { status });
  showToast(`Request ${status.toLowerCase()}.`);
  refreshStaff();
}

async function loadVerifierDashboard() {
  await Promise.all([renderCredentialQueue("verifier-queue"), renderSupportQueue("verifier-support-queue")]);
  const all = await api("/credentials");
  const done = all.filter((c) => c.status !== "Pending");
  $("verifier-history").innerHTML = done.length === 0 ? `<p class="muted">No reviews yet.</p>`
    : done.map((c) => `<div class="list-item"><strong>${esc(c.title)}</strong> ${badge(c.status)}<br/>
        <span class="job-meta">${esc(c.refugeeName)} &bull; ${esc(c.reviewedDate || "")}</span></div>`).join("");
}

async function loadAdminDashboard() {
  const [users, jobs, apps, creds, support] = await Promise.all([
    api("/users"), api("/jobs"), api("/applications"), api("/credentials"), api("/supportRequests")
  ]);
  const refugees = users.filter((u) => u.role === "refugee");
  const skillBadges = refugees.reduce((n, u) => n + (u.verifiedSkills || []).length, 0);
  const verifiedPeople = refugees.filter((u) =>
    (u.verifiedSkills || []).length > 0 || creds.some((c) => String(c.refugeeId) === String(u.id) && c.status === "Verified")).length;
  const hired = apps.filter((a) => a.status === "Hired").length;

  $("admin-stats").innerHTML = `
    <div class="stat-box"><h3>${refugees.length}</h3><p>Refugee talent (SDG 10)</p></div>
    <div class="stat-box"><h3>${verifiedPeople}</h3><p>With verified skills or credentials (SDG 4)</p></div>
    <div class="stat-box"><h3>${creds.filter((c) => c.status === "Verified").length} / ${skillBadges}</h3><p>Credentials / skill badges verified</p></div>
    <div class="stat-box"><h3>${refugees.filter(isWorkReady).length}</h3><p>Work-ready (SDG 8, 16)</p></div>
    <div class="stat-box"><h3>${jobs.length}</h3><p>Opportunities posted (SDG 17)</p></div>
    <div class="stat-box"><h3>${apps.length} / ${hired}</h3><p>Applications / hired</p></div>
    <div class="stat-box"><h3>${support.filter((s) => s.status === "Approved").length}</h3><p>Support requests approved</p></div>`;

  await Promise.all([renderCredentialQueue("admin-verifier-queue"), renderSupportQueue("admin-support-queue")]);

  $("admin-users-table").innerHTML = users.map((u) => `
    <tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role.toUpperCase())}</td><td>${esc(u.location || "-")}</td>
    <td>${u.role !== "admin" ? `<button class="btn btn-danger" onclick="deleteRecord('users','${esc(u.id)}')">Remove</button>` : "-"}</td></tr>`).join("");
  $("admin-jobs-table").innerHTML = jobs.map((j) => `
    <tr><td>${esc(j.title)}</td><td>${esc(j.companyName)}</td><td>${esc(j.location)}</td><td>${esc(j.requiredSkills)}</td>
    <td><button class="btn btn-danger" onclick="deleteRecord('jobs','${esc(j.id)}')">Delete</button></td></tr>`).join("");
  $("admin-apps-table").innerHTML = apps.map((a) => `
    <tr><td>${esc(a.refugeeName)}</td><td>${esc(a.jobTitle)}</td><td>${esc(a.companyName)}</td><td>${esc(a.cvName)}</td><td>${esc(a.status)}</td></tr>`).join("");
}

async function deleteRecord(resource, id) {
  if (!confirm("Delete this record?")) return;
  await api(`/${resource}/${id}`, "DELETE");
  showToast("Record deleted.");
  loadAdminDashboard();
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  updateNavigation();
  loadJobs();
  if (currentUser) routeToDashboard(); else showSection("landing");
});