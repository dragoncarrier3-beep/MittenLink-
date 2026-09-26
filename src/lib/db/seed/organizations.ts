// Fictional demonstration organizations placed in real Michigan geography.
// None of these organizations are real providers. Contact details use the
// reserved ".example" domain and 555-01xx telephone numbers.

export type VStatus = "unverified" | "pending_review" | "verified" | "needs_update" | "unable_to_verify" | "archived";
export type Area = "statewide" | { county: string } | { radius: number; city: string };

export interface LocSeed {
  key: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  county: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  primary?: boolean;
  wheelchair?: boolean;
  parking?: boolean;
  transit?: string;
  appointment?: boolean;
  virtual?: boolean;
  hours?: "standard" | "extended" | "limited" | "saturday";
  hoursNote?: string;
  serviceAreaNote?: string;
}

export interface ServiceSeed {
  slug: string;
  title: string;
  summary: string;
  description: string;
  categories: string[];
  populations: string[];
  disabilities?: string[];
  languages?: string[];
  payments?: string[];
  ages?: [number | null, number | null];
  eligibility?: string;
  insuranceNotes?: string;
  referral?: boolean;
  waitlist?: "accepting" | "short_wait" | "waitlist" | "not_accepting";
  inPerson?: boolean;
  virtual?: boolean;
  homeBased?: boolean;
  free?: boolean;
  locations?: string[]; // location keys; default = all org locations
  areas?: Area[];
  status?: VStatus;
  featured?: boolean;
}

export interface OrgSeed {
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: "nonprofit" | "government" | "private_practice" | "healthcare" | "school" | "community_group" | "advocacy" | "faith_based" | "other";
  website: string;
  email: string;
  phone: string;
  accessibility: string;
  languages: string[];
  populations: string[];
  categories: string[];
  disabilities: string[];
  status: VStatus;
  verifiedDaysAgo?: number;
  nextReviewInDays?: number;
  enhanced?: boolean;
  expanded?: string;
  founded?: number;
  publication?: "published" | "pending";
  areas: Area[];
  locations: LocSeed[];
  services: ServiceSeed[];
}

export const ORGANIZATIONS: OrgSeed[] = [
  {
    slug: "great-lakes-independent-living-network",
    title: "Great Lakes Independent Living Network",
    summary: "Peer-led independent living services, assistive technology, and employment support across Southeast, Mid, and West Michigan.",
    description:
      "Great Lakes Independent Living Network is a consumer-directed nonprofit that helps people with disabilities live, work, and participate in their communities on their own terms. Staff and peer mentors — most of whom have lived experience with disability — offer skills training, assistive technology support, benefits planning, and employment services from four regional offices.",
    type: "nonprofit",
    website: "https://greatlakesiln.example",
    email: "info@greatlakesiln.example",
    phone: "(734) 555-0182",
    accessibility:
      "All offices are step-free with automatic doors and accessible restrooms. ASL interpreters and CART captioning are available with 48 hours' notice. Materials are available in large print and accessible digital formats.",
    languages: ["en", "es", "ar", "ase"],
    populations: ["adults", "teens", "older-adults", "families"],
    categories: ["independent-living", "assistive-technology", "employment", "financial-assistance"],
    disabilities: ["physical-mobility", "intellectual-developmental", "blind-low-vision", "deaf-hard-of-hearing", "brain-injury"],
    status: "verified",
    verifiedDaysAgo: 43,
    nextReviewInDays: 12,
    enhanced: true,
    founded: 1994,
    expanded:
      "Since 1994, Great Lakes Independent Living Network has supported more than 20,000 Michiganders with disabilities. Our peer mentoring model pairs each participant with a mentor who understands their experience first-hand. We also operate a regional assistive technology demonstration lab where people can try devices before they buy them, and a benefits planning team that helps people understand how work affects SSI, SSDI, and Medicaid.\n\nEvery service is voluntary and person-directed. There is no cost for most services, and no one is turned away because of inability to pay.",
    areas: [{ county: "Washtenaw" }, { county: "Wayne" }, { county: "Kent" }, { county: "Ingham" }, { county: "Livingston" }, { county: "Oakland" }],
    locations: [
      { key: "a2", name: "Ann Arbor Office", street: "2200 Packard Street, Suite 110", city: "Ann Arbor", zip: "48104", county: "Washtenaw", lat: 42.2563, lng: -83.7248, phone: "(734) 555-0182", primary: true, wheelchair: true, parking: true, transit: "TheRide Route 5 stops in front of the building.", hours: "extended", virtual: true },
      { key: "det", name: "Detroit Office", street: "4750 Woodward Avenue, 3rd Floor", city: "Detroit", zip: "48201", county: "Wayne", lat: 42.3551, lng: -83.0645, phone: "(313) 555-0144", wheelchair: true, parking: false, transit: "QLINE Warren/Mack stop is one block away; DDOT Route 53.", hours: "standard", virtual: true },
      { key: "gr", name: "Grand Rapids Office", street: "1010 Michigan Street NE", city: "Grand Rapids", zip: "49503", county: "Kent", lat: 42.9706, lng: -85.6512, phone: "(616) 555-0127", wheelchair: true, parking: true, transit: "The Rapid Route 2 stops at Michigan & College.", hours: "standard" },
      { key: "lan", name: "Lansing Office", street: "600 W Saginaw Street", city: "Lansing", zip: "48933", county: "Ingham", lat: 42.7473, lng: -84.5608, phone: "(517) 555-0163", wheelchair: true, parking: true, transit: "CATA Route 16 stops nearby.", hours: "standard", appointment: true },
    ],
    services: [
      {
        slug: "glil-independent-living-skills", title: "Independent Living Skills Training",
        summary: "One-on-one and small-group training in budgeting, cooking, household management, and self-advocacy.",
        description: "Participants set their own goals and work with a skills trainer on daily living skills such as budgeting, meal planning, using public transportation, managing appointments, and speaking up for themselves. Training happens at our offices, in the community, or at home.",
        categories: ["independent-living"], populations: ["adults", "teens"], disabilities: ["intellectual-developmental", "physical-mobility", "brain-injury"],
        languages: ["en", "es", "ase"], payments: ["free", "grant-funded"], ages: [16, null], free: true, homeBased: true, virtual: true, waitlist: "accepting",
        eligibility: "Michigan residents age 16 and older with any disability.", featured: true,
      },
      {
        slug: "glil-assistive-technology", title: "Assistive Technology Demonstration & Lending",
        summary: "Try assistive technology before you buy it, borrow devices for up to 30 days, and get training from AT specialists.",
        description: "Our AT specialists help you explore devices for communication, computer access, vision, hearing, mobility, and daily living. Borrow equipment for a 30-day trial and receive hands-on training. We can also help you document needs for funding requests.",
        categories: ["assistive-technology"], populations: ["adults", "older-adults", "children", "families"], disabilities: ["physical-mobility", "blind-low-vision", "deaf-hard-of-hearing", "speech-language"],
        languages: ["en", "es"], payments: ["free"], free: true, virtual: true, waitlist: "short_wait", locations: ["a2", "det", "gr"],
        eligibility: "Open to anyone with a disability, family members, and professionals.", featured: true,
      },
      {
        slug: "glil-employment-support", title: "Supported Employment & Job Coaching",
        summary: "Career exploration, job search help, workplace accommodations, and on-the-job coaching.",
        description: "Employment specialists help job seekers identify strengths, prepare resumes, practice interviews, request reasonable accommodations, and succeed in the first months of a new job with on-site coaching.",
        categories: ["employment"], populations: ["adults", "teens"], disabilities: ["intellectual-developmental", "autism", "physical-mobility", "mental-health-conditions"],
        languages: ["en", "es", "ar"], payments: ["free", "grant-funded"], ages: [16, null], free: true, waitlist: "accepting", locations: ["a2", "det", "lan"],
        eligibility: "Adults and transition-age youth (16+) with disabilities who want competitive, integrated employment.",
      },
      {
        slug: "glil-peer-mentoring", title: "Peer Mentoring",
        summary: "Connect with a trained mentor who has lived experience with disability.",
        description: "Peer mentors offer encouragement, practical tips, and a listening ear. Mentoring can focus on adjusting to a new disability, moving into your own home, or building confidence in the community.",
        categories: ["independent-living", "mental-health"], populations: ["adults", "teens", "older-adults"], languages: ["en", "es", "ase"],
        payments: ["free"], free: true, virtual: true, waitlist: "accepting",
      },
      {
        slug: "glil-benefits-planning", title: "Work Incentives Benefits Planning",
        summary: "Understand how earning income affects SSI, SSDI, Medicaid, and other benefits.",
        description: "Certified benefits planners explain work incentives, help you report earnings correctly, and build a personalized plan so you can work without unexpected loss of benefits. Available statewide by phone and video.",
        categories: ["financial-assistance", "employment"], populations: ["adults", "families"], languages: ["en", "es"],
        payments: ["free"], free: true, virtual: true, inPerson: false, waitlist: "short_wait", areas: ["statewide"],
        eligibility: "People who receive SSI or SSDI and are working or considering work.",
      },
    ],
  },
  {
    slug: "motor-city-ability-center",
    title: "Motor City Ability Center",
    summary: "Mobility support, employment services, and transportation navigation for Detroit-area residents with disabilities.",
    description:
      "Motor City Ability Center helps Detroiters with disabilities get where they need to go — to work, school, appointments, and community life. Services include mobility training, wheelchair maintenance clinics, employment services, and one-on-one help navigating paratransit and accessible transit options.",
    type: "nonprofit",
    website: "https://motorcityability.example",
    email: "hello@motorcityability.example",
    phone: "(313) 555-0110",
    accessibility: "Ground-floor entrance with power-assisted doors. Accessible van-parking spaces. Staff are trained in plain-language communication; Arabic and Bengali interpretation available.",
    languages: ["en", "ar", "bn", "es"],
    populations: ["adults", "older-adults", "teens"],
    categories: ["transportation", "employment", "independent-living"],
    disabilities: ["physical-mobility", "blind-low-vision", "intellectual-developmental"],
    status: "verified",
    verifiedDaysAgo: 21,
    nextReviewInDays: 160,
    founded: 2006,
    areas: [{ county: "Wayne" }],
    locations: [
      { key: "mid", name: "Midtown Center", street: "3400 Cass Avenue", city: "Detroit", zip: "48201", county: "Wayne", lat: 42.3478, lng: -83.0628, primary: true, wheelchair: true, parking: true, transit: "DDOT Routes 16 and 53; QLINE Canfield stop.", hours: "standard" },
      { key: "dbn", name: "Dearborn Satellite Office", street: "13615 Michigan Avenue", city: "Dearborn", zip: "48126", county: "Wayne", lat: 42.3226, lng: -83.1822, phone: "(313) 555-0121", wheelchair: true, parking: true, transit: "SMART Route 200 stops on Michigan Avenue.", hours: "limited", appointment: true },
    ],
    services: [
      {
        slug: "mcac-mobility-support", title: "Mobility Support & Training",
        summary: "Orientation to mobility devices, safe community travel practice, and fall-prevention coaching.",
        description: "Mobility trainers work with you to use wheelchairs, walkers, and other devices safely at home and in the community, including curb cuts, ramps, and transit boarding.",
        categories: ["transportation", "independent-living"], populations: ["adults", "older-adults"], disabilities: ["physical-mobility", "blind-low-vision"],
        languages: ["en", "ar", "bn"], payments: ["medicaid", "free"], waitlist: "accepting", homeBased: true, eligibility: "Wayne County residents age 18 and older.", ages: [18, null],
      },
      {
        slug: "mcac-employment-services", title: "Employment Services",
        summary: "Job readiness workshops, placement assistance, and follow-along support.",
        description: "Weekly job readiness workshops, one-on-one placement help, and follow-along support after you are hired. Partnerships with Detroit employers committed to inclusive hiring.",
        categories: ["employment"], populations: ["adults", "teens"], languages: ["en", "ar", "es"], payments: ["free"], free: true, waitlist: "accepting", ages: [17, null],
      },
      {
        slug: "mcac-transportation-navigation", title: "Transportation Navigation",
        summary: "Personal help applying for paratransit, planning accessible routes, and solving transportation barriers.",
        description: "Navigators help with paratransit applications and appeals, trip planning on accessible fixed-route buses, and connecting to volunteer driver and medical transportation options.",
        categories: ["transportation"], populations: ["adults", "older-adults", "caregivers"], languages: ["en", "ar", "bn", "es"], payments: ["free"], free: true, virtual: true, waitlist: "accepting",
      },
      {
        slug: "mcac-wheelchair-repair-clinic", title: "Wheelchair Repair Clinic",
        summary: "Monthly clinic for minor wheelchair and scooter repairs and maintenance.",
        description: "Certified technicians perform minor repairs, tire replacement, and safety checks on manual and power wheelchairs. Parts may be available at low or no cost. Walk-ins welcome; appointments preferred.",
        categories: ["assistive-technology", "transportation"], populations: ["adults", "older-adults", "children"], disabilities: ["physical-mobility"],
        payments: ["free", "sliding-scale"], waitlist: "accepting", locations: ["mid"], eligibility: "Open to all wheelchair and scooter users.",
      },
    ],
  },
  {
    slug: "west-michigan-autism-family-center",
    title: "West Michigan Autism & Family Center",
    summary: "Family-centered autism support, pediatric occupational therapy, and parent education in Grand Rapids and Holland.",
    description:
      "West Michigan Autism & Family Center partners with autistic children, teens, and their families. The Center offers occupational therapy, social connection groups, and a parent education series, all built around each family's goals. Services are neurodiversity-affirming and sensory-friendly.",
    type: "nonprofit",
    website: "https://wmautismfamily.example",
    email: "families@wmautismfamily.example",
    phone: "(616) 555-0139",
    accessibility: "Sensory-friendly waiting rooms with low lighting and quiet spaces. Visual schedules available. Step-free entrances at both locations. Spanish-speaking staff at the Holland location.",
    languages: ["en", "es"],
    populations: ["children", "teens", "families", "caregivers"],
    categories: ["autism-services", "therapy-services", "education", "caregiver-support"],
    disabilities: ["autism", "intellectual-developmental", "speech-language"],
    status: "verified",
    verifiedDaysAgo: 178,
    nextReviewInDays: 2,
    enhanced: true,
    founded: 2011,
    expanded:
      "Our multidisciplinary team includes occupational therapists, family navigators, and autistic self-advocates who help shape our programs. Families tell us the most valuable thing we offer is time — unhurried appointments where questions are welcome.\n\nWe accept Medicaid and most major commercial insurance plans, and offer a sliding scale for families without coverage.",
    areas: [{ county: "Kent" }, { county: "Ottawa" }, { county: "Allegan" }],
    locations: [
      { key: "gr", name: "Grand Rapids Center", street: "1850 Leonard Street NE", city: "Grand Rapids", zip: "49505", county: "Kent", lat: 42.9837, lng: -85.6179, primary: true, wheelchair: true, parking: true, transit: "The Rapid Route 13 stops at Leonard & Fuller.", hours: "saturday" },
      { key: "hol", name: "Holland Family Office", street: "455 E 8th Street", city: "Holland", zip: "49423", county: "Ottawa", lat: 42.7896, lng: -86.0934, phone: "(616) 555-0148", wheelchair: true, parking: true, transit: "MAX Route 5 stops nearby.", hours: "standard", appointment: true },
    ],
    services: [
      {
        slug: "wmafc-autism-family-support", title: "Autism Family Support & Navigation",
        summary: "A family navigator helps you understand options after an autism diagnosis and connect with services.",
        description: "Family navigators meet with parents and caregivers to explain next steps, school supports, insurance coverage, and community resources. Navigation is free and available in English and Spanish.",
        categories: ["autism-services", "caregiver-support"], populations: ["families", "caregivers", "children"], disabilities: ["autism"],
        languages: ["en", "es"], payments: ["free"], free: true, virtual: true, waitlist: "accepting", featured: true,
      },
      {
        slug: "wmafc-pediatric-occupational-therapy", title: "Pediatric Occupational Therapy",
        summary: "Occupational therapy for sensory processing, fine motor skills, and daily routines.",
        description: "Licensed occupational therapists support children with sensory processing, feeding, handwriting, dressing, and self-regulation using play-based, family-centered approaches.",
        categories: ["therapy-services", "autism-services"], populations: ["children", "teens"], disabilities: ["autism", "intellectual-developmental", "physical-mobility"],
        languages: ["en", "es"], payments: ["medicaid", "private-insurance", "sliding-scale"], ages: [2, 17], referral: true, waitlist: "waitlist",
        insuranceNotes: "Accepts Medicaid and most commercial plans. A physician referral is required by many insurers.", featured: true,
      },
      {
        slug: "wmafc-parent-education", title: "Parent Education Series",
        summary: "Evening workshops on communication, behavior support, IEPs, and caregiver well-being.",
        description: "A rotating series of free evening workshops for parents and caregivers. Topics include understanding sensory needs, preparing for IEP meetings, and caring for yourself as a caregiver. Childcare available on site.",
        categories: ["education", "caregiver-support", "autism-services"], populations: ["families", "caregivers"], languages: ["en", "es"], payments: ["free"], free: true, virtual: true, waitlist: "accepting",
      },
      {
        slug: "wmafc-teen-social-groups", title: "Teen Social Connection Groups",
        summary: "Interest-based groups where autistic teens build friendships and confidence.",
        description: "Small groups organized around shared interests such as gaming, art, and cooking, facilitated by staff and autistic mentors.",
        categories: ["autism-services", "recreation"], populations: ["teens"], disabilities: ["autism"], languages: ["en"], payments: ["sliding-scale", "private-insurance"], ages: [13, 19], waitlist: "short_wait", locations: ["gr"],
      },
    ],
  },
  {
    slug: "capital-area-accessibility-network",
    title: "Capital Area Accessibility Network",
    summary: "Accessibility advocacy, independent living services, and assistive technology for Greater Lansing.",
    description:
      "Capital Area Accessibility Network works to make the Lansing region more accessible for everyone. The Network provides independent living services and assistive technology assessments, and partners with local governments and businesses on accessibility reviews.",
    type: "advocacy",
    website: "https://capitalaccess.example",
    email: "info@capitalaccess.example",
    phone: "(517) 555-0171",
    accessibility: "Step-free entrance, accessible restroom, hearing loop in the meeting room. ASL interpretation available by request.",
    languages: ["en", "es", "ase"],
    populations: ["adults", "older-adults", "professionals"],
    categories: ["legal-advocacy", "independent-living", "assistive-technology", "housing"],
    disabilities: ["physical-mobility", "blind-low-vision", "deaf-hard-of-hearing"],
    status: "verified",
    verifiedDaysAgo: 64,
    nextReviewInDays: 116,
    areas: [{ county: "Ingham" }, { county: "Eaton" }, { county: "Clinton" }],
    locations: [
      { key: "lan", name: "Lansing Office", street: "1110 Michigan Avenue", city: "Lansing", zip: "48912", county: "Ingham", lat: 42.7337, lng: -84.5297, primary: true, wheelchair: true, parking: true, transit: "CATA Route 1 stops in front.", hours: "standard" },
      { key: "el", name: "East Lansing Community Room", street: "819 Abbot Road", city: "East Lansing", zip: "48823", county: "Ingham", lat: 42.7412, lng: -84.4836, wheelchair: true, parking: false, transit: "CATA Route 1 and 20.", hours: "limited", appointment: true },
    ],
    services: [
      {
        slug: "caan-accessibility-advocacy", title: "Accessibility Advocacy",
        summary: "Help resolving accessibility barriers in public places, housing, and services.",
        description: "Advocates help individuals document and resolve accessibility barriers, understand their rights, and communicate with businesses, landlords, and public agencies.",
        categories: ["legal-advocacy"], populations: ["adults", "older-adults"], languages: ["en", "es", "ase"], payments: ["free"], free: true, virtual: true, waitlist: "accepting",
      },
      {
        slug: "caan-independent-living", title: "Independent Living Services",
        summary: "Goal-based support to live independently, including housing search and skills training.",
        description: "Staff help with independent living goals such as finding accessible housing, applying for assistance programs, and learning new skills.",
        categories: ["independent-living", "housing"], populations: ["adults", "older-adults"], languages: ["en", "es"], payments: ["free"], free: true, homeBased: true, waitlist: "accepting",
      },
      {
        slug: "caan-at-assessments", title: "Assistive Technology Assessments",
        summary: "Individual assessments to match people with the right technology for home, school, or work.",
        description: "An AT specialist evaluates your needs and recommends devices and software, with written reports that can support funding requests.",
        categories: ["assistive-technology"], populations: ["adults", "teens", "older-adults"], disabilities: ["physical-mobility", "blind-low-vision", "learning-disabilities"],
        languages: ["en"], payments: ["medicaid", "private-insurance", "sliding-scale"], waitlist: "short_wait", locations: ["lan"],
      },
      {
        slug: "caan-home-accessibility-consults", title: "Home Accessibility Consultations",
        summary: "In-home review of ramps, bathrooms, and doorways with practical modification recommendations.",
        description: "A trained consultant visits your home to recommend modifications such as ramps, grab bars, and doorway widening, and connects you with funding options.",
        categories: ["housing", "independent-living"], populations: ["adults", "older-adults", "families"], disabilities: ["physical-mobility"], languages: ["en"], payments: ["free", "grant-funded"], free: true, homeBased: true, inPerson: false, waitlist: "waitlist",
      },
    ],
  },
  {
    slug: "northern-michigan-family-support-collaborative",
    title: "Northern Michigan Family Support Collaborative",
    summary: "Family navigation, caregiver support groups, and respite coordination for families in Northwest Michigan.",
    description:
      "Northern Michigan Family Support Collaborative connects families raising children and adults with disabilities to resources across the Grand Traverse region and the Northern Lower Peninsula. Family navigators, caregiver support groups, and respite coordination help families stay connected and supported.",
    type: "nonprofit",
    website: "https://northernfamilysupport.example",
    email: "connect@northernfamilysupport.example",
    phone: "(231) 555-0158",
    accessibility: "Main office is on the ground floor with an accessible entrance and restroom. Home visits available throughout the service area.",
    languages: ["en"],
    populations: ["families", "caregivers", "children", "adults"],
    categories: ["caregiver-support", "respite-care", "education"],
    disabilities: ["intellectual-developmental", "autism", "chronic-health"],
    status: "pending_review",
    areas: [{ county: "Grand Traverse" }, { county: "Leelanau" }, { county: "Benzie" }, { county: "Antrim" }, { county: "Kalkaska" }, { county: "Emmet" }, { county: "Charlevoix" }],
    locations: [
      { key: "tc", name: "Traverse City Office", street: "1209 E Eighth Street", city: "Traverse City", zip: "49686", county: "Grand Traverse", lat: 44.7582, lng: -85.5967, primary: true, wheelchair: true, parking: true, transit: "BATA Route 3 stops nearby.", hours: "standard" },
      { key: "pet", name: "Petoskey Outreach Office", street: "420 Mitchell Street", city: "Petoskey", zip: "49770", county: "Emmet", lat: 45.3727, lng: -84.9517, wheelchair: true, parking: true, hours: "limited", appointment: true },
    ],
    services: [
      {
        slug: "nmfsc-family-navigation", title: "Family Resource Navigation",
        summary: "A navigator helps families find and apply for services, supports, and funding.",
        description: "Navigators help families understand eligibility for local and statewide programs, fill out applications, and prepare for meetings with schools and agencies.",
        categories: ["caregiver-support", "education"], populations: ["families", "caregivers"], languages: ["en"], payments: ["free"], free: true, virtual: true, homeBased: true, waitlist: "accepting", status: "pending_review",
      },
      {
        slug: "nmfsc-caregiver-support-groups", title: "Caregiver Support Groups",
        summary: "Monthly peer support groups for parents and family caregivers.",
        description: "Facilitated monthly groups in Traverse City and Petoskey, plus a virtual evening group, where caregivers share experiences and practical tips.",
        categories: ["caregiver-support", "mental-health"], populations: ["caregivers", "families"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "accepting", status: "pending_review",
      },
      {
        slug: "nmfsc-respite-coordination", title: "Respite Care Coordination",
        summary: "Matching families with trained respite providers for short-term breaks.",
        description: "Coordinators match families with screened respite providers and help families use respite funding they may be eligible for.",
        categories: ["respite-care", "caregiver-support"], populations: ["caregivers", "families", "children", "adults"], languages: ["en"], payments: ["medicaid-waiver", "grant-funded", "sliding-scale"], homeBased: true, waitlist: "waitlist", status: "pending_review",
      },
    ],
  },
  {
    slug: "upper-peninsula-ability-resource-center",
    title: "Upper Peninsula Ability Resource Center",
    summary: "Independent living, benefits counseling, assistive technology, and caregiver support across the Upper Peninsula.",
    description:
      "Upper Peninsula Ability Resource Center serves people with disabilities and their families across the U.P. from offices in Marquette, Escanaba, and Houghton. Because distances are long, many services are offered by phone, video, and home visit.",
    type: "nonprofit",
    website: "https://upability.example",
    email: "info@upability.example",
    phone: "(906) 555-0133",
    accessibility: "All offices are accessible. Home visits and virtual appointments available throughout the Upper Peninsula.",
    languages: ["en"],
    populations: ["adults", "older-adults", "families", "caregivers", "veterans"],
    categories: ["independent-living", "financial-assistance", "assistive-technology", "caregiver-support", "autism-services"],
    disabilities: ["physical-mobility", "intellectual-developmental", "brain-injury", "autism"],
    status: "verified",
    verifiedDaysAgo: 35,
    nextReviewInDays: 145,
    areas: [{ county: "Marquette" }, { county: "Delta" }, { county: "Houghton" }, { county: "Alger" }, { county: "Baraga" }, { county: "Dickinson" }, { county: "Menominee" }, { county: "Schoolcraft" }, { county: "Keweenaw" }],
    locations: [
      { key: "mqt", name: "Marquette Office", street: "1015 N Third Street", city: "Marquette", zip: "49855", county: "Marquette", lat: 46.5567, lng: -87.4007, primary: true, wheelchair: true, parking: true, transit: "MARQ-TRAN Route 1.", hours: "standard", virtual: true },
      { key: "esc", name: "Escanaba Office", street: "1400 Ludington Street", city: "Escanaba", zip: "49829", county: "Delta", lat: 45.7456, lng: -87.0783, wheelchair: true, parking: true, hours: "standard" },
      { key: "hou", name: "Houghton Office", street: "600 Sheldon Avenue", city: "Houghton", zip: "49931", county: "Houghton", lat: 47.1216, lng: -88.5696, wheelchair: true, parking: false, hours: "limited", appointment: true },
    ],
    services: [
      {
        slug: "upar-independent-living", title: "Independent Living Services",
        summary: "Skills training, advocacy, and peer support for independent living in rural communities.",
        description: "Staff help with independent living goals, including in-home skills training, advocacy, and peer support for people living in rural communities.",
        categories: ["independent-living"], populations: ["adults", "older-adults"], languages: ["en"], payments: ["free"], free: true, homeBased: true, virtual: true, waitlist: "accepting",
      },
      {
        slug: "upar-benefits-counseling", title: "Benefits Counseling",
        summary: "Help understanding SSI, SSDI, Medicaid, and Medicare, and how work affects benefits.",
        description: "Benefits counselors explain eligibility and reporting rules and help people apply, appeal, and plan for work.",
        categories: ["financial-assistance"], populations: ["adults", "older-adults", "veterans"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "short_wait",
      },
      {
        slug: "upar-assistive-technology", title: "Assistive Technology Services",
        summary: "AT loans, demonstrations, and training delivered in the office or at home.",
        description: "Borrow devices, try equipment, and receive training in the office or at home. Remote demonstrations available.",
        categories: ["assistive-technology"], populations: ["adults", "older-adults", "children"], languages: ["en"], payments: ["free"], free: true, homeBased: true, waitlist: "accepting", locations: ["mqt", "esc"],
      },
      {
        slug: "upar-caregiver-support-network", title: "U.P. Caregiver Support Network",
        summary: "Virtual and in-person support groups and training for family caregivers across the U.P.",
        description: "A network of caregiver support groups meeting in Marquette, Escanaba, and online, with quarterly caregiver skills trainings.",
        categories: ["caregiver-support"], populations: ["caregivers", "families"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "accepting",
      },
      {
        slug: "upar-adult-autism-services", title: "Adult Autism Support Services",
        summary: "Skills groups, employment readiness, and community connection for autistic adults.",
        description: "Small-group and individual support for autistic adults focused on community connection, employment readiness, and self-advocacy.",
        categories: ["autism-services", "employment"], populations: ["adults"], disabilities: ["autism"], languages: ["en"], payments: ["medicaid", "sliding-scale"], ages: [18, null], waitlist: "waitlist", locations: ["mqt"],
      },
    ],
  },
  {
    slug: "flint-inclusive-employment-network",
    title: "Flint Inclusive Employment Network",
    summary: "Supported employment, job coaching, and employer training for Genesee County job seekers with disabilities.",
    description:
      "Flint Inclusive Employment Network connects job seekers with disabilities to meaningful work and helps local employers build inclusive workplaces. Services include supported employment, job coaching, and youth transition programs.",
    type: "nonprofit",
    website: "https://flintinclusivework.example",
    email: "jobs@flintinclusivework.example",
    phone: "(810) 555-0119",
    accessibility: "Elevator access to second-floor office. Accessible parking in rear lot.",
    languages: ["en", "es"],
    populations: ["adults", "teens", "professionals"],
    categories: ["employment", "education"],
    disabilities: ["intellectual-developmental", "autism", "mental-health-conditions", "learning-disabilities"],
    status: "needs_update",
    verifiedDaysAgo: 402,
    nextReviewInDays: -37,
    areas: [{ county: "Genesee" }],
    locations: [
      { key: "flint", name: "Downtown Flint Office", street: "432 N Saginaw Street, Suite 200", city: "Flint", zip: "48502", county: "Genesee", lat: 43.0164, lng: -83.6904, primary: true, wheelchair: true, parking: true, transit: "MTA Route 1 at Downtown Transit Center.", hours: "standard" },
    ],
    services: [
      {
        slug: "fien-supported-employment", title: "Supported Employment",
        summary: "Individualized help finding and keeping competitive employment.",
        description: "Employment specialists help job seekers find jobs that match their interests and provide ongoing support to keep them.",
        categories: ["employment"], populations: ["adults"], languages: ["en", "es"], payments: ["medicaid", "free"], waitlist: "accepting", status: "needs_update",
      },
      {
        slug: "fien-job-coaching", title: "Job Coaching",
        summary: "On-the-job coaching to learn tasks and build workplace routines.",
        description: "Job coaches provide on-site support while new employees learn job tasks, gradually fading support as confidence grows.",
        categories: ["employment"], populations: ["adults", "teens"], languages: ["en"], payments: ["medicaid"], waitlist: "short_wait", status: "needs_update",
      },
      {
        slug: "fien-youth-transition", title: "Youth Transition Employment Program",
        summary: "Work experience and career exploration for students ages 14–24.",
        description: "Paid work experiences, job shadowing, and workplace readiness training for students and young adults with disabilities.",
        categories: ["employment", "education"], populations: ["teens", "adults"], languages: ["en", "es"], payments: ["free", "grant-funded"], free: true, ages: [14, 24], waitlist: "accepting", status: "needs_update",
      },
      {
        slug: "fien-employer-training", title: "Employer Disability Inclusion Training",
        summary: "Workshops for employers on accommodations and inclusive hiring.",
        description: "Practical workshops for Genesee County employers on accommodations, accessible hiring practices, and supporting employees with disabilities.",
        categories: ["employment", "legal-advocacy"], populations: ["professionals"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "accepting", status: "needs_update",
      },
    ],
  },
  {
    slug: "kalamazoo-accessible-recreation-alliance",
    title: "Kalamazoo Accessible Recreation Alliance",
    summary: "Adaptive sports, inclusive camps, and accessible arts programs for all ages in Kalamazoo County.",
    description:
      "Kalamazoo Accessible Recreation Alliance believes everyone deserves to play. The Alliance offers adaptive sports leagues, an inclusive summer day camp, and an accessible arts studio, with adaptive equipment available at no cost.",
    type: "nonprofit",
    website: "https://kzooaccessrec.example",
    email: "play@kzooaccessrec.example",
    phone: "(269) 555-0152",
    accessibility: "Fully accessible facilities, adaptive equipment library, quiet room, and trained inclusion staff at every program.",
    languages: ["en", "es"],
    populations: ["children", "teens", "adults", "families"],
    categories: ["recreation"],
    disabilities: ["physical-mobility", "intellectual-developmental", "autism", "blind-low-vision"],
    status: "verified",
    verifiedDaysAgo: 18,
    nextReviewInDays: 162,
    enhanced: true,
    expanded: "From wheelchair basketball to sensory-friendly art nights, our programs are designed with participants — not just for them. Scholarships are available for every program so cost is never a barrier.",
    areas: [{ county: "Kalamazoo" }, { county: "Van Buren" }, { county: "Calhoun" }],
    locations: [
      { key: "kzoo", name: "Kalamazoo Recreation Center", street: "1300 S Westnedge Avenue", city: "Kalamazoo", zip: "49008", county: "Kalamazoo", lat: 42.2785, lng: -85.5905, primary: true, wheelchair: true, parking: true, transit: "Metro Route 3 stops at the entrance.", hours: "saturday" },
      { key: "port", name: "Portage Arts Studio", street: "7800 Shaver Road", city: "Portage", zip: "49024", county: "Kalamazoo", lat: 42.2129, lng: -85.5842, wheelchair: true, parking: true, hours: "limited" },
    ],
    services: [
      {
        slug: "kara-adaptive-sports", title: "Adaptive Sports Leagues",
        summary: "Wheelchair basketball, adaptive soccer, and beep baseball for youth and adults.",
        description: "Seasonal leagues with adaptive equipment provided, coached by trained volunteers and athletes with disabilities.",
        categories: ["recreation"], populations: ["children", "teens", "adults"], disabilities: ["physical-mobility", "blind-low-vision"], languages: ["en"], payments: ["sliding-scale", "free"], waitlist: "accepting", locations: ["kzoo"], featured: true,
      },
      {
        slug: "kara-inclusive-summer-camp", title: "Inclusive Summer Day Camp",
        summary: "A summer day camp where kids with and without disabilities play together.",
        description: "Eight weeks of inclusive summer camp with 1:3 staff ratios, sensory breaks, and personal care support available.",
        categories: ["recreation", "autism-services"], populations: ["children", "families"], disabilities: ["autism", "intellectual-developmental"], languages: ["en", "es"], payments: ["sliding-scale", "medicaid-waiver"], ages: [5, 14], waitlist: "waitlist", locations: ["kzoo"],
      },
      {
        slug: "kara-accessible-arts-studio", title: "Accessible Arts Studio",
        summary: "Open studio time and classes in painting, ceramics, and music with adaptive tools.",
        description: "Weekly classes and open studio sessions with adaptive art tools, sensory-friendly nights, and exhibitions of participant work.",
        categories: ["recreation"], populations: ["teens", "adults", "older-adults"], languages: ["en"], payments: ["sliding-scale"], waitlist: "accepting", locations: ["port"],
      },
    ],
  },
  {
    slug: "oakland-pathways-disability-resource-center",
    title: "Oakland Pathways Disability Resource Center",
    summary: "Benefits navigation, housing search assistance, and independent living support in Oakland County.",
    description:
      "Oakland Pathways helps Oakland County residents with disabilities navigate benefits, find accessible housing, and build independent living skills. Offices in Pontiac and Troy.",
    type: "nonprofit",
    website: "https://oaklandpathways.example",
    email: "info@oaklandpathways.example",
    phone: "(248) 555-0166",
    accessibility: "Accessible entrances and restrooms; hearing loop at the Pontiac office.",
    languages: ["en", "ar", "sq", "es"],
    populations: ["adults", "older-adults", "families"],
    categories: ["financial-assistance", "housing", "independent-living"],
    disabilities: ["physical-mobility", "mental-health-conditions", "intellectual-developmental"],
    status: "verified",
    verifiedDaysAgo: 52,
    nextReviewInDays: 128,
    areas: [{ county: "Oakland" }],
    locations: [
      { key: "pon", name: "Pontiac Office", street: "51 W Huron Street", city: "Pontiac", zip: "48342", county: "Oakland", lat: 42.6375, lng: -83.2935, primary: true, wheelchair: true, parking: true, transit: "SMART Route 450/460.", hours: "standard" },
      { key: "troy", name: "Troy Office", street: "2600 W Big Beaver Road", city: "Troy", zip: "48084", county: "Oakland", lat: 42.5617, lng: -83.1817, wheelchair: true, parking: true, hours: "standard", appointment: true },
    ],
    services: [
      { slug: "opdrc-benefits-navigation", title: "Benefits Navigation", summary: "Help applying for SSI, SSDI, Medicaid, and food assistance.", description: "Navigators help complete applications, gather documents, and prepare for appeals.", categories: ["financial-assistance"], populations: ["adults", "older-adults", "families"], languages: ["en", "ar", "sq"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
      { slug: "opdrc-housing-search", title: "Accessible Housing Search Assistance", summary: "Help finding accessible, affordable rental housing.", description: "Housing specialists help search for accessible units, complete applications, and request reasonable accommodations from landlords.", categories: ["housing"], populations: ["adults", "older-adults", "families"], languages: ["en", "ar", "es"], payments: ["free"], free: true, waitlist: "short_wait" },
      { slug: "opdrc-independent-living", title: "Independent Living Skills", summary: "Skills training and peer support to live independently.", description: "Individual and group skills training in budgeting, cooking, and self-advocacy.", categories: ["independent-living"], populations: ["adults", "teens"], languages: ["en"], payments: ["free"], free: true, homeBased: true, waitlist: "accepting", locations: ["pon"] },
    ],
  },
  {
    slug: "macomb-family-autism-partners",
    title: "Macomb Family Autism Partners",
    summary: "Parent support, diagnostic navigation, and in-home respite for Macomb County families of autistic children.",
    description:
      "Macomb Family Autism Partners is a parent-founded organization supporting families of autistic children and young adults through navigation, parent-to-parent support, and in-home respite.",
    type: "community_group",
    website: "https://macombautismpartners.example",
    email: "support@macombautismpartners.example",
    phone: "(586) 555-0174",
    accessibility: "Accessible entrance; sensory-friendly family room.",
    languages: ["en", "ar"],
    populations: ["children", "teens", "families", "caregivers"],
    categories: ["autism-services", "caregiver-support", "respite-care"],
    disabilities: ["autism"],
    status: "verified",
    verifiedDaysAgo: 88,
    nextReviewInDays: 30,
    areas: [{ county: "Macomb" }],
    locations: [
      { key: "sh", name: "Sterling Heights Family Center", street: "35000 Van Dyke Avenue", city: "Sterling Heights", zip: "48312", county: "Macomb", lat: 42.5539, lng: -83.0282, primary: true, wheelchair: true, parking: true, transit: "SMART Route 510.", hours: "standard" },
    ],
    services: [
      { slug: "mfap-diagnostic-navigation", title: "Autism Diagnostic Navigation", summary: "Guidance on getting an evaluation and understanding results.", description: "Parent navigators explain evaluation options, insurance coverage, and what to expect, and help families prepare questions.", categories: ["autism-services"], populations: ["families", "children"], disabilities: ["autism"], languages: ["en", "ar"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
      { slug: "mfap-parent-support", title: "Parent-to-Parent Support", summary: "Connect with a trained parent mentor who has walked a similar path.", description: "Trained parent mentors offer one-on-one support by phone, video, or in person.", categories: ["caregiver-support", "autism-services"], populations: ["families", "caregivers"], languages: ["en", "ar"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
      { slug: "mfap-in-home-respite", title: "In-Home Respite for Families", summary: "Trained respite workers provide short-term care at home.", description: "Screened and trained respite workers provide care in the family home so caregivers can rest, run errands, or attend appointments.", categories: ["respite-care", "caregiver-support"], populations: ["families", "caregivers", "children", "teens"], disabilities: ["autism"], languages: ["en"], payments: ["medicaid-waiver", "sliding-scale"], homeBased: true, inPerson: false, waitlist: "waitlist", ages: [3, 26] },
    ],
  },
  {
    slug: "saginaw-valley-deaf-hard-of-hearing-services",
    title: "Saginaw Valley Deaf & Hard of Hearing Services",
    summary: "Interpreter referral, hearing assistive technology, and community programs for Deaf and hard of hearing residents.",
    description:
      "Saginaw Valley Deaf & Hard of Hearing Services supports Deaf, DeafBlind, and hard of hearing people in the Great Lakes Bay Region with interpreter referral, hearing technology, ASL classes, and community events.",
    type: "nonprofit",
    website: "https://svdhh.example",
    email: "info@svdhh.example",
    phone: "(989) 555-0125",
    accessibility: "Staff fluent in ASL; video phone available; visual alert systems throughout the building.",
    languages: ["en", "ase"],
    populations: ["adults", "children", "families", "older-adults", "professionals"],
    categories: ["deaf-hard-of-hearing", "assistive-technology", "education"],
    disabilities: ["deaf-hard-of-hearing"],
    status: "verified",
    verifiedDaysAgo: 171,
    nextReviewInDays: 9,
    areas: [{ county: "Saginaw" }, { county: "Bay" }, { county: "Midland" }, { county: "Tuscola" }],
    locations: [
      { key: "sag", name: "Saginaw Office", street: "1600 N Michigan Avenue", city: "Saginaw", zip: "48602", county: "Saginaw", lat: 43.4389, lng: -83.9577, primary: true, wheelchair: true, parking: true, transit: "STARS Route 2.", hours: "standard" },
    ],
    services: [
      { slug: "svdhh-interpreter-referral", title: "ASL Interpreter Referral", summary: "Referral to qualified ASL interpreters for appointments and events.", description: "Coordinates qualified interpreters for medical, legal, educational, and community settings.", categories: ["deaf-hard-of-hearing"], populations: ["adults", "families", "professionals"], languages: ["ase", "en"], payments: ["self-pay", "sliding-scale"], virtual: true, waitlist: "accepting" },
      { slug: "svdhh-hearing-technology", title: "Hearing Assistive Technology", summary: "Demonstrations and loans of amplified phones, alerting devices, and listening systems.", description: "Try and borrow hearing assistive technology, with help applying for equipment distribution programs.", categories: ["assistive-technology", "deaf-hard-of-hearing"], populations: ["adults", "older-adults"], languages: ["en", "ase"], payments: ["free"], free: true, waitlist: "accepting" },
      { slug: "svdhh-asl-classes", title: "Community ASL Classes", summary: "Beginner and intermediate American Sign Language classes.", description: "Eight-week ASL classes taught by Deaf instructors for families, professionals, and community members.", categories: ["education", "deaf-hard-of-hearing"], populations: ["families", "adults", "professionals", "children"], languages: ["ase", "en"], payments: ["sliding-scale"], waitlist: "accepting" },
    ],
  },
  {
    slug: "lakeshore-supported-living-services",
    title: "Lakeshore Supported Living Services",
    summary: "Supported living and housing coaching for adults with intellectual and developmental disabilities in Muskegon County.",
    description:
      "Lakeshore Supported Living Services provides person-centered supported living services and housing coaching so adults with intellectual and developmental disabilities can live in homes of their choosing.",
    type: "nonprofit",
    website: "https://lakeshoresupportedliving.example",
    email: "info@lakeshoresupportedliving.example",
    phone: "(231) 555-0187",
    accessibility: "Office entrance is accessible. Most services are delivered in participants' homes.",
    languages: ["en"],
    populations: ["adults"],
    categories: ["housing", "independent-living"],
    disabilities: ["intellectual-developmental"],
    status: "unverified",
    areas: [{ county: "Muskegon" }, { county: "Oceana" }],
    locations: [
      { key: "musk", name: "Muskegon Office", street: "880 Terrace Street", city: "Muskegon", zip: "49440", county: "Muskegon", lat: 43.2333, lng: -86.2446, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "lsls-supported-living", title: "Supported Living Services", summary: "Individualized in-home supports for adults living in their own homes.", description: "Direct support professionals help with daily routines, community participation, and health and safety in the person's own home.", categories: ["independent-living", "housing"], populations: ["adults"], disabilities: ["intellectual-developmental"], languages: ["en"], payments: ["medicaid", "medicaid-waiver"], homeBased: true, inPerson: false, waitlist: "waitlist", status: "unverified" },
      { slug: "lsls-housing-coaching", title: "Housing Coaching", summary: "Help finding, moving into, and keeping a home.", description: "Housing coaches assist with searching, applications, move-in, and building good relationships with landlords.", categories: ["housing"], populations: ["adults"], languages: ["en"], payments: ["medicaid", "free"], waitlist: "accepting", status: "unverified" },
    ],
  },
  {
    slug: "jackson-area-transportation-access-project",
    title: "Jackson Area Transportation Access Project",
    summary: "Wheelchair-accessible rides and travel training for Jackson County residents.",
    description:
      "Jackson Area Transportation Access Project provides wheelchair-accessible rides for medical appointments, work, and errands, and teaches people to use fixed-route buses confidently through travel training.",
    type: "nonprofit",
    website: "https://jacksonrides.example",
    email: "rides@jacksonrides.example",
    phone: "(517) 555-0136",
    accessibility: "All vehicles have lifts or ramps and securement systems. Drivers trained in disability etiquette.",
    languages: ["en", "es"],
    populations: ["adults", "older-adults", "veterans"],
    categories: ["transportation"],
    disabilities: ["physical-mobility", "blind-low-vision", "intellectual-developmental"],
    status: "verified",
    verifiedDaysAgo: 29,
    nextReviewInDays: 151,
    areas: [{ county: "Jackson" }],
    locations: [
      { key: "jax", name: "Jackson Dispatch Center", street: "2350 E High Street", city: "Jackson", zip: "49203", county: "Jackson", lat: 42.2462, lng: -84.3714, primary: true, wheelchair: true, parking: true, transit: "JATA Route 3.", hours: "extended" },
    ],
    services: [
      { slug: "jatap-accessible-rides", title: "Wheelchair-Accessible Rides", summary: "Door-to-door accessible rides scheduled 24 hours in advance.", description: "Lift-equipped vans provide door-to-door rides within Jackson County for medical appointments, work, school, and errands.", categories: ["transportation"], populations: ["adults", "older-adults", "veterans"], disabilities: ["physical-mobility"], languages: ["en", "es"], payments: ["medicaid", "sliding-scale", "va-benefits"], waitlist: "accepting" },
      { slug: "jatap-travel-training", title: "Travel Training", summary: "One-on-one training to ride fixed-route buses independently.", description: "Travel trainers ride alongside participants to practice routes until they feel confident traveling on their own.", categories: ["transportation", "independent-living"], populations: ["teens", "adults", "older-adults"], languages: ["en"], payments: ["free"], free: true, waitlist: "accepting", ages: [14, null] },
    ],
  },
  {
    slug: "southwest-michigan-vision-resource-center",
    title: "Southwest Michigan Vision Resource Center",
    summary: "Low vision rehabilitation, orientation and mobility, and braille instruction in Berrien County.",
    description:
      "Southwest Michigan Vision Resource Center helps people who are blind or have low vision maintain independence through low vision services, orientation and mobility instruction, braille literacy, and technology training.",
    type: "nonprofit",
    website: "https://swmivision.example",
    email: "info@swmivision.example",
    phone: "(269) 555-0115",
    accessibility: "High-contrast signage, tactile wayfinding, and screen-reader-friendly documents.",
    languages: ["en", "es"],
    populations: ["adults", "older-adults", "children", "teens"],
    categories: ["vision-services", "assistive-technology", "independent-living"],
    disabilities: ["blind-low-vision"],
    status: "verified",
    verifiedDaysAgo: 47,
    nextReviewInDays: 133,
    areas: [{ county: "Berrien" }, { county: "Cass" }, { county: "Van Buren" }],
    locations: [
      { key: "stj", name: "St. Joseph Center", street: "2710 Niles Avenue", city: "St. Joseph", zip: "49085", county: "Berrien", lat: 42.0797, lng: -86.4702, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "swmvrc-low-vision-rehab", title: "Low Vision Rehabilitation", summary: "Assessments and training with magnifiers, lighting, and daily living techniques.", description: "Low vision specialists recommend devices and teach techniques for reading, cooking, and managing daily tasks.", categories: ["vision-services"], populations: ["adults", "older-adults"], languages: ["en", "es"], payments: ["medicare", "private-insurance", "sliding-scale"], waitlist: "short_wait" },
      { slug: "swmvrc-orientation-mobility", title: "Orientation & Mobility Instruction", summary: "Training in safe, independent travel using a white cane and other techniques.", description: "Certified O&M specialists teach cane skills, route planning, and safe street crossing.", categories: ["vision-services", "transportation"], populations: ["adults", "teens", "children"], languages: ["en"], payments: ["free", "grant-funded"], free: true, homeBased: true, waitlist: "accepting" },
      { slug: "swmvrc-braille-literacy", title: "Braille Literacy Instruction", summary: "Braille lessons for children and adults.", description: "Individual braille lessons from beginner to advanced, including technology such as refreshable braille displays.", categories: ["vision-services", "education"], populations: ["children", "teens", "adults"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "bay-area-caregiver-alliance",
    title: "Bay Area Caregiver Alliance",
    summary: "In-home respite, caregiver training, and support groups for family caregivers in Bay County.",
    description:
      "Bay Area Caregiver Alliance supports family caregivers of children and adults with disabilities and older adults. Services include in-home respite, caregiver skills training, and weekly support groups.",
    type: "nonprofit",
    website: "https://baycaregivers.example",
    email: "help@baycaregivers.example",
    phone: "(989) 555-0149",
    accessibility: "Accessible building. Respite services delivered in the home.",
    languages: ["en", "es"],
    populations: ["caregivers", "families", "older-adults"],
    categories: ["caregiver-support", "respite-care"],
    disabilities: ["intellectual-developmental", "chronic-health", "brain-injury"],
    status: "verified",
    verifiedDaysAgo: 26,
    nextReviewInDays: 154,
    areas: [{ county: "Bay" }, { county: "Midland" }, { county: "Arenac" }],
    locations: [
      { key: "bay", name: "Bay City Office", street: "915 Washington Avenue", city: "Bay City", zip: "48708", county: "Bay", lat: 43.5957, lng: -83.8866, primary: true, wheelchair: true, parking: true, transit: "Bay Metro Route 1.", hours: "standard" },
    ],
    services: [
      { slug: "baca-in-home-respite", title: "In-Home Respite Care", summary: "Trained respite providers give caregivers a scheduled break at home.", description: "Scheduled respite visits of 2–8 hours by trained, background-checked providers.", categories: ["respite-care", "caregiver-support"], populations: ["caregivers", "families", "older-adults", "adults", "children"], languages: ["en", "es"], payments: ["medicaid-waiver", "sliding-scale", "grant-funded"], homeBased: true, inPerson: false, waitlist: "short_wait" },
      { slug: "baca-caregiver-training", title: "Caregiver Skills Training", summary: "Hands-on training in safe transfers, medication management, and self-care.", description: "Workshops and home visits that build practical caregiving skills.", categories: ["caregiver-support", "education"], populations: ["caregivers"], languages: ["en"], payments: ["free"], free: true, waitlist: "accepting" },
      { slug: "baca-support-groups", title: "Caregiver Support Groups", summary: "Weekly support groups in person and online.", description: "A welcoming space for caregivers to share, learn, and recharge.", categories: ["caregiver-support", "mental-health"], populations: ["caregivers", "families"], languages: ["en", "es"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "river-raisin-disability-advocacy-center",
    title: "River Raisin Disability Advocacy Center",
    summary: "Special education advocacy and a disability rights legal information clinic in Monroe County.",
    description:
      "River Raisin Disability Advocacy Center helps families and individuals understand and exercise their rights in school, work, and public life, through special education advocacy and a monthly rights information clinic.",
    type: "advocacy",
    website: "https://riverraisinadvocacy.example",
    email: "advocate@riverraisinadvocacy.example",
    phone: "(734) 555-0191",
    accessibility: "Accessible office; remote appointments available.",
    languages: ["en", "es"],
    populations: ["families", "children", "teens", "adults"],
    categories: ["legal-advocacy", "education"],
    disabilities: ["learning-disabilities", "autism", "intellectual-developmental"],
    status: "verified",
    verifiedDaysAgo: 73,
    nextReviewInDays: 107,
    areas: [{ county: "Monroe" }, { county: "Lenawee" }],
    locations: [
      { key: "mon", name: "Monroe Office", street: "15 E Front Street", city: "Monroe", zip: "48161", county: "Monroe", lat: 41.9156, lng: -83.3969, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "rrdac-special-education-advocacy", title: "Special Education Advocacy", summary: "Help preparing for IEP and 504 meetings and resolving school disagreements.", description: "Advocates review records, help families prepare for meetings, and attend meetings when needed.", categories: ["education", "legal-advocacy"], populations: ["families", "children", "teens"], languages: ["en", "es"], payments: ["free", "sliding-scale"], virtual: true, waitlist: "short_wait" },
      { slug: "rrdac-rights-clinic", title: "Disability Rights Information Clinic", summary: "Monthly clinic with general legal information on disability rights.", description: "Volunteer attorneys provide general information about disability rights in employment, housing, and public accommodations. The clinic does not provide legal representation.", categories: ["legal-advocacy"], populations: ["adults", "families"], languages: ["en"], payments: ["free"], free: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "michigan-ability-center",
    title: "Michigan Ability Center",
    summary: "Brain injury support and adult day programs in western Wayne County.",
    description:
      "Michigan Ability Center offers brain injury support groups, community-based day programs, and family education for adults living with acquired brain injury.",
    type: "nonprofit",
    website: "https://michiganabilitycenter.example",
    email: "info@michiganabilitycenter.example",
    phone: "(734) 555-0107",
    accessibility: "Accessible building with accessible restrooms; quiet room available.",
    languages: ["en"],
    populations: ["adults", "families", "caregivers"],
    categories: ["independent-living", "mental-health"],
    disabilities: ["brain-injury"],
    status: "verified",
    verifiedDaysAgo: 96,
    nextReviewInDays: 84,
    areas: [{ county: "Wayne" }, { county: "Oakland" }],
    locations: [
      { key: "liv", name: "Livonia Center", street: "33200 Schoolcraft Road", city: "Livonia", zip: "48150", county: "Wayne", lat: 42.3822, lng: -83.3647, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "mac-brain-injury-support", title: "Brain Injury Support Groups", summary: "Peer support groups for survivors and family members.", description: "Twice-monthly facilitated groups for brain injury survivors, with a separate group for family members.", categories: ["mental-health", "caregiver-support"], populations: ["adults", "families", "caregivers"], disabilities: ["brain-injury"], languages: ["en"], payments: ["free"], free: true, waitlist: "accepting" },
      { slug: "mac-day-program", title: "Community Day Program", summary: "Structured day program focused on skills, recreation, and community participation.", description: "Weekday program with cognitive skills activities, recreation, and community outings.", categories: ["independent-living", "recreation"], populations: ["adults"], disabilities: ["brain-injury"], languages: ["en"], payments: ["medicaid", "private-insurance"], waitlist: "short_wait", ages: [18, null] },
    ],
  },
  {
    slug: "michigan-ability-ctr",
    title: "Michigan Ability Ctr.",
    summary: "Brain injury programs in Livonia.",
    description: "Brain injury support and day programs. (Record created from a community submission; details not yet verified.)",
    type: "nonprofit",
    website: "http://www.michiganabilitycenter.example/",
    email: "info@michiganabilitycenter.example",
    phone: "734-555-0107",
    accessibility: "",
    languages: ["en"],
    populations: ["adults"],
    categories: ["independent-living"],
    disabilities: ["brain-injury"],
    status: "unverified",
    areas: [{ county: "Wayne" }],
    locations: [
      { key: "liv", name: "Livonia", street: "33200 Schoolcraft Rd", city: "Livonia", zip: "48150", county: "Wayne", lat: 42.3823, lng: -83.3645, primary: true, hours: "standard" },
    ],
    services: [],
  },
  {
    slug: "eastside-wellness-disability-counseling",
    title: "Eastside Wellness & Disability Counseling",
    summary: "Accessible counseling, peer support, and care coordination for adults with disabilities in Detroit.",
    description:
      "Eastside Wellness & Disability Counseling offers accessible, disability-affirming mental health counseling and peer support. Therapists are experienced in working with Deaf clients, people with chronic health conditions, and people with physical disabilities.",
    type: "healthcare",
    website: "https://eastsidewellness.example",
    email: "care@eastsidewellness.example",
    phone: "(313) 555-0198",
    accessibility: "Step-free entrance, accessible exam and counseling rooms, ASL-fluent therapist on staff, telehealth with captions.",
    languages: ["en", "ase", "ar", "bn"],
    populations: ["adults", "teens", "older-adults"],
    categories: ["mental-health", "health-care"],
    disabilities: ["mental-health-conditions", "deaf-hard-of-hearing", "physical-mobility", "chronic-health"],
    status: "verified",
    verifiedDaysAgo: 58,
    nextReviewInDays: 122,
    areas: [{ county: "Wayne" }, { county: "Macomb" }],
    locations: [
      { key: "east", name: "East Jefferson Clinic", street: "8200 E Jefferson Avenue", city: "Detroit", zip: "48214", county: "Wayne", lat: 42.3551, lng: -82.9861, primary: true, wheelchair: true, parking: true, transit: "DDOT Route 25 Jefferson.", hours: "extended", virtual: true },
    ],
    services: [
      { slug: "ewdc-counseling", title: "Accessible Individual Counseling", summary: "Disability-affirming counseling in person or by telehealth.", description: "Licensed therapists provide counseling for anxiety, depression, grief, and adjusting to disability, in person or by captioned telehealth.", categories: ["mental-health"], populations: ["adults", "teens", "older-adults"], disabilities: ["mental-health-conditions", "deaf-hard-of-hearing", "physical-mobility"], languages: ["en", "ase", "ar"], payments: ["medicaid", "medicare", "private-insurance", "sliding-scale"], virtual: true, waitlist: "short_wait", ages: [13, null] },
      { slug: "ewdc-peer-support", title: "Peer Support Specialists", summary: "Support from certified peer specialists with lived experience.", description: "Certified peer support specialists help with recovery goals, community connection, and navigating services.", categories: ["mental-health"], populations: ["adults"], languages: ["en", "bn"], payments: ["medicaid", "free"], waitlist: "accepting" },
      { slug: "ewdc-care-coordination", title: "Care Coordination", summary: "Help coordinating medical, behavioral health, and social services.", description: "Care coordinators help schedule appointments, connect to community resources, and communicate with providers.", categories: ["health-care", "mental-health"], populations: ["adults", "older-adults"], languages: ["en", "ar"], payments: ["medicaid", "medicare"], waitlist: "accepting" },
    ],
  },
  {
    slug: "huron-valley-speech-language-clinic",
    title: "Huron Valley Speech & Language Clinic",
    summary: "Speech therapy, AAC evaluations, and feeding therapy for children and adults in Washtenaw County.",
    description:
      "Huron Valley Speech & Language Clinic is a private practice of speech-language pathologists providing evaluation and therapy for communication and feeding, including augmentative and alternative communication (AAC).",
    type: "private_practice",
    website: "https://huronvalleyspeech.example",
    email: "office@huronvalleyspeech.example",
    phone: "(734) 555-0155",
    accessibility: "Accessible first-floor clinic; sensory-friendly therapy rooms; telehealth available.",
    languages: ["en", "es", "zh"],
    populations: ["children", "teens", "adults", "families"],
    categories: ["therapy-services", "autism-services", "assistive-technology"],
    disabilities: ["speech-language", "autism", "intellectual-developmental"],
    status: "verified",
    verifiedDaysAgo: 39,
    nextReviewInDays: 141,
    areas: [{ county: "Washtenaw" }, { county: "Livingston" }],
    locations: [
      { key: "ypsi", name: "Ypsilanti Clinic", street: "2025 Washtenaw Avenue", city: "Ypsilanti", zip: "48197", county: "Washtenaw", lat: 42.2533, lng: -83.6552, primary: true, wheelchair: true, parking: true, transit: "TheRide Route 4.", hours: "saturday", appointment: true },
    ],
    services: [
      { slug: "hvslc-speech-therapy", title: "Pediatric Speech Therapy", summary: "Speech and language therapy for children, including autistic children.", description: "Play-based speech and language therapy focused on communication goals that matter to the child and family.", categories: ["therapy-services", "autism-services"], populations: ["children", "teens", "families"], disabilities: ["speech-language", "autism"], languages: ["en", "es", "zh"], payments: ["medicaid", "private-insurance", "self-pay"], ages: [1, 18], referral: false, waitlist: "waitlist" },
      { slug: "hvslc-aac-evaluations", title: "AAC Evaluations & Training", summary: "Evaluations for communication devices and training for families.", description: "Comprehensive AAC evaluations, device trials, funding documentation, and family training.", categories: ["assistive-technology", "therapy-services"], populations: ["children", "teens", "adults", "families"], disabilities: ["speech-language", "autism"], languages: ["en", "es"], payments: ["medicaid", "private-insurance"], waitlist: "short_wait" },
      { slug: "hvslc-feeding-therapy", title: "Feeding Therapy", summary: "Therapy for picky eating, chewing, and swallowing difficulties.", description: "Individualized feeding therapy for children with sensory or motor-based feeding challenges.", categories: ["therapy-services"], populations: ["children"], languages: ["en"], payments: ["medicaid", "private-insurance"], ages: [0, 12], referral: true, waitlist: "waitlist" },
    ],
  },
  {
    slug: "great-lakes-autism-family-center",
    title: "Great Lakes Autism & Family Center",
    summary: "Autism services, occupational therapy, and family support for children and teens in Ann Arbor and Brighton.",
    description:
      "Great Lakes Autism & Family Center provides family-centered autism services for children and teens, including occupational therapy, social skills groups, and support for parents and siblings.",
    type: "nonprofit",
    website: "https://greatlakesautism.example",
    email: "info@greatlakesautism.example",
    phone: "(734) 555-0129",
    accessibility: "Sensory-friendly spaces, visual supports, step-free entrance, and accessible restrooms at both locations.",
    languages: ["en", "es", "ar"],
    populations: ["children", "teens", "families"],
    categories: ["autism-services", "therapy-services", "caregiver-support"],
    disabilities: ["autism", "speech-language", "intellectual-developmental"],
    status: "verified",
    verifiedDaysAgo: 49,
    nextReviewInDays: 131,
    areas: [{ county: "Washtenaw" }, { county: "Livingston" }],
    locations: [
      { key: "a2", name: "Ann Arbor Center", street: "3150 Plymouth Road", city: "Ann Arbor", zip: "48105", county: "Washtenaw", lat: 42.3036, lng: -83.7043, primary: true, wheelchair: true, parking: true, transit: "TheRide Route 22.", hours: "saturday" },
      { key: "bri", name: "Brighton Office", street: "9800 E Grand River Avenue", city: "Brighton", zip: "48116", county: "Livingston", lat: 42.5262, lng: -83.7629, wheelchair: true, parking: true, hours: "standard", appointment: true },
    ],
    services: [
      { slug: "glafc-autism-services", title: "Autism Services for Children & Teens", summary: "Individual and group supports built around each child's strengths and goals.", description: "Individual supports, social connection groups, and school collaboration for autistic children and teens.", categories: ["autism-services"], populations: ["children", "teens"], disabilities: ["autism"], languages: ["en", "es", "ar"], payments: ["medicaid", "private-insurance", "sliding-scale"], ages: [3, 18], waitlist: "short_wait" },
      { slug: "glafc-occupational-therapy", title: "Occupational Therapy", summary: "Pediatric occupational therapy for sensory, motor, and daily living skills.", description: "Occupational therapists help children build skills for play, school, and self-care.", categories: ["therapy-services", "autism-services"], populations: ["children", "teens"], disabilities: ["autism", "physical-mobility"], languages: ["en", "es"], payments: ["medicaid", "private-insurance"], ages: [2, 18], referral: true, waitlist: "waitlist" },
      { slug: "glafc-family-support", title: "Family Support", summary: "Parent coaching, sibling groups, and caregiver support.", description: "Parent coaching sessions, monthly sibling groups, and caregiver support circles.", categories: ["caregiver-support", "autism-services"], populations: ["families", "caregivers", "children"], languages: ["en", "es", "ar"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "thumb-area-independent-living-center",
    title: "Thumb Area Independent Living Center",
    summary: "Independent living services, ramp building, and equipment loans for Huron, Tuscola, and Sanilac counties.",
    description:
      "Thumb Area Independent Living Center serves rural communities in Michigan's Thumb with independent living services, a volunteer ramp-building program, and a durable medical equipment loan closet.",
    type: "nonprofit",
    website: "https://thumbindependence.example",
    email: "info@thumbindependence.example",
    phone: "(989) 555-0114",
    accessibility: "Accessible office; home visits available across the service area.",
    languages: ["en"],
    populations: ["adults", "older-adults", "families"],
    categories: ["independent-living", "housing", "assistive-technology"],
    disabilities: ["physical-mobility", "chronic-health"],
    status: "verified",
    verifiedDaysAgo: 112,
    nextReviewInDays: 68,
    areas: [{ county: "Huron" }, { county: "Tuscola" }, { county: "Sanilac" }],
    locations: [
      { key: "ba", name: "Bad Axe Office", street: "175 E Huron Avenue", city: "Bad Axe", zip: "48413", county: "Huron", lat: 43.8023, lng: -82.9985, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "tailc-independent-living", title: "Independent Living Services", summary: "Advocacy, skills training, and peer support.", description: "Goal-based independent living services delivered in the office or at home.", categories: ["independent-living"], populations: ["adults", "older-adults"], languages: ["en"], payments: ["free"], free: true, homeBased: true, waitlist: "accepting" },
      { slug: "tailc-ramp-program", title: "Volunteer Ramp Building Program", summary: "Free modular ramps built by trained volunteers for eligible homeowners.", description: "Trained volunteer crews build modular wheelchair ramps for eligible residents.", categories: ["housing", "independent-living"], populations: ["adults", "older-adults"], disabilities: ["physical-mobility"], languages: ["en"], payments: ["free", "grant-funded"], free: true, homeBased: true, inPerson: false, waitlist: "waitlist" },
      { slug: "tailc-equipment-loan", title: "Medical Equipment Loan Closet", summary: "Short-term loans of wheelchairs, walkers, shower chairs, and more.", description: "Borrow durable medical equipment at no cost for up to 90 days.", categories: ["assistive-technology"], populations: ["adults", "older-adults", "children"], languages: ["en"], payments: ["free"], free: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "mid-michigan-housing-accessibility-coalition",
    title: "Mid-Michigan Housing Accessibility Coalition",
    summary: "Home modification assistance and accessible housing navigation in Isabella and surrounding counties.",
    description:
      "Mid-Michigan Housing Accessibility Coalition helps people with disabilities find and adapt housing. The Coalition administers a home modification assistance program and offers housing navigation.",
    type: "nonprofit",
    website: "https://midmihousingaccess.example",
    email: "homes@midmihousingaccess.example",
    phone: "(989) 555-0168",
    accessibility: "Accessible office. Home assessments available.",
    languages: ["en"],
    populations: ["adults", "older-adults", "families"],
    categories: ["housing"],
    disabilities: ["physical-mobility"],
    status: "verified",
    verifiedDaysAgo: 67,
    nextReviewInDays: 113,
    areas: [{ county: "Isabella" }, { county: "Clare" }, { county: "Gratiot" }, { county: "Midland" }],
    locations: [
      { key: "mp", name: "Mount Pleasant Office", street: "220 W Broadway Street", city: "Mount Pleasant", zip: "48858", county: "Isabella", lat: 43.6043, lng: -84.7766, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "mmhac-home-modifications", title: "Home Modification Assistance", summary: "Assessment and funding help for ramps, bathroom modifications, and more.", description: "Staff assess homes, obtain contractor bids, and help homeowners access grants for accessibility modifications.", categories: ["housing"], populations: ["adults", "older-adults", "families"], disabilities: ["physical-mobility"], languages: ["en"], payments: ["grant-funded", "sliding-scale"], homeBased: true, waitlist: "waitlist" },
      { slug: "mmhac-housing-navigation", title: "Accessible Housing Navigation", summary: "Help finding accessible rentals and understanding housing assistance.", description: "Navigators help identify accessible units and apply for housing assistance programs.", categories: ["housing"], populations: ["adults", "older-adults"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "detroit-adaptive-arts-collective",
    title: "Detroit Adaptive Arts Collective",
    summary: "Inclusive arts, dance, and music programs for artists with disabilities in Detroit.",
    description:
      "Detroit Adaptive Arts Collective is an artist-led collective creating inclusive studio classes, dance, and music programs for artists with disabilities, plus public exhibitions and performances.",
    type: "community_group",
    website: "https://detroitadaptivearts.example",
    email: "studio@detroitadaptivearts.example",
    phone: "(313) 555-0186",
    accessibility: "Step-free studio with accessible restroom, adjustable-height tables, and sensory-friendly session options.",
    languages: ["en", "es"],
    populations: ["teens", "adults", "older-adults"],
    categories: ["recreation"],
    disabilities: ["physical-mobility", "intellectual-developmental", "autism", "mental-health-conditions"],
    status: "verified",
    verifiedDaysAgo: 33,
    nextReviewInDays: 147,
    enhanced: true,
    expanded: "Our studio in Detroit's Eastern Market district is designed by and for disabled artists. We host monthly open studios, a spring exhibition, and a dance company that performs across Metro Detroit.",
    areas: [{ county: "Wayne" }],
    locations: [
      { key: "em", name: "Eastern Market Studio", street: "2934 Russell Street", city: "Detroit", zip: "48207", county: "Wayne", lat: 42.3478, lng: -83.0412, primary: true, wheelchair: true, parking: true, transit: "DDOT Route 40.", hours: "saturday" },
    ],
    services: [
      { slug: "daac-studio-classes", title: "Inclusive Studio Art Classes", summary: "Painting, printmaking, and ceramics with adaptive tools.", description: "Weekly classes for teens and adults of all skill levels with adaptive tools and individualized support.", categories: ["recreation"], populations: ["teens", "adults", "older-adults"], languages: ["en", "es"], payments: ["sliding-scale", "free"], waitlist: "accepting", featured: true },
      { slug: "daac-dance-company", title: "Integrated Dance Company", summary: "A dance company for dancers with and without disabilities.", description: "Rehearsals twice weekly with public performances; no prior experience required.", categories: ["recreation"], populations: ["teens", "adults"], disabilities: ["physical-mobility"], languages: ["en"], payments: ["free"], free: true, waitlist: "short_wait" },
    ],
  },
  {
    slug: "sunrise-coast-senior-disability-services",
    title: "Sunrise Coast Senior & Disability Services",
    summary: "In-home support, benefits help, and meal delivery for older adults and adults with disabilities in Northeast Michigan.",
    description:
      "Sunrise Coast Senior & Disability Services supports older adults and adults with disabilities in Alpena and surrounding counties to live safely at home, with in-home support, benefits counseling, and home-delivered meals.",
    type: "nonprofit",
    website: "https://sunrisecoastservices.example",
    email: "info@sunrisecoastservices.example",
    phone: "(989) 555-0103",
    accessibility: "Accessible office and community room; home visits across the service area.",
    languages: ["en"],
    populations: ["older-adults", "adults", "caregivers"],
    categories: ["independent-living", "financial-assistance"],
    disabilities: ["physical-mobility", "chronic-health"],
    status: "verified",
    verifiedDaysAgo: 61,
    nextReviewInDays: 119,
    areas: [{ county: "Alpena" }, { county: "Alcona" }, { county: "Montmorency" }, { county: "Presque Isle" }],
    locations: [
      { key: "alp", name: "Alpena Office", street: "300 N Second Avenue", city: "Alpena", zip: "49707", county: "Alpena", lat: 45.0643, lng: -83.4339, primary: true, wheelchair: true, parking: true, hours: "standard" },
    ],
    services: [
      { slug: "scsds-in-home-support", title: "In-Home Support Services", summary: "Help with personal care and household tasks at home.", description: "Trained aides provide help with bathing, dressing, light housekeeping, and errands.", categories: ["independent-living"], populations: ["older-adults", "adults"], languages: ["en"], payments: ["medicaid", "medicaid-waiver", "sliding-scale"], homeBased: true, inPerson: false, waitlist: "waitlist" },
      { slug: "scsds-benefits-help", title: "Benefits Help Desk", summary: "Help applying for Medicare, Medicaid, and assistance programs.", description: "Counselors help compare plans, complete applications, and resolve benefit issues.", categories: ["financial-assistance"], populations: ["older-adults", "adults", "caregivers"], languages: ["en"], payments: ["free"], free: true, virtual: true, waitlist: "accepting" },
    ],
  },
  {
    slug: "wolverine-assistive-technology-exchange",
    title: "Wolverine Assistive Technology Exchange",
    summary: "A statewide program that refurbishes and redistributes gently used assistive technology and medical equipment.",
    description:
      "Wolverine Assistive Technology Exchange collects, sanitizes, and refurbishes donated assistive technology and durable medical equipment and makes it available to Michigan residents at low or no cost. Equipment can be shipped or picked up in Lansing.",
    type: "nonprofit",
    website: "https://wolverineatx.example",
    email: "exchange@wolverineatx.example",
    phone: "(517) 555-0178",
    accessibility: "Accessible warehouse pickup area; phone and online ordering.",
    languages: ["en", "es"],
    populations: ["adults", "older-adults", "children", "families"],
    categories: ["assistive-technology"],
    disabilities: ["physical-mobility", "blind-low-vision", "deaf-hard-of-hearing", "speech-language"],
    status: "verified",
    verifiedDaysAgo: 24,
    nextReviewInDays: 156,
    areas: ["statewide"],
    locations: [
      { key: "lan", name: "Lansing Warehouse & Pickup", street: "3200 S Pennsylvania Avenue", city: "Lansing", zip: "48910", county: "Ingham", lat: 42.6975, lng: -84.5367, primary: true, wheelchair: true, parking: true, hours: "limited", appointment: true },
    ],
    services: [
      { slug: "watx-equipment-reuse", title: "Assistive Technology Reuse", summary: "Low- and no-cost refurbished equipment shipped anywhere in Michigan.", description: "Browse available refurbished equipment including wheelchairs, communication devices, and daily living aids; request shipping or pickup.", categories: ["assistive-technology"], populations: ["adults", "older-adults", "children", "families"], languages: ["en", "es"], payments: ["free", "sliding-scale"], virtual: true, waitlist: "accepting", areas: ["statewide"] },
      { slug: "watx-device-donation", title: "Equipment Donation Pickup", summary: "Donate gently used equipment for refurbishment.", description: "Schedule a drop-off or request pickup for donated equipment.", categories: ["assistive-technology"], populations: ["adults", "families"], languages: ["en"], payments: ["free"], free: true, waitlist: "accepting", areas: ["statewide"] },
    ],
  },
  {
    slug: "michigan-disability-benefits-collaborative",
    title: "Michigan Disability Benefits Collaborative",
    summary: "Statewide phone and video benefits counseling and respite funding navigation for Michigan families.",
    description:
      "Michigan Disability Benefits Collaborative is a statewide virtual nonprofit that helps people with disabilities and caregivers understand public benefits, apply for assistance, and find respite funding.",
    type: "nonprofit",
    website: "https://midisabilitybenefits.example",
    email: "help@midisabilitybenefits.example",
    phone: "(517) 555-0105",
    accessibility: "All services are available by phone, video with captions, relay services, and email.",
    languages: ["en", "es", "ar"],
    populations: ["adults", "families", "caregivers", "older-adults"],
    categories: ["financial-assistance", "caregiver-support", "respite-care"],
    disabilities: ["intellectual-developmental", "physical-mobility", "mental-health-conditions", "chronic-health"],
    status: "verified",
    verifiedDaysAgo: 40,
    nextReviewInDays: 140,
    areas: ["statewide"],
    locations: [],
    services: [
      { slug: "mdbc-benefits-counseling", title: "Statewide Benefits Counseling", summary: "Phone and video counseling on SSI, SSDI, Medicaid, and food assistance.", description: "Counselors explain eligibility, help complete applications, and prepare for appeals.", categories: ["financial-assistance"], populations: ["adults", "families", "older-adults"], languages: ["en", "es", "ar"], payments: ["free"], free: true, virtual: true, inPerson: false, waitlist: "short_wait", areas: ["statewide"] },
      { slug: "mdbc-respite-navigation", title: "Respite Funding Navigation", summary: "Help finding respite providers and funding anywhere in Michigan.", description: "Navigators help caregivers identify respite options and funding sources in their county, including self-directed options.", categories: ["respite-care", "caregiver-support"], populations: ["caregivers", "families"], languages: ["en", "es"], payments: ["free"], free: true, virtual: true, inPerson: false, waitlist: "accepting", areas: ["statewide"] },
    ],
  },
];
