import { describe, expect, it } from "vitest";
import { classifyContacts } from "./migrate";
import { ResumeContentSchema } from "./schema";

describe("classifyContacts", () => {
  it("sorts email, phone, location and links", () => {
    expect(
      classifyContacts([
        { id: "1", text: "larjun01@gmail.com" },
        { id: "2", text: "Chennai" },
        { id: "3", text: "+91 9941738680" },
        { id: "4", text: "linkedin.com/in/x/", url: "https://www.linkedin.com/in/x/" },
        { id: "5", text: "" },
      ]),
    ).toEqual({
      email: "larjun01@gmail.com",
      phone: "+91 9941738680",
      location: "Chennai",
      links: [{ id: "4", text: "linkedin.com/in/x/", url: "https://www.linkedin.com/in/x/" }],
    });
  });

  it("does not mistake a year-like or short number for a phone", () => {
    expect(classifyContacts([{ id: "1", text: "Boulder, CO 80301" }]).location).toBe("Boulder, CO 80301");
  });
});

describe("ResumeContentSchema migration", () => {
  it("upgrades v1 content (header.contacts) all the way to the current version", () => {
    const v1 = {
      version: 1,
      header: {
        name: "Ada",
        contacts: [
          { id: "a", text: "ada@x.org" },
          { id: "b", text: "London" },
          { id: "c", text: "ada.dev", url: "https://ada.dev" },
        ],
      },
      sections: [],
    };
    expect(ResumeContentSchema.parse(v1)).toEqual({
      version: 3,
      settings: { dateFormat: "long" },
      header: {
        name: "Ada",
        email: "ada@x.org",
        location: "London",
        phone: "",
        links: [{ id: "c", text: "ada.dev", url: "https://ada.dev" }],
      },
      sections: [],
    });
  });

  it("upgrades v2 free-text dates to structured dates and infers the format", () => {
    const header = { name: "", email: "", location: "", phone: "", links: [] };
    const v2 = {
      version: 2,
      header,
      sections: [
        {
          id: "s1",
          heading: "Experience",
          type: "entries",
          entries: [
            { id: "e1", title: "", org: "", location: "", visible: true, bullets: [], dates: { start: "Dec 2024", end: "Feb 2026" } },
            { id: "e2", title: "", org: "", location: "", visible: true, bullets: [], dates: { start: "Jul 2026", end: "Present" } },
          ],
        },
        { id: "s2", heading: "Education", type: "education", schools: [
          { id: "sc", school: "", location: "", degrees: [{ id: "d", name: "", dates: { start: "2019", end: "" } }] },
        ] },
        { id: "s3", heading: "Publications", type: "publications", papers: [
          { id: "p", title: "", authors: "", venue: "", date: "", bullets: [], visible: true },
        ] },
      ],
    };
    const out = ResumeContentSchema.parse(v2);
    expect(out.version).toBe(3);
    expect(out.settings.dateFormat).toBe("short");
    const [exp, edu, pubs] = out.sections;
    expect(exp.type === "entries" && exp.entries.map((e) => e.dates)).toEqual([
      { start: { year: 2024, month: 12 }, end: { year: 2026, month: 2 } },
      { start: { year: 2026, month: 7 }, end: "present" },
    ]);
    expect(edu.type === "education" && edu.schools[0].degrees[0].dates).toEqual({ start: { year: 2019, month: null }, end: null });
    expect(pubs.type === "publications" && pubs.papers[0].date).toBe(null);
  });

  it("leaves current-version content untouched", () => {
    const v3 = {
      version: 3,
      settings: { dateFormat: "numeric" },
      header: { name: "", email: "", location: "", phone: "", links: [] },
      sections: [],
    };
    expect(ResumeContentSchema.parse(v3)).toEqual(v3);
  });
});
