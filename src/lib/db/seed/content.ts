// Programs, informational resources (plain-language guides), and events.
// All content is demonstration content; guides are general information and
// direct readers to confirm details with official sources.
import type { Area, VStatus } from "./organizations";

export interface ProgramSeed {
  slug: string;
  title: string;
  org?: string; // organization slug
  summary: string;
  description: string;
  categories: string[];
  populations: string[];
  eligibility: string;
  cost: string;
  free: boolean;
  apply: string;
  startInDays?: number;
  endInDays?: number;
  website?: string;
  email?: string;
  phone?: string;
  areas: Area[];
  status: VStatus;
  verifiedDaysAgo?: number;
  virtual?: boolean;
}

export const PROGRAMS: ProgramSeed[] = [
  {
    slug: "glil-peer-mentor-program", title: "Peer Mentor Leadership Program", org: "great-lakes-independent-living-network",
    summary: "A 10-week program that trains people with disabilities to become certified peer mentors.",
    description: "Participants learn active listening, goal setting, and disability history, then complete a supervised mentoring practicum. Graduates may be eligible for paid mentor roles.",
    categories: ["independent-living", "employment"], populations: ["adults"], eligibility: "Adults 18+ with a disability who are interested in mentoring others.",
    cost: "Free", free: true, apply: "Complete the online interest form or call any regional office. Cohorts start each fall and spring.", startInDays: 21, endInDays: 91,
    website: "https://greatlakesiln.example/peer-mentors", email: "mentors@greatlakesiln.example", areas: [{ county: "Washtenaw" }, { county: "Wayne" }, { county: "Kent" }, { county: "Ingham" }], status: "verified", verifiedDaysAgo: 43, virtual: true,
  },
  {
    slug: "fien-pathways-to-work", title: "Pathways to Work Youth Transition Program", org: "flint-inclusive-employment-network",
    summary: "Paid summer and after-school work experiences for students with disabilities ages 14–24.",
    description: "Students explore careers through job shadowing, paid work experiences, and weekly workplace readiness sessions, with a job coach on site.",
    categories: ["employment", "education"], populations: ["teens", "adults"], eligibility: "Genesee County students ages 14–24 with an IEP or 504 plan.",
    cost: "Free; participants are paid for work experiences", free: true, apply: "Ask your school transition coordinator for a referral, or contact the program directly.",
    website: "https://flintinclusivework.example/pathways", phone: "(810) 555-0119", areas: [{ county: "Genesee" }], status: "needs_update", verifiedDaysAgo: 402,
  },
  {
    slug: "wmafc-parent-leadership-academy", title: "Parent Leadership Academy", org: "west-michigan-autism-family-center",
    summary: "A six-session academy that helps parents of autistic children build advocacy and leadership skills.",
    description: "Parents learn about special education law basics, effective communication with schools, and how to serve on advisory boards. Childcare and dinner provided.",
    categories: ["education", "autism-services", "caregiver-support"], populations: ["families", "caregivers"], eligibility: "Parents and caregivers of autistic children in West Michigan.",
    cost: "Free", free: true, apply: "Register online; space is limited to 20 families per cohort.", startInDays: 35, endInDays: 77,
    website: "https://wmautismfamily.example/academy", email: "families@wmautismfamily.example", areas: [{ county: "Kent" }, { county: "Ottawa" }], status: "verified", verifiedDaysAgo: 178,
  },
  {
    slug: "mmhac-home-modification-mini-grants", title: "Home Modification Mini-Grant Program", org: "mid-michigan-housing-accessibility-coalition",
    summary: "Grants of up to $5,000 for accessibility modifications for income-eligible homeowners.",
    description: "Funds ramps, grab bars, bathroom modifications, and doorway widening. Staff help obtain bids and oversee work.",
    categories: ["housing"], populations: ["adults", "older-adults", "families"], eligibility: "Homeowners in Isabella, Clare, Gratiot, or Midland counties with household income at or below 80% of area median income.",
    cost: "Free to eligible homeowners", free: true, apply: "Call the Coalition to request an application; a home assessment is scheduled after review.",
    phone: "(989) 555-0168", areas: [{ county: "Isabella" }, { county: "Clare" }, { county: "Gratiot" }, { county: "Midland" }], status: "verified", verifiedDaysAgo: 67,
  },
  {
    slug: "mdbc-statewide-respite-voucher-pilot", title: "Statewide Respite Voucher Pilot", org: "michigan-disability-benefits-collaborative",
    summary: "A pilot program offering respite vouchers to family caregivers anywhere in Michigan.",
    description: "Eligible caregivers receive vouchers they can use with a respite provider of their choice, including family friends who complete a short training.",
    categories: ["respite-care", "caregiver-support"], populations: ["caregivers", "families"], eligibility: "Unpaid family caregivers of a child or adult with a disability living in Michigan.",
    cost: "Free", free: true, apply: "Apply by phone or online. Applications are reviewed monthly; funding is limited.",
    website: "https://midisabilitybenefits.example/respite", phone: "(517) 555-0105", areas: ["statewide"], status: "pending_review", virtual: true,
  },
  {
    slug: "watx-at-loan-library", title: "Assistive Technology Loan Library", org: "wolverine-assistive-technology-exchange",
    summary: "Borrow assistive technology for up to six weeks to try before you buy.",
    description: "A statewide lending library of communication devices, switches, vision and hearing aids, and computer access tools, shipped to your door.",
    categories: ["assistive-technology"], populations: ["adults", "children", "families", "professionals"], eligibility: "Any Michigan resident, family member, or professional.",
    cost: "Free; return shipping is prepaid", free: true, apply: "Request items online or by phone.",
    website: "https://wolverineatx.example/library", phone: "(517) 555-0178", areas: ["statewide"], status: "verified", verifiedDaysAgo: 24, virtual: true,
  },
  {
    slug: "jatap-travel-training-program", title: "Community Travel Training Program", org: "jackson-area-transportation-access-project",
    summary: "A structured program that teaches safe, independent bus travel over 4–8 weeks.",
    description: "Includes route planning, fare use, safety skills, and gradual fading of trainer support.",
    categories: ["transportation", "independent-living"], populations: ["teens", "adults", "older-adults"], eligibility: "Jackson County residents age 14+.",
    cost: "Free", free: true, apply: "Call dispatch to schedule an intake.", phone: "(517) 555-0136", areas: [{ county: "Jackson" }], status: "verified", verifiedDaysAgo: 29,
  },
  {
    slug: "swmvrc-braille-summer-program", title: "Braille Literacy Summer Program", org: "southwest-michigan-vision-resource-center",
    summary: "A summer program for students who are blind or have low vision to build braille and technology skills.",
    description: "Daily small-group instruction, field trips, and technology exploration for students ages 6–18.",
    categories: ["vision-services", "education"], populations: ["children", "teens"], eligibility: "Students ages 6–18 who are blind or have low vision.",
    cost: "Free", free: true, apply: "Applications open each spring.", startInDays: 250, endInDays: 285, email: "info@swmivision.example", areas: [{ county: "Berrien" }, { county: "Cass" }, { county: "Van Buren" }], status: "verified", verifiedDaysAgo: 47,
  },
  {
    slug: "baca-caregiver-wellness-retreat", title: "Caregiver Wellness Retreat", org: "bay-area-caregiver-alliance",
    summary: "A one-day retreat for family caregivers with respite provided.",
    description: "Workshops on stress management, peer connection, and self-care, with free respite care available so caregivers can attend.",
    categories: ["caregiver-support", "mental-health"], populations: ["caregivers"], eligibility: "Family caregivers in Bay, Midland, and Arenac counties.",
    cost: "Free", free: true, apply: "Register by phone. Request respite when registering.", startInDays: 45, endInDays: 45, phone: "(989) 555-0149", areas: [{ county: "Bay" }, { county: "Midland" }, { county: "Arenac" }], status: "verified", verifiedDaysAgo: 26,
  },
  {
    slug: "michigan-accessible-trails-initiative", title: "Accessible Trails Discovery Initiative",
    summary: "An independent volunteer effort that documents trail accessibility across Michigan state and local parks.",
    description: "Volunteers record trail surface, grade, width, and amenities so people with disabilities can plan outings. Reports are shared freely online.",
    categories: ["recreation"], populations: ["adults", "families", "older-adults"], eligibility: "Open to everyone.",
    cost: "Free", free: true, apply: "Browse trail reports online or volunteer to survey a trail.", website: "https://accessibletrails.example", areas: ["statewide"], status: "unverified", virtual: true,
  },
];

export interface ResourceSeed {
  slug: string;
  title: string;
  summary: string;
  type: "guide" | "benefits" | "rights" | "toolkit" | "directory" | "article" | "video";
  categories: string[];
  populations: string[];
  org?: string;
  url?: string;
  sourceName: string;
  sourceUrl?: string;
  areas: Area[];
  status: VStatus;
  verifiedDaysAgo?: number;
  minutes: number;
  body: string;
}

export const RESOURCES: ResourceSeed[] = [
  {
    slug: "understanding-ssi-and-ssdi", title: "Understanding SSI and SSDI: A Plain-Language Guide",
    summary: "What the two Social Security disability programs are, how they differ, and how to get help applying.",
    type: "benefits", categories: ["financial-assistance"], populations: ["adults", "families", "caregivers"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 30, minutes: 6,
    body: `Supplemental Security Income (SSI) and Social Security Disability Insurance (SSDI) are two federal programs run by the Social Security Administration. Both can provide monthly payments to people with disabilities, but they work differently.

SSDI is based on your work history. If you worked and paid Social Security taxes long enough, you may qualify. SSI is based on financial need. It is for people with limited income and resources, whether or not they have worked.

Many people qualify for one program, and some qualify for both. In Michigan, people who receive SSI generally also qualify for Medicaid health coverage.

Applying can take time. Gather medical records, a list of your doctors and treatments, and your work history before you start. You can apply online, by phone, or at a local Social Security office.

You do not have to do this alone. Benefits counselors — including several listed on MittenLink — can help you apply, respond to letters, and appeal a denial. Always confirm current rules with the Social Security Administration, because program details change.`,
  },
  {
    slug: "accessible-transportation-in-michigan", title: "Getting Around: Accessible Transportation Options in Michigan",
    summary: "An overview of paratransit, accessible fixed-route buses, volunteer driver programs, and medical transportation.",
    type: "guide", categories: ["transportation"], populations: ["adults", "older-adults", "caregivers"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 55, minutes: 5,
    body: `Transportation is one of the most common barriers people with disabilities describe. Options vary a lot across Michigan, especially between cities and rural areas.

Most public transit agencies operate accessible fixed-route buses with ramps or lifts and priority seating. Many also offer paratransit: a shared-ride service for people whose disability prevents them from using regular buses. Paratransit usually requires an application and advance scheduling.

In rural areas, county transit agencies often provide dial-a-ride service open to everyone. Volunteer driver programs, faith communities, and senior centers may also offer rides.

If you have Medicaid, you may be eligible for non-emergency medical transportation to covered appointments. Ask your health plan how to schedule rides.

Travel training programs teach people to use buses safely and confidently. Search MittenLink for "travel training" or "transportation" to find options near you.`,
  },
  {
    slug: "finding-accessible-housing", title: "Finding Accessible Housing in Michigan",
    summary: "Tips for searching for accessible rentals, requesting reasonable accommodations, and funding home modifications.",
    type: "guide", categories: ["housing"], populations: ["adults", "older-adults", "families"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 41, minutes: 6,
    body: `Finding a home that fits your needs can take time. Start by listing what matters most: a step-free entrance, a roll-in shower, a first-floor bedroom, proximity to transit, or quiet surroundings.

When you contact landlords, ask specific questions about entrances, doorway widths, bathroom layout, and parking. Photos and virtual tours can help, but visit in person when you can.

Under federal fair housing law, people with disabilities can request reasonable accommodations (changes to rules or policies) and reasonable modifications (physical changes to the unit). Put requests in writing and keep copies.

If you own your home, local nonprofits may help fund ramps, grab bars, and bathroom modifications. Some programs have waiting lists, so apply early.

Housing navigators listed on MittenLink can help you search, apply, and request accommodations.`,
  },
  {
    slug: "your-rights-under-the-ada", title: "Your Rights Under the ADA: A Quick Guide",
    summary: "A short introduction to the Americans with Disabilities Act and where to get help if your rights are not respected.",
    type: "rights", categories: ["legal-advocacy"], populations: ["adults", "families", "professionals"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 22, minutes: 5,
    body: `The Americans with Disabilities Act (ADA) is a federal civil rights law that prohibits discrimination against people with disabilities in many areas of public life.

The ADA covers employment, state and local government services, public accommodations such as stores and restaurants, transportation, and telecommunications.

Employers with 15 or more employees must provide reasonable accommodations to qualified employees with disabilities unless doing so would cause undue hardship. Businesses open to the public must remove barriers when it is readily achievable.

If you believe your rights have been violated, write down what happened, when, and who was involved. You may be able to file a complaint with a federal or state agency, and deadlines apply.

This guide is general information, not legal advice. Advocacy organizations listed on MittenLink can help you understand your options.`,
  },
  {
    slug: "caregivers-guide-to-respite", title: "A Caregiver's Guide to Planning Respite",
    summary: "What respite care is, the different types available, and how to plan for it.",
    type: "guide", categories: ["respite-care", "caregiver-support"], populations: ["caregivers", "families"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 37, minutes: 7,
    body: `Respite care gives family caregivers a short break from caregiving. Taking breaks is not a luxury — it helps caregivers stay healthy and continue providing care.

Respite comes in many forms: a trained provider who comes to your home for a few hours, adult day programs, overnight respite in a licensed setting, or camps and recreation programs.

Start by thinking about what kind of break you need and how often. Write down routines, medications, communication preferences, and emergency contacts so any provider can step in confidently.

Funding may be available through Medicaid waivers, local community mental health agencies, grants, or sliding-scale programs. Availability varies widely by county, and many rural areas have limited options.

If you cannot find respite near you, statewide navigation programs listed on MittenLink can help you explore self-directed options, such as training a trusted friend or relative.`,
  },
  {
    slug: "michigan-respite-resource-directory", title: "Michigan Respite Care Resource List for Families",
    summary: "A statewide list of respite navigation programs, funding sources, and questions to ask providers.",
    type: "directory", categories: ["respite-care", "caregiver-support"], populations: ["caregivers", "families"],
    org: "michigan-disability-benefits-collaborative", sourceName: "Michigan Disability Benefits Collaborative (demonstration organization)", sourceUrl: "https://midisabilitybenefits.example/respite-list",
    areas: ["statewide"], status: "verified", verifiedDaysAgo: 40, minutes: 4,
    body: `This list is maintained for families looking for respite anywhere in Michigan, including rural counties where local providers may be limited.

Statewide options include phone-based respite navigation, respite voucher programs, and self-directed respite, where families choose and train their own provider.

Questions to ask any respite provider: What training do your staff have? How are providers screened? What is the minimum and maximum length of a visit? How do you handle emergencies? Is there a waiting list?

If you cannot find what you need, tell MittenLink. Unsuccessful searches help us identify gaps and look for new resources.`,
  },
  {
    slug: "preparing-for-your-first-iep-meeting", title: "Preparing for Your First IEP Meeting",
    summary: "What an IEP is, who attends, and how parents can prepare and participate as equal members of the team.",
    type: "guide", categories: ["education"], populations: ["families", "caregivers"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 60, minutes: 6,
    body: `An Individualized Education Program (IEP) is a written plan for a student who qualifies for special education services. Parents are equal members of the IEP team.

Before the meeting, ask for copies of evaluation reports and any draft goals. Write down your child's strengths, what is working, and your main concerns.

You can bring someone with you — a friend, relative, or advocate. You can also ask for the meeting to be rescheduled if you need more time to prepare.

During the meeting, ask questions until you understand. It is okay to take the draft home before signing.

Advocacy organizations listed on MittenLink can help you prepare and may attend meetings with you.`,
  },
  {
    slug: "employment-supports-where-to-start", title: "Employment Supports: Where to Start",
    summary: "An overview of job coaching, supported employment, vocational rehabilitation, and workplace accommodations.",
    type: "guide", categories: ["employment"], populations: ["adults", "teens"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 48, minutes: 5,
    body: `Many people with disabilities want to work and can succeed with the right supports. Knowing what is available is the first step.

Vocational rehabilitation programs help eligible people prepare for, find, and keep jobs. Services can include career counseling, training, and assistive technology.

Supported employment and job coaching provide one-on-one help finding a job and learning it, with support that fades over time.

You have the right to request reasonable accommodations at work. Examples include flexible schedules, modified equipment, or written instructions.

If you receive SSI or SSDI, talk with a benefits planner before starting work so you understand how income affects your benefits.`,
  },
  {
    slug: "choosing-assistive-technology", title: "Choosing Assistive Technology: Questions to Ask",
    summary: "A practical checklist for choosing devices that fit your goals, environment, and budget.",
    type: "toolkit", categories: ["assistive-technology"], populations: ["adults", "families", "professionals"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 19, minutes: 4,
    body: `Assistive technology (AT) is any tool that helps a person do something more easily or independently — from a simple jar opener to a speech-generating device.

Start with the task, not the device. What do you want to do? Where will you use it? Who will help set it up and maintain it?

Try before you buy. Loan libraries and demonstration centers let you borrow devices for a trial period.

Ask about training, warranties, repairs, and whether the device works with other technology you use.

Funding may come from insurance, Medicaid, vocational rehabilitation, schools, or reuse programs that offer refurbished equipment at low cost.`,
  },
  {
    slug: "transition-to-adulthood-checklist", title: "Transition to Adulthood Checklist (Ages 14–22)",
    summary: "A year-by-year checklist for families planning the move from school to adult life.",
    type: "toolkit", categories: ["education", "employment", "independent-living"], populations: ["teens", "families"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "pending_review", minutes: 5,
    body: `Planning for adult life can start as early as age 14. Transition planning is part of the IEP process for students receiving special education.

Ages 14–16: explore interests and strengths, try volunteer or work experiences, and include transition goals in the IEP.

Ages 16–18: connect with vocational rehabilitation, learn about adult services, and practice self-advocacy in IEP meetings.

Age 18: consider decision-making supports, apply for adult benefits if eligible, and update health care arrangements.

Ages 18–22: continue school-based transition services if eligible, build work experience, and connect with independent living supports.`,
  },
  {
    slug: "emergency-preparedness-for-people-with-disabilities", title: "Emergency Preparedness for People with Disabilities",
    summary: "How to build an emergency plan and kit that includes your disability-related needs.",
    type: "guide", categories: ["independent-living"], populations: ["adults", "older-adults", "caregivers"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "verified", verifiedDaysAgo: 70, minutes: 5,
    body: `Michigan weather can bring power outages, flooding, and winter storms. A plan that includes your disability-related needs can make a big difference.

Build a support network of people who can check on you. Share your plan and a spare key with someone you trust.

Your kit should include medications, copies of prescriptions, chargers and backup batteries for devices, and information about how you communicate.

If you use power-dependent equipment, contact your utility company to ask about priority programs, and plan for backup power.

Know how you will get emergency alerts, including accessible formats such as text and captioned alerts.`,
  },
  {
    slug: "understanding-medicaid-waivers", title: "Understanding Home and Community-Based Services",
    summary: "An introduction to Medicaid home and community-based services and how to ask about eligibility.",
    type: "benefits", categories: ["financial-assistance", "independent-living"], populations: ["adults", "families", "caregivers"],
    sourceName: "MittenLink editorial team (demonstration content)", areas: ["statewide"], status: "needs_update", verifiedDaysAgo: 220, minutes: 5,
    body: `Home and community-based services (HCBS) are Medicaid-funded supports that help people with disabilities and older adults live at home and in their communities rather than in institutions.

Services may include personal care, respite, home modifications, supported employment, and community living supports. Eligibility rules and available services depend on the specific program.

Some programs have waiting lists. It is often worth applying early even if you do not need services right away.

Your local community mental health agency, area agency on aging, or a benefits counselor can help you understand which programs you might qualify for.

This guide is marked "Needs Update" while MittenLink reviews recent program changes. Always confirm details with official sources.`,
  },
];

export interface EventSeed {
  slug: string;
  title: string;
  org?: string;
  organizer: string;
  type: "workshop" | "support_group" | "webinar" | "recreation" | "community" | "training" | "resource_fair";
  summary: string;
  description: string;
  startInDays: number;
  startHour: number;
  durationHours: number;
  venue?: string;
  street?: string;
  city?: string;
  zip?: string;
  county?: string;
  lat?: number;
  lng?: number;
  inPerson: boolean;
  virtual: boolean;
  registrationUrl?: string;
  cost: string;
  free: boolean;
  accommodations: string;
  categories: string[];
  populations: string[];
  email?: string;
  phone?: string;
  status: VStatus;
  verifiedDaysAgo?: number;
}

export const EVENTS: EventSeed[] = [
  {
    slug: "metro-detroit-disability-resource-fair", title: "Metro Detroit Disability Resource Fair", org: "motor-city-ability-center", organizer: "Motor City Ability Center",
    type: "resource_fair", summary: "Meet more than 40 local providers in one place — employment, transportation, housing, benefits, and more.",
    description: "A free, family-friendly resource fair with provider tables, short workshops, a quiet room, and free accessible parking. Bring questions!",
    startInDays: 12, startHour: 10, durationHours: 4, venue: "Midtown Community Hall", street: "3400 Cass Avenue", city: "Detroit", zip: "48201", county: "Wayne", lat: 42.3478, lng: -83.0628,
    inPerson: true, virtual: false, registrationUrl: "https://motorcityability.example/fair", cost: "Free", free: true,
    accommodations: "ASL interpreters, CART captioning, quiet room, large-print maps, accessible parking. Request other accommodations by one week before.",
    categories: ["employment", "transportation", "housing", "financial-assistance"], populations: ["adults", "families", "caregivers", "professionals"], email: "hello@motorcityability.example", status: "pending_review",
  },
  {
    slug: "iep-basics-webinar", title: "IEP Basics for Michigan Families (Webinar)", org: "river-raisin-disability-advocacy-center", organizer: "River Raisin Disability Advocacy Center",
    type: "webinar", summary: "A one-hour live webinar on preparing for IEP meetings, with time for questions.",
    description: "Learn how IEPs work, how to prepare, and what to do if you disagree. Open to families statewide. Recording provided to registrants.",
    startInDays: 6, startHour: 19, durationHours: 1, inPerson: false, virtual: true, registrationUrl: "https://riverraisinadvocacy.example/iep-webinar", cost: "Free", free: true,
    accommodations: "Live captions and ASL interpretation provided. Slides shared in advance in accessible format.",
    categories: ["education", "legal-advocacy"], populations: ["families", "caregivers"], email: "advocate@riverraisinadvocacy.example", status: "verified", verifiedDaysAgo: 5,
  },
  {
    slug: "bay-city-caregiver-support-group-october", title: "Caregiver Support Group — Bay City", org: "bay-area-caregiver-alliance", organizer: "Bay Area Caregiver Alliance",
    type: "support_group", summary: "A weekly, drop-in support group for family caregivers.",
    description: "Share experiences and practical tips with other caregivers in a welcoming space. Respite care is available on site with advance notice.",
    startInDays: 3, startHour: 18, durationHours: 1.5, venue: "Bay Area Caregiver Alliance", street: "915 Washington Avenue", city: "Bay City", zip: "48708", county: "Bay", lat: 43.5957, lng: -83.8866,
    inPerson: true, virtual: true, cost: "Free", free: true, accommodations: "Accessible building; join by video with captions if you cannot attend in person.",
    categories: ["caregiver-support"], populations: ["caregivers"], phone: "(989) 555-0149", status: "verified", verifiedDaysAgo: 26,
  },
  {
    slug: "kalamazoo-adaptive-sports-day", title: "Adaptive Sports Try-It Day", org: "kalamazoo-accessible-recreation-alliance", organizer: "Kalamazoo Accessible Recreation Alliance",
    type: "recreation", summary: "Try wheelchair basketball, beep baseball, adaptive cycling, and more.",
    description: "A free day to try adaptive sports with coaching and equipment provided. All ages and abilities welcome. Lunch included.",
    startInDays: 17, startHour: 11, durationHours: 4, venue: "Kalamazoo Recreation Center", street: "1300 S Westnedge Avenue", city: "Kalamazoo", zip: "49008", county: "Kalamazoo", lat: 42.2785, lng: -85.5905,
    inPerson: true, virtual: false, registrationUrl: "https://kzooaccessrec.example/try-it", cost: "Free", free: true, accommodations: "Accessible facility, adaptive equipment, quiet area, personal care assistance available on request.",
    categories: ["recreation"], populations: ["children", "teens", "adults", "families"], email: "play@kzooaccessrec.example", status: "verified", verifiedDaysAgo: 18,
  },
  {
    slug: "lansing-assistive-technology-expo", title: "Capital Area Assistive Technology Expo", org: "capital-area-accessibility-network", organizer: "Capital Area Accessibility Network",
    type: "community", summary: "Hands-on demonstrations of the latest assistive technology for home, school, and work.",
    description: "Explore communication devices, smart home tools, vision and hearing technology, and mobility equipment with AT specialists.",
    startInDays: 24, startHour: 13, durationHours: 3, venue: "Lansing Office Community Room", street: "1110 Michigan Avenue", city: "Lansing", zip: "48912", county: "Ingham", lat: 42.7337, lng: -84.5297,
    inPerson: true, virtual: false, cost: "Free", free: true, accommodations: "Hearing loop, ASL interpreters, accessible parking.",
    categories: ["assistive-technology"], populations: ["adults", "families", "professionals", "older-adults"], email: "info@capitalaccess.example", status: "verified", verifiedDaysAgo: 10,
  },
  {
    slug: "grand-rapids-sensory-friendly-family-night", title: "Sensory-Friendly Family Night", org: "west-michigan-autism-family-center", organizer: "West Michigan Autism & Family Center",
    type: "community", summary: "An evening of games, crafts, and connection designed for autistic kids and their families.",
    description: "Low lights, quiet zones, and flexible activities. Siblings welcome. Pizza provided.",
    startInDays: 9, startHour: 17, durationHours: 2, venue: "Grand Rapids Center", street: "1850 Leonard Street NE", city: "Grand Rapids", zip: "49505", county: "Kent", lat: 42.9837, lng: -85.6179,
    inPerson: true, virtual: false, registrationUrl: "https://wmautismfamily.example/family-night", cost: "Free", free: true, accommodations: "Sensory-friendly environment, visual schedule, quiet room.",
    categories: ["autism-services", "recreation"], populations: ["children", "families"], email: "families@wmautismfamily.example", status: "verified", verifiedDaysAgo: 12,
  },
  {
    slug: "flint-job-readiness-workshop", title: "Job Readiness Workshop: Interviews & Accommodations", org: "flint-inclusive-employment-network", organizer: "Flint Inclusive Employment Network",
    type: "workshop", summary: "Practice interviewing and learn how and when to request accommodations.",
    description: "An interactive workshop with mock interviews and guidance on disclosure and accommodations.",
    startInDays: 14, startHour: 10, durationHours: 2, venue: "Downtown Flint Office", street: "432 N Saginaw Street, Suite 200", city: "Flint", zip: "48502", county: "Genesee", lat: 43.0164, lng: -83.6904,
    inPerson: true, virtual: true, cost: "Free", free: true, accommodations: "Elevator access; materials available in large print; virtual option with captions.",
    categories: ["employment"], populations: ["adults", "teens"], phone: "(810) 555-0119", status: "needs_update", verifiedDaysAgo: 402,
  },
  {
    slug: "up-community-resource-fair-marquette", title: "U.P. Community Disability Resource Fair", org: "upper-peninsula-ability-resource-center", organizer: "Upper Peninsula Ability Resource Center",
    type: "resource_fair", summary: "Connect with Upper Peninsula providers, agencies, and support groups.",
    description: "Providers from across the U.P. share information on services, benefits, transportation, and caregiver support.",
    startInDays: 31, startHour: 12, durationHours: 4, venue: "Marquette Office", street: "1015 N Third Street", city: "Marquette", zip: "49855", county: "Marquette", lat: 46.5567, lng: -87.4007,
    inPerson: true, virtual: false, cost: "Free", free: true, accommodations: "Accessible venue, ASL interpretation on request, transportation assistance available.",
    categories: ["independent-living", "caregiver-support", "financial-assistance"], populations: ["adults", "families", "caregivers"], email: "info@upability.example", status: "verified", verifiedDaysAgo: 8,
  },
  {
    slug: "detroit-accessible-art-night", title: "Accessible Art Night", org: "detroit-adaptive-arts-collective", organizer: "Detroit Adaptive Arts Collective",
    type: "recreation", summary: "A relaxed evening of art-making and community for adults with disabilities.",
    description: "Drop in to paint, print, and connect. All materials and adaptive tools provided.",
    startInDays: 5, startHour: 18, durationHours: 2.5, venue: "Eastern Market Studio", street: "2934 Russell Street", city: "Detroit", zip: "48207", county: "Wayne", lat: 42.3478, lng: -83.0412,
    inPerson: true, virtual: false, cost: "Free (donations welcome)", free: true, accommodations: "Step-free studio, adjustable tables, sensory-friendly lighting.",
    categories: ["recreation"], populations: ["adults", "teens"], email: "studio@detroitadaptivearts.example", status: "verified", verifiedDaysAgo: 15,
  },
  {
    slug: "transition-planning-webinar", title: "Planning for Life After High School (Webinar)", org: "great-lakes-independent-living-network", organizer: "Great Lakes Independent Living Network",
    type: "webinar", summary: "A statewide webinar on transition planning, benefits, and adult services.",
    description: "Families and students learn about transition planning timelines, employment supports, and benefits planning.",
    startInDays: 20, startHour: 18, durationHours: 1.5, inPerson: false, virtual: true, registrationUrl: "https://greatlakesiln.example/transition-webinar", cost: "Free", free: true,
    accommodations: "Live captions, ASL interpretation, and accessible slides.", categories: ["education", "employment"], populations: ["teens", "families"], email: "info@greatlakesiln.example", status: "verified", verifiedDaysAgo: 7,
  },
];
