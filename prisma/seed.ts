/**
 * Seeds a demo dataset: a team of users, ten clients across every status, their
 * contacts, projects, tasks, invoices, notes and a matching activity feed.
 *
 * Safe to re-run — it clears the tables it owns first.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient, type Client, type Project } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "password123";
const PORTAL_EMAIL = process.env.SEED_PORTAL_EMAIL ?? "client@example.com";
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.activity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.client.deleteMany();
  // Everything else is demo data, but the super admin is a real account someone
  // created deliberately — wiping it would lock them out of /team with no way back.
  await prisma.user.deleteMany({ where: { role: { not: "SUPER_ADMIN" } } });

  console.log("Creating users…");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL.toLowerCase(),
      name: "Alex Morgan",
      passwordHash,
      role: "ADMIN",
    },
  });

  const [dana, priya] = await Promise.all([
    prisma.user.create({
      data: {
        email: "dana@example.com",
        name: "Dana Whitfield",
        passwordHash,
        role: "MEMBER",
      },
    }),
    prisma.user.create({
      data: {
        email: "priya@example.com",
        name: "Priya Raman",
        passwordHash,
        role: "MEMBER",
      },
    }),
  ]);

  const owners = [admin, dana, priya];

  console.log("Creating clients…");
  const clientSeeds = [
    {
      name: "Northwind Logistics",
      company: "Northwind Logistics LLC",
      email: "hello@northwind.example",
      phone: "+1 (415) 555-0142",
      website: "https://northwind.example",
      industry: "Transportation",
      status: "ACTIVE",
      addressLine: "480 Harrison St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "United States",
      notes: "Renewal conversation scheduled for the end of the quarter.",
      contacts: [
        { firstName: "Grace", lastName: "Okafor", title: "VP Operations", email: "grace@northwind.example", phone: "+1 (415) 555-0143", isPrimary: true },
        { firstName: "Ben", lastName: "Alvarez", title: "Logistics Manager", email: "ben@northwind.example", phone: "+1 (415) 555-0144", isPrimary: false },
      ],
    },
    {
      name: "Harbor Health",
      company: "Harbor Health Group",
      email: "contact@harborhealth.example",
      phone: "+1 (206) 555-0119",
      website: "https://harborhealth.example",
      industry: "Healthcare",
      status: "ACTIVE",
      addressLine: "1200 Pike St",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "United States",
      notes: "Compliance review required before any data migration work.",
      contacts: [
        { firstName: "Marcus", lastName: "Lee", title: "CTO", email: "marcus@harborhealth.example", phone: "+1 (206) 555-0120", isPrimary: true },
      ],
    },
    {
      name: "Bright Path Education",
      company: "Bright Path Education Inc.",
      email: "team@brightpath.example",
      phone: "+1 (512) 555-0177",
      website: "https://brightpath.example",
      industry: "Education",
      status: "ACTIVE",
      addressLine: "701 Congress Ave",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "United States",
      notes: null,
      contacts: [
        { firstName: "Sofia", lastName: "Marchetti", title: "Head of Product", email: "sofia@brightpath.example", phone: "+1 (512) 555-0178", isPrimary: true },
        { firstName: "Tomás", lastName: "Duarte", title: "Curriculum Lead", email: "tomas@brightpath.example", phone: null, isPrimary: false },
      ],
    },
    {
      name: "Cedar & Co.",
      company: "Cedar & Co. Design",
      email: "studio@cedarco.example",
      phone: "+1 (503) 555-0188",
      website: "https://cedarco.example",
      industry: "Design",
      status: "LEAD",
      addressLine: "88 NW Couch St",
      city: "Portland",
      state: "OR",
      postalCode: "97209",
      country: "United States",
      notes: "Referred by Bright Path. Wants a scoped pilot before committing.",
      contacts: [
        { firstName: "Hana", lastName: "Yoshida", title: "Principal", email: "hana@cedarco.example", phone: "+1 (503) 555-0189", isPrimary: true },
      ],
    },
    {
      name: "Vertex Manufacturing",
      company: "Vertex Manufacturing Co.",
      email: "info@vertexmfg.example",
      phone: "+1 (313) 555-0155",
      website: "https://vertexmfg.example",
      industry: "Manufacturing",
      status: "ACTIVE",
      addressLine: "2200 Woodward Ave",
      city: "Detroit",
      state: "MI",
      postalCode: "48201",
      country: "United States",
      notes: "Invoices must reference a purchase order number.",
      contacts: [
        { firstName: "Ruth", lastName: "Kaplan", title: "Director of IT", email: "ruth@vertexmfg.example", phone: "+1 (313) 555-0156", isPrimary: true },
        { firstName: "Owen", lastName: "Pierce", title: "Plant Supervisor", email: "owen@vertexmfg.example", phone: null, isPrimary: false },
      ],
    },
    {
      name: "Lumen Financial",
      company: "Lumen Financial Partners",
      email: "advisors@lumenfin.example",
      phone: "+1 (212) 555-0133",
      website: "https://lumenfin.example",
      industry: "Finance",
      status: "LEAD",
      addressLine: "55 Water St",
      city: "New York",
      state: "NY",
      postalCode: "10041",
      country: "United States",
      notes: "Waiting on their security questionnaire.",
      contacts: [
        { firstName: "Isabelle", lastName: "Rossi", title: "COO", email: "isabelle@lumenfin.example", phone: "+1 (212) 555-0134", isPrimary: true },
      ],
    },
    {
      name: "Greenfield Farms",
      company: "Greenfield Farms Cooperative",
      email: "office@greenfield.example",
      phone: "+1 (515) 555-0166",
      website: null,
      industry: "Agriculture",
      status: "INACTIVE",
      addressLine: "4100 Prairie Rd",
      city: "Des Moines",
      state: "IA",
      postalCode: "50309",
      country: "United States",
      notes: "Paused after harvest season; revisit in the spring.",
      contacts: [
        { firstName: "Walter", lastName: "Nguyen", title: "General Manager", email: "walter@greenfield.example", phone: "+1 (515) 555-0167", isPrimary: true },
      ],
    },
    {
      name: "Atlas Media",
      company: "Atlas Media Group",
      email: "hello@atlasmedia.example",
      phone: "+1 (323) 555-0111",
      website: "https://atlasmedia.example",
      industry: "Media",
      status: "ACTIVE",
      addressLine: "6255 Sunset Blvd",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90028",
      country: "United States",
      notes: null,
      contacts: [
        { firstName: "Jade", lastName: "Fontaine", title: "Executive Producer", email: "jade@atlasmedia.example", phone: "+1 (323) 555-0112", isPrimary: true },
        { firstName: "Kwame", lastName: "Boateng", title: "Post Supervisor", email: "kwame@atlasmedia.example", phone: null, isPrimary: false },
      ],
    },
    {
      name: "Sable Retail",
      company: "Sable Retail Holdings",
      email: "ops@sableretail.example",
      phone: "+1 (312) 555-0198",
      website: "https://sableretail.example",
      industry: "Retail",
      status: "ARCHIVED",
      addressLine: "233 S Wacker Dr",
      city: "Chicago",
      state: "IL",
      postalCode: "60606",
      country: "United States",
      notes: "Acquired in March; account closed out.",
      contacts: [
        { firstName: "Nora", lastName: "Bright", title: "Head of Stores", email: "nora@sableretail.example", phone: null, isPrimary: true },
      ],
    },
    {
      name: "Quill Software",
      company: "Quill Software Ltd.",
      email: "team@quillsw.example",
      phone: "+44 20 7946 0958",
      website: "https://quillsw.example",
      industry: "Technology",
      status: "ACTIVE",
      addressLine: "14 Charlotte St",
      city: "London",
      state: null,
      postalCode: "W1T 2LX",
      country: "United Kingdom",
      notes: "All meetings need to land before 3pm UK time.",
      contacts: [
        { firstName: "Eleanor", lastName: "Shaw", title: "Engineering Manager", email: "eleanor@quillsw.example", phone: "+44 20 7946 0959", isPrimary: true },
      ],
    },
  ] as const;

  const clients: Client[] = [];
  for (const [index, seed] of clientSeeds.entries()) {
    const { contacts, ...clientData } = seed;
    const client = await prisma.client.create({
      data: {
        ...clientData,
        ownerId: owners[index % owners.length].id,
        createdAt: daysFromNow(-120 + index * 9),
        contacts: { create: contacts.map((c) => ({ ...c })) },
      },
    });
    clients.push(client);
  }

  const byName = (name: string) => {
    const found = clients.find((c) => c.name === name);
    if (!found) throw new Error(`Seed error: no client named ${name}`);
    return found;
  };

  console.log("Creating projects…");
  const projectSeeds = [
    { client: "Northwind Logistics", name: "Fleet Tracking Portal", description: "Real-time vehicle tracking dashboard for dispatchers.", status: "ACTIVE", budgetCents: 8_400_000, startDate: daysFromNow(-70), endDate: daysFromNow(35), liveUrl: "https://fleet.northwind.example" },
    { client: "Northwind Logistics", name: "Warehouse Mobile App", description: "Barcode scanning app for inbound receiving.", status: "PLANNING", budgetCents: 3_200_000, startDate: daysFromNow(20), endDate: daysFromNow(140) },
    { client: "Harbor Health", name: "Patient Intake Redesign", description: "Rebuild the intake flow with accessibility compliance.", status: "ACTIVE", budgetCents: 12_500_000, startDate: daysFromNow(-45), endDate: daysFromNow(60), liveUrl: "https://intake-staging.harborhealth.example" },
    { client: "Bright Path Education", name: "Course Authoring Tools", description: "Editor for instructors to build interactive lessons.", status: "ACTIVE", budgetCents: 6_750_000, startDate: daysFromNow(-30), endDate: daysFromNow(90) },
    { client: "Bright Path Education", name: "Analytics Reporting v2", description: "Cohort progress reporting for district administrators.", status: "ON_HOLD", budgetCents: 2_900_000, startDate: daysFromNow(-15), endDate: null },
    { client: "Vertex Manufacturing", name: "Shop Floor Dashboards", description: "Line throughput and downtime monitoring screens.", status: "ACTIVE", budgetCents: 9_100_000, startDate: daysFromNow(-60), endDate: daysFromNow(45) },
    { client: "Atlas Media", name: "Asset Library Migration", description: "Move 40TB of media assets to the new storage tier.", status: "COMPLETED", budgetCents: 4_800_000, startDate: daysFromNow(-180), endDate: daysFromNow(-25), liveUrl: "https://assets.atlasmedia.example" },
    { client: "Quill Software", name: "Design System Rollout", description: "Component library and documentation site.", status: "ACTIVE", budgetCents: 5_600_000, startDate: daysFromNow(-40), endDate: daysFromNow(50), liveUrl: "https://design.quillsw.example" },
    { client: "Greenfield Farms", name: "Yield Forecasting Model", description: "Season-over-season yield projections.", status: "CANCELLED", budgetCents: 2_100_000, startDate: daysFromNow(-200), endDate: daysFromNow(-150) },
    { client: "Cedar & Co.", name: "Pilot Engagement", description: "Two-week discovery sprint to scope the full build.", status: "PLANNING", budgetCents: 950_000, startDate: daysFromNow(14), endDate: daysFromNow(28) },
  ] as const;

  const projects: Project[] = [];
  for (const seed of projectSeeds) {
    const { client, ...rest } = seed;
    projects.push(
      await prisma.project.create({ data: { ...rest, clientId: byName(client).id } }),
    );
  }

  const projectByName = (name: string) => {
    const found = projects.find((p) => p.name === name);
    if (!found) throw new Error(`Seed error: no project named ${name}`);
    return found;
  };

  console.log("Creating tasks…");
  const taskSeeds = [
    { title: "Send renewal proposal", status: "TODO", priority: "HIGH", dueDate: daysFromNow(2), client: "Northwind Logistics", project: null, assignee: admin.id },
    { title: "Review dispatcher feedback", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: daysFromNow(5), client: "Northwind Logistics", project: "Fleet Tracking Portal", assignee: dana.id },
    { title: "Accessibility audit of intake forms", status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(-1), client: "Harbor Health", project: "Patient Intake Redesign", assignee: priya.id },
    { title: "Schedule compliance review call", status: "TODO", priority: "HIGH", dueDate: daysFromNow(1), client: "Harbor Health", project: null, assignee: admin.id },
    { title: "Draft lesson editor spec", status: "DONE", priority: "MEDIUM", dueDate: daysFromNow(-12), client: "Bright Path Education", project: "Course Authoring Tools", assignee: dana.id },
    { title: "Confirm hosting budget", status: "TODO", priority: "LOW", dueDate: daysFromNow(12), client: "Bright Path Education", project: "Analytics Reporting v2", assignee: priya.id },
    { title: "Wire up downtime alerts", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: daysFromNow(7), client: "Vertex Manufacturing", project: "Shop Floor Dashboards", assignee: dana.id },
    { title: "Collect PO number for August invoice", status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(3), client: "Vertex Manufacturing", project: null, assignee: admin.id },
    { title: "Publish component docs site", status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(9), client: "Quill Software", project: "Design System Rollout", assignee: priya.id },
    { title: "Follow up on security questionnaire", status: "TODO", priority: "HIGH", dueDate: daysFromNow(-3), client: "Lumen Financial", project: null, assignee: admin.id },
    { title: "Prepare pilot statement of work", status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(6), client: "Cedar & Co.", project: "Pilot Engagement", assignee: dana.id },
    { title: "Archive migration runbook", status: "DONE", priority: "LOW", dueDate: daysFromNow(-22), client: "Atlas Media", project: "Asset Library Migration", assignee: priya.id },
  ] as const;

  for (const seed of taskSeeds) {
    await prisma.task.create({
      data: {
        title: seed.title,
        status: seed.status,
        priority: seed.priority,
        dueDate: seed.dueDate,
        completedAt: seed.status === "DONE" ? seed.dueDate : null,
        clientId: seed.client ? byName(seed.client).id : null,
        projectId: seed.project ? projectByName(seed.project).id : null,
        assigneeId: seed.assignee,
      },
    });
  }

  console.log("Creating invoices…");
  const invoiceSeeds = [
    {
      number: "INV-1001", client: "Northwind Logistics", project: "Fleet Tracking Portal", status: "PAID",
      issueDate: daysFromNow(-58), dueDate: daysFromNow(-28), paidAt: daysFromNow(-31), taxRate: 8.5,
      items: [
        { description: "Discovery and technical architecture", quantity: 1, unitPriceCents: 1_200_000 },
        { description: "Frontend development — 80 hrs", quantity: 80, unitPriceCents: 18_500 },
      ],
    },
    {
      number: "INV-1002", client: "Harbor Health", project: "Patient Intake Redesign", status: "PAID",
      issueDate: daysFromNow(-44), dueDate: daysFromNow(-14), paidAt: daysFromNow(-16), taxRate: 0,
      items: [
        { description: "Accessibility audit", quantity: 1, unitPriceCents: 850_000 },
        { description: "Intake flow prototype", quantity: 1, unitPriceCents: 1_450_000 },
      ],
    },
    {
      number: "INV-1003", client: "Vertex Manufacturing", project: "Shop Floor Dashboards", status: "OVERDUE",
      issueDate: daysFromNow(-52), dueDate: daysFromNow(-22), paidAt: null, taxRate: 6,
      items: [
        { description: "Dashboard implementation — 120 hrs", quantity: 120, unitPriceCents: 17_500 },
        { description: "On-site installation", quantity: 2, unitPriceCents: 240_000 },
      ],
    },
    {
      number: "INV-1004", client: "Bright Path Education", project: "Course Authoring Tools", status: "SENT",
      issueDate: daysFromNow(-12), dueDate: daysFromNow(18), paidAt: null, taxRate: 0,
      items: [
        { description: "Editor milestone 1", quantity: 1, unitPriceCents: 2_250_000 },
      ],
    },
    {
      number: "INV-1005", client: "Atlas Media", project: "Asset Library Migration", status: "PAID",
      issueDate: daysFromNow(-30), dueDate: daysFromNow(0), paidAt: daysFromNow(-9), taxRate: 9.5,
      items: [
        { description: "Storage migration — final milestone", quantity: 1, unitPriceCents: 1_900_000 },
        { description: "Handover training session", quantity: 3, unitPriceCents: 95_000 },
      ],
    },
    {
      number: "INV-1006", client: "Quill Software", project: "Design System Rollout", status: "SENT",
      issueDate: daysFromNow(-6), dueDate: daysFromNow(24), paidAt: null, taxRate: 20,
      items: [
        { description: "Component library — sprint 3", quantity: 1, unitPriceCents: 1_400_000 },
        { description: "Documentation site build", quantity: 1, unitPriceCents: 620_000 },
      ],
    },
    {
      number: "INV-1007", client: "Northwind Logistics", project: null, status: "DRAFT",
      issueDate: daysFromNow(-1), dueDate: daysFromNow(29), paidAt: null, taxRate: 8.5,
      items: [
        { description: "Retainer — next quarter", quantity: 3, unitPriceCents: 450_000 },
      ],
    },
    {
      number: "INV-1008", client: "Greenfield Farms", project: null, status: "VOID",
      issueDate: daysFromNow(-160), dueDate: daysFromNow(-130), paidAt: null, taxRate: 0,
      items: [{ description: "Forecasting model — cancelled scope", quantity: 1, unitPriceCents: 780_000 }],
    },
  ] as const;

  for (const seed of invoiceSeeds) {
    await prisma.invoice.create({
      data: {
        number: seed.number,
        clientId: byName(seed.client).id,
        projectId: seed.project ? projectByName(seed.project).id : null,
        status: seed.status,
        issueDate: seed.issueDate,
        dueDate: seed.dueDate,
        paidAt: seed.paidAt,
        taxRate: seed.taxRate,
        items: {
          create: seed.items.map((item, position) => ({ ...item, position })),
        },
      },
    });
  }

  console.log("Creating notes and activity…");
  const noteSeeds = [
    { client: "Northwind Logistics", author: admin.id, body: "Call with Grace: they want driver mobile access before the renewal.", createdAt: daysFromNow(-6) },
    { client: "Northwind Logistics", author: dana.id, body: "Dispatch team flagged slow map rendering on older tablets.", createdAt: daysFromNow(-3) },
    { client: "Harbor Health", author: priya.id, body: "Marcus confirmed the security review board meets on the 14th.", createdAt: daysFromNow(-8) },
    { client: "Bright Path Education", author: dana.id, body: "Sofia wants the analytics work resumed once the editor ships.", createdAt: daysFromNow(-4) },
    { client: "Cedar & Co.", author: admin.id, body: "Hana asked for references from a similar-sized studio.", createdAt: daysFromNow(-2) },
    { client: "Vertex Manufacturing", author: admin.id, body: "Ruth escalated the overdue invoice to their finance team.", createdAt: daysFromNow(-1) },
    { client: "Lumen Financial", author: priya.id, body: "Sent the questionnaire; expecting a response within two weeks.", createdAt: daysFromNow(-11) },
  ] as const;

  for (const seed of noteSeeds) {
    const client = byName(seed.client);
    await prisma.note.create({
      data: {
        clientId: client.id,
        authorId: seed.author,
        body: seed.body,
        createdAt: seed.createdAt,
      },
    });
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        message: `Note added to ${client.name}`,
        clientId: client.id,
        actorId: seed.author,
        entityType: "Client",
        entityId: client.id,
        createdAt: seed.createdAt,
      },
    });
  }

  for (const [index, client] of clients.entries()) {
    await prisma.activity.create({
      data: {
        type: "CLIENT_CREATED",
        message: `${client.name} was added as a client`,
        clientId: client.id,
        actorId: owners[index % owners.length].id,
        entityType: "Client",
        entityId: client.id,
        createdAt: client.createdAt,
      },
    });
  }

  for (const project of projects) {
    const client = clients.find((c) => c.id === project.clientId)!;
    await prisma.activity.create({
      data: {
        type: "PROJECT_CREATED",
        message: `Project "${project.name}" started for ${client.name}`,
        clientId: client.id,
        actorId: admin.id,
        entityType: "Project",
        entityId: project.id,
        createdAt: project.startDate ?? project.createdAt,
      },
    });
  }

  console.log("Creating a portal login…");
  const northwind = byName("Northwind Logistics");
  const portalUser = await prisma.user.create({
    data: {
      email: PORTAL_EMAIL.toLowerCase(),
      name: "Grace Okafor",
      passwordHash,
      role: "CLIENT",
      clientId: northwind.id,
    },
  });

  await prisma.activity.create({
    data: {
      type: "PORTAL_ACCESS_GRANTED",
      message: `Portal access granted to ${portalUser.email} for ${northwind.name}`,
      clientId: northwind.id,
      actorId: admin.id,
      entityType: "User",
      entityId: portalUser.id,
      createdAt: daysFromNow(-9),
    },
  });

  console.log("Creating demo files…");
  await mkdir(UPLOAD_DIR, { recursive: true });

  const fleetProject = projectByName("Fleet Tracking Portal");
  const demoFiles = [
    {
      filename: "Fleet-Portal-Milestone-2.md",
      body: "# Milestone 2 summary\n\nDispatcher map, driver roster and the first round of alerting are live on staging.\n",
      mimeType: "text/markdown",
      uploadedBy: "STAFF" as const,
      uploaderId: admin.id,
      projectId: fleetProject.id,
      note: "Milestone summary for your review.",
      createdAt: daysFromNow(-5),
    },
    {
      filename: "Northwind-Depot-List.csv",
      body: "depot,city,vehicles\nOakland,Oakland CA,42\nFresno,Fresno CA,18\nReno,Reno NV,11\n",
      mimeType: "text/csv",
      uploadedBy: "CLIENT" as const,
      uploaderId: portalUser.id,
      projectId: fleetProject.id,
      note: "Depot list you asked for — vehicle counts as of this morning.",
      createdAt: daysFromNow(-2),
    },
  ];

  for (const file of demoFiles) {
    const storedName = `seed-${file.filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
    await writeFile(path.join(UPLOAD_DIR, storedName), file.body, "utf8");
    const attachment = await prisma.attachment.create({
      data: {
        clientId: northwind.id,
        projectId: file.projectId,
        filename: file.filename,
        storedName,
        mimeType: file.mimeType,
        sizeBytes: Buffer.byteLength(file.body, "utf8"),
        uploadedBy: file.uploadedBy,
        uploaderId: file.uploaderId,
        note: file.note,
        createdAt: file.createdAt,
      },
    });
    await prisma.activity.create({
      data: {
        type: file.uploadedBy === "CLIENT" ? "FILE_RECEIVED" : "FILE_SHARED",
        message:
          file.uploadedBy === "CLIENT"
            ? `${portalUser.name} uploaded ${attachment.filename} through the portal`
            : `${attachment.filename} was shared with ${northwind.name}`,
        clientId: northwind.id,
        actorId: file.uploaderId,
        entityType: "Attachment",
        entityId: attachment.id,
        createdAt: file.createdAt,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    contacts: await prisma.contact.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    invoices: await prisma.invoice.count(),
    notes: await prisma.note.count(),
    files: await prisma.attachment.count(),
    portalLogins: await prisma.user.count({ where: { role: "CLIENT" } }),
    activity: await prisma.activity.count(),
  };

  console.log("\nSeed complete:", counts);
  console.log(`\nStaff sign-in:   ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log(`Client portal:   ${PORTAL_EMAIL}  /  ${ADMIN_PASSWORD}   (Northwind Logistics)\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
