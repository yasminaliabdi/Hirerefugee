// mock-api.js — load BEFORE app.js
// Makes the app work on any static host (Netlify, Vercel, GitHub Pages) AND local file:// opening.
// Seed data comes from db.json (with inline fallback if opened via file://); changes persist in localStorage.
(function () {
  const API = "http://localhost:3000";
  const realFetch = window.fetch.bind(window);
  const KEY = "hireRefugeeDB_v2";
  let seedPromise = null;

  const FALLBACK_SEED = {
    users: [
      {
        id: "1", name: "Amina Hassan", email: "amina@example.com", password: "password123", role: "refugee",
        location: "Nairobi (Eastleigh)",
        skills: "Customer Service, English, Swahili, Microsoft Excel, Data Entry",
        education: "Diploma in Business Management",
        experience: "2 years as a retail cashier and inventory clerk in Kakuma.",
        cvName: "Amina_Hassan_CV.pdf",
        docStatus: "Valid Refugee ID & Class M Work Permit",
        verifiedSkills: [
          { skill: "Microsoft Excel", score: 4, total: 4, date: "2026-11-21" },
          { skill: "Customer Service", score: 3, total: 4, date: "2026-11-21" }
        ],
        checklist: { refugeeId: true, kraPin: true, bank: true, permit: true, contract: false }
      },
      {
        id: "2", name: "Savannah Tech Solutions", email: "hr@savannahtech.co.ke", password: "password123", role: "employer",
        companyName: "Savannah Tech Solutions", industry: "IT & Digital Services", location: "Nairobi (Kilimani)",
        about: "An inclusive Kenyan digital agency committed to diverse talent."
      },
      {
        id: "3", name: "Platform Admin", email: "admin@hirerefugee.org", password: "password123", role: "admin"
      },
      {
        id: "4", name: "Kakuma Skills Partner (Verifier)", email: "verifier@partner.org", password: "password123", role: "verifier",
        location: "Nairobi", about: "NGO / training institution that reviews credentials and evidence."
      },
      {
        id: "5", name: "Jean Claude Mbuyi", email: "jean@example.com", password: "password123", role: "refugee",
        location: "Kakuma",
        skills: "English, HTML, CSS, JavaScript, Communication",
        education: "BSc Computer Science (certificate lost during displacement)",
        experience: "3 years as a junior web developer in Goma; freelance projects since arriving in Kenya.",
        cvName: "Jean_Mbuyi_CV.pdf",
        docStatus: "Refugee ID Holder",
        verifiedSkills: [],
        checklist: { refugeeId: true, kraPin: false, bank: false, permit: false, contract: false }
      }
    ],
    jobs: [
      {
        id: "101", employerId: "2", companyName: "Savannah Tech Solutions",
        title: "Junior Data Entry & Support Associate", location: "Nairobi (Remote / Hybrid)", type: "Full-time",
        salary: "KES 35,000 / month", requiredSkills: "Data Entry, Microsoft Excel, English, Customer Service",
        description: "Manage client spreadsheets, respond to customer inquiries, and maintain digital records."
      },
      {
        id: "102", employerId: "2", companyName: "Savannah Tech Solutions",
        title: "Bilingual Community Liaison (Swahili/Somali)", location: "Nairobi", type: "Contract",
        salary: "KES 40,000 / month", requiredSkills: "Swahili, Somali, Communication, Community Outreach",
        description: "Assist with field surveys and community engagement across Nairobi neighborhoods."
      },
      {
        id: "103", employerId: "2", companyName: "GreenHarvest Logistics",
        title: "Warehouse Inventory Assistant", location: "Mombasa Road, Nairobi", type: "Full-time",
        salary: "KES 28,000 / month", requiredSkills: "Inventory, Microsoft Excel, Organization",
        description: "Track incoming and outgoing agricultural shipments and update stock sheets."
      },
      {
        id: "104", employerId: "2", companyName: "Savannah Tech Solutions",
        title: "Junior Web Developer Returnship (Remote)", location: "Remote", type: "Fellowship / Returnship",
        salary: "KES 45,000 / month stipend", requiredSkills: "HTML, CSS, JavaScript, English",
        description: "A 6-month paid returnship with a mentor, for developers returning to the workforce after displacement."
      }
    ],
    credentials: [
      {
        id: "701", refugeeId: "1", refugeeName: "Amina Hassan", title: "Diploma in Business Management",
        institution: "Kakuma Vocational Training Centre", type: "Diploma", evidenceType: "Original certificate copy",
        evidence: "Scanned diploma (certificate.pdf)", status: "Verified", verifierNote: "Confirmed with the institution.",
        reviewedBy: "Kakuma Skills Partner (Verifier)", reviewedDate: "2026-11-18", submittedDate: "2026-11-15"
      },
      {
        id: "702", refugeeId: "5", refugeeName: "Jean Claude Mbuyi", title: "BSc Computer Science",
        institution: "University of Goma (DR Congo)", type: "Degree", evidenceType: "Missing: request alternative assessment",
        evidence: "Certificate lost. Portfolio: github.com/jean-demo. Former manager can confirm 3 years of work.",
        status: "Pending", verifierNote: "", reviewedBy: "", reviewedDate: "", submittedDate: "2026-11-22"
      },
      {
        id: "703", refugeeId: "5", refugeeName: "Jean Claude Mbuyi", title: "Junior Web Developer (3 years)",
        institution: "Goma Digital Agency", type: "Work Experience", evidenceType: "Referee / employer letter",
        evidence: "Reference letter from former manager (letter.pdf)", status: "Pending", verifierNote: "", reviewedBy: "", reviewedDate: "", submittedDate: "2026-11-22"
      }
    ],
    supportRequests: [
      {
        id: "801", refugeeId: "5", refugeeName: "Jean Claude Mbuyi", type: "Skills assessment fee waiver",
        note: "I cannot pay for a professional web development assessment.", status: "Pending", date: "2026-11-23"
      }
    ],
    applications: [
      {
        id: "501", jobId: "101", jobTitle: "Junior Data Entry & Support Associate", companyName: "Savannah Tech Solutions",
        employerId: "2", refugeeId: "1", refugeeName: "Amina Hassan",
        refugeeSkills: "Customer Service, English, Swahili, Microsoft Excel, Data Entry",
        cvName: "Amina_Hassan_CV.pdf", status: "Under Review", appliedDate: "2026-11-20"
      }
    ]
  };

  async function getDB() {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
    if (!seedPromise) {
      seedPromise = realFetch("db.json")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to fetch db.json");
          return r.json();
        })
        .catch(() => JSON.parse(JSON.stringify(FALLBACK_SEED)))
        .then((seed) => {
          delete seed.$schema;
          localStorage.setItem(KEY, JSON.stringify(seed));
          return seed;
        });
    }
    await seedPromise;
    return JSON.parse(localStorage.getItem(KEY));
  }

  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  window.resetDemoData = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem("hireRefugeeUser");
    location.reload();
  };

  window.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith(API)) return realFetch(url, opts);
    const u = new URL(url);
    const [, resource, id] = u.pathname.split("/");
    const method = (opts.method || "GET").toUpperCase();
    const db = await getDB();
    const table = db[resource] || (db[resource] = []);
    const body = opts.body ? JSON.parse(opts.body) : {};

    if (method === "GET") {
      if (id) {
        const item = table.find((r) => String(r.id) === id);
        return item ? json(item) : json({}, 404);
      }
      let rows = table;
      u.searchParams.forEach((v, k) => {
        if (!k.startsWith("_")) rows = rows.filter((r) => String(r[k]) === v);
      });
      return json(rows);
    }
    if (method === "POST") {
      const item = { id: String(Date.now()) + Math.floor(Math.random() * 100), ...body };
      table.push(item);
      save(db);
      return json(item, 201);
    }
    if (method === "PATCH") {
      const i = table.findIndex((r) => String(r.id) === id);
      if (i < 0) return json({}, 404);
      table[i] = { ...table[i], ...body };
      save(db);
      return json(table[i]);
    }
    if (method === "DELETE") {
      db[resource] = table.filter((r) => String(r.id) !== id);
      save(db);
      return json({});
    }
    return json({}, 405);
  };
})();