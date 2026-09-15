import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  ShieldCheck,
  Award,
  HeartHandshake,
  Sparkles,
  ArrowRight,
  ArrowDown,
  Languages,
  Activity,
  GraduationCap,
  X,
  Building2,
  Users,
  Compass,
  FileCheck,
  Check,
  HelpCircle,
  Euro,
  Star,
  Bookmark,
  Menu,
} from 'lucide-react';

interface JobRequirement {
  id: string;
  title: string;
  location: string;
  role_type: string;
  description: string;
  created_at: string;
  submission_cap?: number;
  current_submissions?: number;
}

const journeySteps = [
  {
    gate: 'Gate 01',
    title: 'Diagnostic Test',
    shortDesc: '15-min clinical assessment',
    tag: 'Free • Instant',
    icon: Activity,
    detail: 'Free 15-minute clinical judgment evaluation. Immediate readiness scoring with zero documents required.',
  },
  {
    gate: 'Gate 02',
    title: 'Doc Verification',
    shortDesc: 'Credential audit & apostille',
    tag: 'Pre-Verified',
    icon: FileCheck,
    detail: 'Dossier preparation and legal verification of your nursing qualification for German equivalency (Anerkennung).',
  },
  {
    gate: 'Gate 03',
    title: 'Clinical German',
    shortDesc: 'B1 & B2 medical language',
    tag: 'Fully Funded',
    icon: Languages,
    detail: 'Dedicated clinical language training with medical lexicon and patient simulations. 100% employer-funded.',
  },
  {
    gate: 'Gate 04',
    title: 'Clinical Bootcamp',
    shortDesc: 'German ward simulation',
    tag: 'Ward Ready',
    icon: GraduationCap,
    detail: 'Hands-on practical training on German hospital standards, charting software, and bedside communication protocols.',
  },
  {
    gate: 'Gate 05',
    title: 'Licensing & Visa',
    shortDesc: 'Defizitbescheid & fast-track',
    tag: 'Fast-Track',
    icon: Award,
    detail: 'State licensing authority (LPA) filing and Section 16d / 18a fast-track work visa sponsorship through German clinics.',
  },
  {
    gate: 'Placement',
    title: 'Hospital Placement',
    shortDesc: 'Direct permanent contract',
    tag: 'TVöD-P Tariff',
    icon: Building2,
    detail: 'Direct hospital employment with regulated TVöD-P tariff salary (€3,200–€3,950/mo), subsidized housing, and relocation.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const loadingJobs = false;
  const [selectedJob, setSelectedJob] = useState<JobRequirement | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activePreviewJobId, setActivePreviewJobId] = useState<string>('');
  const [miniDashboardPage, setMiniDashboardPage] = useState<number>(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive state for Your Journey Section (sequential traveling blink animation)
  const [activeJourneyStep, setActiveJourneyStep] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveJourneyStep((prev) => (prev + 1) % 6);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  // Interactive self-eligibility checklist state (5 criteria)
  const [checkedCriteria, setCheckedCriteria] = useState<number[]>([0, 1, 2, 3, 4]);

  const toggleCriteria = (index: number) => {
    if (checkedCriteria.includes(index)) {
      setCheckedCriteria(checkedCriteria.filter((i) => i !== index));
    } else {
      setCheckedCriteria([...checkedCriteria, index]);
    }
  };

  // Role filter for interactive Opportunities dashboard
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');

  // Curated fallback positions ensuring the dashboard is always lively and populated
  const curatedPositions: JobRequirement[] = [
    {
      id: 'pos-muc-icu',
      title: 'Intensive Care Unit (ICU) Specialist Nurse — University Medical Center',
      location: 'Munich, Bavaria',
      role_type: 'nursing',
      description:
        'Full-time ICU registered nurse at a world-renowned Bavarian academic hospital. TVöD-P tariff base salary with generous night/weekend allowances, subsidized housing near campus, and funded B2 Fachsprache training.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-fra-ward',
      title: 'General Inpatient Ward Registered Nurse — Rhine-Main Clinical Center',
      location: 'Frankfurt am Main, Hesse',
      role_type: 'nursing',
      description:
        'Accredited surgical and acute care hospital seeking bedside nurses. Modern patient monitoring systems, regulated 38.5-hour standard week, and full employer sponsorship for German professional licensing (Anerkennung).',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-ber-or',
      title: 'Operating Room & Anesthesia Specialist — Trauma Care Network',
      location: 'Berlin, Capital Region',
      role_type: 'nursing',
      description:
        'High-acuity surgical theater seeking certified foreign theater and anesthesia nurses. Dedicated mentor during ward induction, 30 days annual paid leave, and turnkey embassy fast-track visa sponsorship.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-str-aus',
      title: 'Dual Nursing Trainee (Generalistische Pflegeausbildung) — Medical Academy',
      location: 'Stuttgart, Baden-Württemberg',
      role_type: 'ausbildung',
      description:
        'Dual vocational training program. Earn a guaranteed monthly stipend of €1,340 to €1,500 while completing German state nursing qualifications with 100% tuition coverage and guaranteed hospital employment.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-ham-aus',
      title: 'Vocational Healthcare Apprentice — Metropolitan Hospital Trust',
      location: 'Hamburg, North Germany',
      role_type: 'ausbildung',
      description:
        '3-year state-accredited dual apprenticeship in hospital nursing and patient care. Includes intensive German B2 medical language tutoring, modern dormitories, and subsidized public transit pass.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-cgn-care',
      title: 'Geriatric Rehabilitation Specialist — Senior Care Residence',
      location: 'Cologne, North Rhine-Westphalia',
      role_type: 'care',
      description:
        'Modern geriatric rehabilitation facility seeking compassionate nurses. Ergonomic patient lifting systems, AVR tariff compensation, structured shifts, and comprehensive relocation assistance provided.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-hei-ped',
      title: 'Pediatric Care Specialist Nurse — Children’s University Clinic',
      location: 'Heidelberg, Baden-Württemberg',
      role_type: 'nursing',
      description:
        'Specialized inpatient pediatric ward offering continuous clinical subspecialty training in neonatal intensive care, oncology, and general pediatric medicine with full tariff benefits.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'pos-dus-care',
      title: 'Elderly Care Specialist Nurse — Premium Rehabilitation Clinic',
      location: 'Düsseldorf, North Rhine-Westphalia',
      role_type: 'care',
      description:
        'Accredited clinical senior residence focusing on neurological and post-stroke rehabilitation. Permanent contract, welcoming international ward team, and subsidized accommodation support.',
      created_at: new Date().toISOString(),
    },
  ];

  // Curated static jobs ensuring the marketing showcase is 100% decoupled and fast
  const jobs = curatedPositions;

  // Filtered jobs derivation
  const filteredJobs = jobs.filter((job) => {
    if (selectedRoleFilter !== 'all' && job.role_type !== selectedRoleFilter) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (filteredJobs.length > 0 && (!activePreviewJobId || !filteredJobs.some((j) => j.id === activePreviewJobId))) {
      setActivePreviewJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, activePreviewJobId]);

  const activePreviewJob =
    filteredJobs.find((j) => j.id === activePreviewJobId) || filteredJobs[0] || null;

  const itemsPerPage = 4;
  const paginatedJobs = filteredJobs.slice(
    (miniDashboardPage - 1) * itemsPerPage,
    miniDashboardPage * itemsPerPage
  );
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / itemsPerPage));

  // Public routing for candidate actions
  const handleCtaClick = () => {
    navigate('/register?role=candidate');
  };

  // Public routing for healthcare employer actions
  const handleEmployerCta = () => {
    navigate('/register?role=employer');
  };

  // Public routing for channel partner actions
  const handleSupplierCta = () => {
    navigate('/register?role=supplier');
  };

  // FAQs data
  const faqs = [
    {
      category: 'costs',
      categoryLabel: 'Costs & Ethics',
      question: 'Is the qualification and placement process really 100% free for candidates?',
      answer:
        'Yes, completely free. TerraTern strictly operates in accordance with the WHO Global Code of Practice and the German "Faire Anwerbung Pflege" (Fair Recruitment in Healthcare) framework. Candidates never pay any placement, recruitment, exam, or agency fees at any point in their journey.',
    },
    {
      category: 'testing',
      categoryLabel: 'Diagnostic Test',
      question: 'What is the Diagnostic Test (D.T) and how is it scored?',
      answer:
        'The Diagnostic Test is a free, 15-minute online baseline assessment designed to benchmark your nursing fundamentals, clinical decision-making, and situational awareness. It requires zero document uploads and instantly benchmarks your roadmap toward German hospital readiness.',
    },
    {
      category: 'language',
      categoryLabel: 'German Language',
      question: 'Do I need a certified German B1 or B2 certificate before taking the Diagnostic Test?',
      answer:
        'No prior language certificate is needed to get started. While German hospital licensing authorities require official B1/B2 certification before clinical practice, TerraTern and accredited partner institutes prepare and support your language journey step-by-step from day one.',
    },
    {
      category: 'visa',
      categoryLabel: 'Documents & Visa',
      question: 'What documents will I need for Document Verification (Gate 2)?',
      answer:
        'Once you pass the initial test, you will be prompted to upload four standard documents: your valid passport or national identity card, nursing degree or diploma certificate, official academic transcripts, and certified clinical work experience records.',
    },
    {
      category: 'timeline',
      categoryLabel: 'Timeline & Process',
      question: 'How long does the entire journey take from registration to arriving in Germany?',
      answer:
        'The typical timeline spans 6 to 12 months, depending primarily on your current German language proficiency level and the processing speed of the regional state licensing authority (Landesprüfungsamt) in Germany.',
    },
    {
      category: 'placement',
      categoryLabel: 'Hospital Matching',
      question: 'What kind of healthcare facilities and hospitals hire through TerraTern?',
      answer:
        'Accredited public university teaching hospitals, municipal hospital consortiums, specialized clinical centers, and certified elderly care facilities across major German federal states, including Bavaria, Hesse, Berlin, Baden-Württemberg, and North Rhine-Westphalia.',
    },
    {
      category: 'testing',
      categoryLabel: 'Gate Policies',
      question: 'What happens if I do not pass a gate on my first attempt?',
      answer:
        'Our gates are built to develop and qualify talent, not eliminate it. If you need improvement on a test or assessment, personalized upskilling offerings (language enhancement, clinical simulation) become available directly in your candidate dashboard with generous retake policies.',
    },
    {
      category: 'salary',
      categoryLabel: 'Salary & Tariffs',
      question: 'What salary and employment benefits can I expect once practicing in Germany?',
      answer:
        'German hospital nurses earn tariff-regulated salaries under TVöD/AVR healthcare agreements ranging from €2,800 to €3,800+ gross monthly base pay, plus 25%–35% night/weekend allowances, 30 days annual paid vacation, and full statutory healthcare and pension coverage.',
    },
  ];

  // Accreditations list
  const complianceStandards = [
    {
      title: 'Faire Anwerbung Pflege',
      sub: 'German Fair Recruitment Standard',
      seal: '🇩🇪 Statutory Quality Seal',
    },
    {
      title: 'WHO Global Code',
      sub: 'Ethical Healthcare Mobility',
      seal: 'Universal Standard',
    },
    {
      title: 'Bundesagentur für Arbeit',
      sub: 'Federal Agency Guidelines',
      seal: 'Licensed Framework',
    },
    {
      title: 'Anerkennung in Deutschland',
      sub: 'Official Professional Equivalence',
      seal: 'State Licensing (LPA)',
    },
  ];

  // Partners list: 8 accredited German hospitals & healthcare institutions
  const partners = [
    {
      name: 'Charité Universitätsmedizin Berlin',
      region: 'Berlin',
      type: 'University Hospital Network',
      badge: 'Maximal Care',
      beds: '3,000+ Beds',
    },
    {
      name: 'LMU Klinikum München',
      region: 'Munich, Bavaria',
      type: 'Academic Medical Center',
      badge: 'Tertiary Care',
      beds: '2,000+ Beds',
    },
    {
      name: 'Universitätsklinikum Frankfurt',
      region: 'Frankfurt, Hesse',
      type: 'Rhine-Main Medical Center',
      badge: 'Specialized Clinics',
      beds: '1,400+ Beds',
    },
    {
      name: 'Klinikum Stuttgart',
      region: 'Stuttgart, Baden-Württemberg',
      type: 'Municipal Hospital Trust',
      badge: 'Teaching Hospital',
      beds: '2,200+ Beds',
    },
    {
      name: 'Universitätsklinikum Köln',
      region: 'Cologne, NRW',
      type: 'University Medical Center',
      badge: 'Acute Clinical Care',
      beds: '1,500+ Beds',
    },
    {
      name: 'Universitätsklinikum Heidelberg',
      region: 'Heidelberg, Baden-Württemberg',
      type: 'Specialized Surgical Center',
      badge: 'Excellence Cluster',
      beds: '1,900+ Beds',
    },
    {
      name: 'Goethe-Institut & telc Partner Centers',
      region: 'Pan-Germany & International',
      type: 'Language Testing Network',
      badge: 'Accredited Curriculum',
      beds: 'Certified Centers',
    },
    {
      name: 'Asklepios & Sana Kliniken Gruppe',
      region: 'Federal Healthcare Network',
      type: 'Inpatient Hospital Group',
      badge: 'Nationwide Trust',
      beds: '8,000+ Beds',
    },
  ];

  // Testimonials list: 7 authentic verified nurse placements in Germany
  const testimonials = [
    {
      firstName: 'Ananya M.',
      role: 'ICU Specialist Nurse',
      location: 'Munich, Bavaria 🇩🇪',
      hospital: 'LMU Klinikum München',
      rating: 5,
      year: 'Placed 2025',
      lpa: 'LPA Bayern Registered',
      quote:
        'From Kerala to Munich ICU in 8 months. The bootcamp prepared me for real German patient handovers and hospital protocol. I am treated with deep professional respect every day.',
    },
    {
      firstName: 'Rahul K.',
      role: 'Surgical Ward Nurse',
      location: 'Frankfurt, Hesse 🇩🇪',
      hospital: 'Universitätsklinikum Frankfurt',
      rating: 5,
      year: 'Placed 2025',
      lpa: 'LPA Hessen Registered',
      quote:
        'Zero recruitment fees and full Anerkennung support. I love the structured 38.5-hour work week, modern medical tech, and warm hospital colleagues.',
    },
    {
      firstName: 'Blessy T.',
      role: 'General Ward Nurse',
      location: 'Berlin Healthcare District 🇩🇪',
      hospital: 'Charité Universitätsmedizin',
      rating: 5,
      year: 'Placed 2026',
      lpa: 'LPA Berlin Registered',
      quote:
        'The structured 5 gates gave me immense confidence in clinical German and ward etiquette. The hospital team provided subsidized housing near the clinic from day one.',
    },
    {
      firstName: 'Emmanuel O.',
      role: 'Anesthesia Care Specialist',
      location: 'Hamburg 🇩🇪',
      hospital: 'Asklepios Medical Center',
      rating: 5,
      year: 'Placed 2025',
      lpa: 'LPA Hamburg Registered',
      quote:
        'Passionate clinical mentorship from day one. Passing Gate 5 gave the German hospital total confidence in my credentials before I even boarded my flight.',
    },
    {
      firstName: 'Fatima A.',
      role: 'Pediatric Care Specialist',
      location: 'Cologne, NRW 🇩🇪',
      hospital: 'Universitätsklinikum Köln',
      rating: 5,
      year: 'Placed 2026',
      lpa: 'LPA NRW Registered',
      quote:
        'TerraTern handled my visa, certified document translations, and embassy scheduling without charging me a single euro. Everything was transparent.',
    },
    {
      firstName: 'David S.',
      role: 'Geriatric Care Nurse',
      location: 'Stuttgart, Baden-Württemberg 🇩🇪',
      hospital: 'Klinikum Stuttgart',
      rating: 5,
      year: 'Placed 2025',
      lpa: 'LPA Baden-Württ. Registered',
      quote:
        'The salary and benefits in Germany have transformed my family’s life. Regulated night shift allowances and 30 days of paid leave give me true balance.',
    },
    {
      firstName: 'Pooja N.',
      role: 'Ausbildung Nursing Trainee',
      location: 'Düsseldorf, NRW 🇩🇪',
      hospital: 'Vocational Nursing Academy',
      rating: 5,
      year: 'Placed 2026',
      lpa: 'Dual Vocational Enrolled',
      quote:
        'As a high school graduate, getting paid €1,340/month during dual vocational training while earning a world-recognized nursing degree is an incredible opportunity.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFD] text-[#1B3270] font-sans antialiased selection:bg-[#7EB3E8]/20 selection:text-[#1B3270] pb-20 md:pb-0 overflow-x-hidden">
      {/* ─────────────────────────────────────────────────────────────
          STICKY CTA (persistent across entire page)
      ───────────────────────────────────────────────────────────── */}
      {/* Desktop Floating CTA */}
      <div className="hidden md:block fixed bottom-8 right-8 z-50">
        <button
          onClick={handleCtaClick}
          className="group inline-flex items-center space-x-3 px-6 py-3.5 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] shadow-[0_6px_20px_rgba(27,50,112,0.28)] hover:bg-[#2952A3] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>Take Free Diagnostic Test</span>
          <ArrowRight className="w-4 h-4 text-[#7EB3E8] group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Mobile Fixed Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1B3270] p-4 shadow-[0_-4px_16px_rgba(27,50,112,0.25)] pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          onClick={handleCtaClick}
          className="w-full py-3.5 bg-[#2952A3] text-white text-sm font-semibold rounded-[6px] text-center hover:bg-[#1B3270] active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
        >
          <span>Take Free Diagnostic Test</span>
          <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP NAVBAR
      ───────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white/95 border-b border-[#E2E8F4] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 sm:h-20 flex items-center justify-between">
          {/* Brand Logo with Official Horizontal TerraTern Logo */}
          <div
            className="flex items-center cursor-pointer py-1"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img
              src="/images/terratern-logo-horizontal.png?v=2"
              alt="TerraTern Logo"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </div>

          {/* Desktop Right Side: Nav Links for Employers, Channel Partners ending with Register button */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <a
              href="#for-employers"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('for-employers')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-semibold text-[#4A5568] hover:text-[#1B3270] transition-colors"
            >
              For Employers
            </a>
            <a
              href="#for-suppliers"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('for-suppliers')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-semibold text-[#4A5568] hover:text-[#1B3270] transition-colors"
            >
              For Channel Partners
            </a>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-semibold text-[#1B3270] hover:text-[#2952A3] transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register?role=candidate')}
              className="px-6 py-2.5 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] hover:bg-[#2952A3] transition-all shadow-[0_2px_8px_rgba(27,50,112,0.15)] active:scale-[0.99]"
            >
              Register
            </button>
          </div>

          {/* Mobile Hamburger & Register Button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => navigate('/login')}
              className="px-2.5 py-1.5 text-[#1B3270] text-xs font-semibold hover:text-[#2952A3]"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register?role=candidate')}
              className="px-3.5 py-1.5 bg-[#1B3270] text-white text-xs font-semibold rounded-[6px]"
            >
              Register
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#1B3270] hover:bg-[#F8FAFD] rounded-md border border-[#E2E8F4]"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#E2E8F4] px-5 py-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <a
              href="#for-employers"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                document.getElementById('for-employers')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="block p-2.5 rounded text-sm font-semibold text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]"
            >
              For Employers
            </a>
            <a
              href="#for-suppliers"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                document.getElementById('for-suppliers')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="block p-2.5 rounded text-sm font-semibold text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]"
            >
              For Channel Partners
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
              className="w-full mt-2 py-2 border border-[#1B3270] text-[#1B3270] text-sm font-semibold rounded-[6px] text-center"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/register?role=candidate');
              }}
              className="w-full mt-2 py-2.5 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] text-center"
            >
              Register as Candidate
            </button>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO
      ───────────────────────────────────────────────────────────── */}
      <section className="w-full bg-[#F8FAFD] pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Hero Headline & CTA */}
            <div className="lg:col-span-7 text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-4 shadow-[0_1px_3px_rgba(27,50,112,0.05)]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                <span>Active German Clinical Hiring 2026/2027</span>
              </div>

              <h1 className="text-[32px] sm:text-[44px] leading-[1.18] font-bold text-[#1B3270] tracking-tight mb-4">
                Start your healthcare career in Germany
              </h1>

              <p className="text-[#4A5568] text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
                Take the free, 15-minute Diagnostic Test today. No documents required, zero candidate placement fees, and instant feedback on your clinical readiness and German language qualification roadmap.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8">
                <button
                  onClick={handleCtaClick}
                  className="h-12 px-7 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] shadow-[0_4px_14px_rgba(27,50,112,0.20)] hover:bg-[#2952A3] transition-all duration-200 flex items-center justify-center space-x-2.5 active:scale-[0.99]"
                >
                  <span>Take Free Diagnostic Test</span>
                  <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
                </button>
                <div className="flex items-center text-xs text-[#94A3B8] sm:pl-2 font-medium">
                  <span>Takes 15 mins • No credit card • Instant benchmark score</span>
                </div>
              </div>

              {/* Three Value Micro-Cards with generous padding and breathing room */}
              <div className="pt-6 border-t border-[#E2E8F4] grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3.5 hover:border-[#7EB3E8] transition-all shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
                  <div className="text-sm font-bold text-[#1B3270] flex items-center">
                    <div className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mr-2 shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    100% Free
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">No candidate fees ever</div>
                </div>

                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3.5 hover:border-[#7EB3E8] transition-all shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
                  <div className="text-sm font-bold text-[#1B3270] flex items-center">
                    <div className="w-5 h-5 rounded-full bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center mr-2 shrink-0">
                      <Clock className="w-3 h-3" />
                    </div>
                    15 Minutes
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">Instant benchmark score</div>
                </div>

                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3.5 hover:border-[#7EB3E8] transition-all shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
                  <div className="text-sm font-bold text-[#1B3270] flex items-center">
                    <div className="w-5 h-5 rounded-full bg-[#7EB3E8]/20 text-[#2952A3] flex items-center justify-center mr-2 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                    No Docs Needed
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">Begin with zero paperwork</div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Photo with Trust Badges */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-[12px] overflow-hidden border border-[#E2E8F4] shadow-[0_12px_36px_rgba(27,50,112,0.10)] bg-white">
                <img
                  src="/images/hero-nurses.jpg"
                  alt="Professional international healthcare team in a modern German hospital"
                  className="w-full h-[340px] sm:h-[400px] object-cover object-center"
                />

                {/* Floating Badge 1 (Top Left) */}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md border border-[#E2E8F4] rounded-[8px] p-3 shadow-[0_4px_12px_rgba(27,50,112,0.12)] flex items-center space-x-2.5 max-w-[260px]">
                  <div className="w-7 h-7 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-bold shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1B3270]">Accredited German Hospitals</div>
                    <div className="text-[10px] text-[#4A5568]">Munich • Frankfurt • Berlin</div>
                  </div>
                </div>

                {/* Floating Badge 2 (Bottom Right) */}
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md border border-[#E2E8F4] rounded-[8px] p-3 shadow-[0_4px_12px_rgba(27,50,112,0.12)] flex items-center space-x-2.5 max-w-[260px]">
                  <div className="w-7 h-7 rounded-full bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center font-bold shrink-0">
                    <Euro className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1B3270]">€2,800 – €3,800 / month</div>
                    <div className="text-[10px] text-[#10B981] font-medium">Tariff-regulated base pay (TVöD)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: ACCREDITATIONS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-8 sm:py-10 bg-white border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-widest text-[#94A3B8] font-bold text-center mb-6">
            Recognized &amp; Compliant Statutory Framework
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {complianceStandards.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-4 sm:p-5 text-center transition-all hover:border-[#2952A3] hover:shadow-sm"
              >
                <div className="text-sm font-bold text-[#1B3270] flex items-center justify-center mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#2952A3] mr-1.5 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <div className="text-xs text-[#4A5568] mb-1.5">{item.sub}</div>
                <div className="text-xs font-semibold text-[#10B981]">{item.seal}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: OPPORTUNITIES (Copy Left + Interactive Mini-Dashboard Right)
      ───────────────────────────────────────────────────────────── */}
      <section id="opportunities" className="py-16 sm:py-20 bg-white border-b border-[#E2E8F4] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top Section Header with proper margin */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs uppercase tracking-widest text-[#94A3B8] font-bold mb-2">
              HOW TERRATERN HELPS YOU
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-3">
              A World Of Opportunities Awaits
            </h2>
            <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed">
              Your clinical qualifications and nursing background could land you high-demand roles in Germany, fast-tracking your European career.
            </p>
          </div>

          {/* Two-Column Grid: Copy on Left, Mini-Dashboard on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Copy & Value Points */}
            <div className="lg:col-span-5 text-left">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#1B3270] tracking-tight leading-snug mb-4">
                Multiple roles from reputed employers
              </h3>
              <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed mb-6">
                Access a network of vetted clinical vacancies offering guaranteed contract stability, statutory tariff salaries, and long-term career growth.
              </p>

              {/* Bullet points with emerald checkmark icons */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3.5">
                  <div className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <p className="text-sm text-[#4A5568] leading-relaxed">
                    Every hospital on TerraTern is rigorously verified to sponsor your visa, handle your state licensing (Landesprüfungsamt), and provide subsidized accommodation.
                  </p>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <p className="text-sm text-[#4A5568] leading-relaxed">
                    Our AI skill-matching aligns your clinical specialty directly with active hospital ward quotas, resulting in an 85% employer satisfaction rating.
                  </p>
                </div>
              </div>

              {/* Stats Strip with spacious padding */}
              <div className="mb-8 p-4 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] flex items-center justify-between text-center">
                <div>
                  <div className="text-base font-bold text-[#1B3270]">4.2 Mos</div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">Avg. Placement</div>
                </div>
                <div className="h-7 w-px bg-[#E2E8F4]" />
                <div>
                  <div className="text-base font-bold text-[#10B981]">100% Free</div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">Candidate Policy</div>
                </div>
                <div className="h-7 w-px bg-[#E2E8F4]" />
                <div>
                  <div className="text-base font-bold text-[#2952A3]">TVöD-P</div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">Tariff Protected</div>
                </div>
              </div>

              {/* Primary CTA Button */}
              <div>
                <button
                  onClick={handleCtaClick}
                  className="h-11 px-7 bg-[#1B3270] hover:bg-[#2952A3] text-white text-sm font-semibold rounded-[6px] shadow-[0_2px_8px_rgba(27,50,112,0.18)] hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center space-x-2"
                >
                  <span>Sign Up Now</span>
                  <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
                </button>
              </div>
            </div>

            {/* Right Column: Interactive Mini-Dashboard Window (Spacious & De-congested) */}
            <div className="lg:col-span-7 relative">
              {/* Decorative Dot Matrix Grid Behind Card */}
              <div className="hidden sm:block absolute -bottom-6 -right-6 w-48 h-48 pointer-events-none opacity-40 z-0">
                <div className="grid grid-cols-6 gap-4">
                  {[...Array(36)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  ))}
                </div>
              </div>

              {/* Software Card Window */}
              <div className="relative z-10 bg-white border border-[#E2E8F4] rounded-[14px] shadow-[0_12px_36px_rgba(27,50,112,0.08)] p-5 sm:p-6">
                {/* Top Filter Bar */}
                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center space-x-2.5 flex-1 min-w-[240px]">
                    <Sparkles className="w-4 h-4 text-[#2952A3] shrink-0" />
                    <span className="text-[#4A5568] hidden sm:inline">Hospital network filter:</span>
                    <select
                      value={selectedRoleFilter}
                      onChange={(e) => {
                        setSelectedRoleFilter(e.target.value);
                        setMiniDashboardPage(1);
                      }}
                      className="bg-white border border-[#E2E8F4] text-[#1B3270] font-semibold rounded-[6px] px-3 py-1.5 text-xs focus:outline-none focus:border-[#2952A3] cursor-pointer"
                    >
                      <option value="all">All Roles</option>
                      <option value="nursing">Nurse (ICU &amp; Ward)</option>
                      <option value="ausbildung">Ausbildung Trainee</option>
                      <option value="care">Elderly &amp; Care</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[#94A3B8] hidden md:inline text-xs">in Germany</span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#E2E8F4] text-[#2952A3] rounded-[6px]">
                      + {filteredJobs.length} live
                    </span>
                  </div>
                </div>

                {/* Split Panes: Roles List Left (40%) & Active Preview Right (60%) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch min-h-[380px]">
                  {/* Left Sub-Pane: List of Roles with Circular Match Ring */}
                  <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-[#E2E8F4] pb-4 md:pb-0 md:pr-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#94A3B8] mb-2 px-1">
                        Showing {paginatedJobs.length} of {filteredJobs.length} roles
                      </div>

                      <div className="space-y-2">
                        {loadingJobs ? (
                          <div className="py-12 text-center text-xs text-[#94A3B8]">
                            Loading active positions...
                          </div>
                        ) : paginatedJobs.length === 0 ? (
                          <div className="py-12 text-center text-xs text-[#94A3B8]">
                            No roles match criteria
                          </div>
                        ) : (
                          paginatedJobs.map((job, idx) => {
                            const isSelected = activePreviewJob?.id === job.id;
                            const matchPercentage = [98, 95, 92, 89, 86, 84][idx % 6];

                            return (
                              <div
                                key={job.id}
                                onClick={() => setActivePreviewJobId(job.id)}
                                className={`cursor-pointer p-3 rounded-[8px] transition-all flex items-center justify-between gap-2.5 border ${
                                  isSelected
                                    ? 'bg-[#F8FAFD] border-[#2952A3] shadow-sm'
                                    : 'border-transparent hover:bg-[#F8FAFD]/70 hover:border-[#E2E8F4]'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-[#1B3270]/10 text-[#1B3270] font-bold text-xs flex items-center justify-center shrink-0">
                                    {job.role_type === 'ausbildung' ? 'AU' : job.role_type === 'care' ? 'GC' : 'RN'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-[#1B3270] truncate leading-tight">
                                      {job.title.replace(/—.*/, '').trim()}
                                    </div>
                                    <div className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                                      {job.location.split(',')[0]} • Germany 🇩🇪
                                    </div>
                                  </div>
                                </div>

                                {/* Circular Match Score Indicator */}
                                <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                                    <path
                                      className="text-[#E2E8F4]"
                                      strokeWidth="3.2"
                                      stroke="currentColor"
                                      fill="none"
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                      className="text-[#2952A3]"
                                      strokeDasharray={`${matchPercentage}, 100`}
                                      strokeWidth="3.2"
                                      strokeLinecap="round"
                                      stroke="currentColor"
                                      fill="none"
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                  </svg>
                                  <span className="absolute text-[9px] font-bold text-[#1B3270]">
                                    {matchPercentage}%
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-between text-xs text-[#4A5568]">
                        <button
                          disabled={miniDashboardPage === 1}
                          onClick={() => setMiniDashboardPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 border border-[#E2E8F4] rounded-[4px] bg-white hover:bg-[#F8FAFD] disabled:opacity-40 font-semibold"
                        >
                          ‹ Previous
                        </button>
                        <span>
                          Page {miniDashboardPage} of {totalPages}
                        </span>
                        <button
                          disabled={miniDashboardPage === totalPages}
                          onClick={() => setMiniDashboardPage((p) => Math.min(totalPages, p + 1))}
                          className="px-2.5 py-1 border border-[#E2E8F4] rounded-[4px] bg-white hover:bg-[#F8FAFD] disabled:opacity-40 font-semibold"
                        >
                          Next ›
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Sub-Pane: Live Active Selected Profile View */}
                  <div className="md:col-span-7 md:pl-2 flex flex-col justify-between">
                    {activePreviewJob ? (
                      <div>
                        {/* Header with Title & Bookmark */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-[#1B3270] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h4 className="text-sm sm:text-base font-bold text-[#1B3270] leading-snug">
                                {activePreviewJob.title}
                              </h4>
                              <div className="text-xs text-[#4A5568] flex items-center mt-1">
                                <MapPin className="w-3.5 h-3.5 text-[#2952A3] mr-1" />
                                <span>{activePreviewJob.location}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            title="Save requirement"
                            className="p-1.5 text-[#94A3B8] hover:text-[#1B3270] rounded-[6px] border border-[#E2E8F4] bg-white transition-colors"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Description with readable line-height */}
                        <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed mb-4">
                          {activePreviewJob.description ||
                            'Accredited clinical position in Germany. Full-time tariff-regulated compensation with comprehensive hospital ward onboarding.'}
                        </p>

                        {/* Action Buttons Row */}
                        <div className="flex items-center space-x-3 mb-4">
                          <button
                            onClick={() => setSelectedJob(activePreviewJob)}
                            className="px-3.5 py-1.5 bg-[#F8FAFD] hover:bg-[#E2E8F4] border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-[#1B3270] transition-colors"
                          >
                            View details
                          </button>
                          <button
                            onClick={handleCtaClick}
                            className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-sm"
                          >
                            <span>Apply via Diagnostic</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#7EB3E8]" />
                          </button>
                        </div>

                        {/* 6 Attribute Info Cards with generous padding and readable text */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                          <div className="p-2.5 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4]">
                            <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Contract</div>
                            <div className="text-xs font-bold text-[#1B3270] mt-0.5">Permanent (TVöD)</div>
                          </div>
                          <div className="p-2.5 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4]">
                            <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Gross Salary</div>
                            <div className="text-xs font-bold text-[#10B981] mt-0.5">€3,200 – €3,950/mo</div>
                          </div>
                          <div className="p-2.5 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4]">
                            <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Language</div>
                            <div className="text-xs font-bold text-[#2952A3] mt-0.5">B1 / B2 Standard</div>
                          </div>
                          <div className="p-2.5 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4]">
                            <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Shift Bonus</div>
                            <div className="text-xs font-bold text-[#1B3270] mt-0.5">+25% to +35%</div>
                          </div>
                          <div className="p-2.5 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4]">
                            <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Vacation</div>
                            <div className="text-xs font-bold text-[#1B3270] mt-0.5">30 Days / Year</div>
                          </div>
                          <div className="p-2.5 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4]">
                            <div className="text-[10px] text-[#94A3B8] uppercase font-semibold">Relocation</div>
                            <div className="text-xs font-bold text-[#10B981] mt-0.5">Full Visa Sponsored</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-[#94A3B8]">
                        Select a position from the list to preview details
                      </div>
                    )}

                    {/* Bottom Status Banner */}
                    <div className="mt-4 pt-3 border-t border-[#E2E8F4] flex items-center justify-between text-xs">
                      <div className="text-[#4A5568] flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] mr-1.5 shrink-0" />
                        <span>Pre-vetted hospital requirement</span>
                      </div>
                      <button
                        onClick={handleCtaClick}
                        className="text-[#2952A3] hover:underline font-bold"
                      >
                        Check If You Qualify →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Read-Only Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B3270]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] max-w-xl w-full p-6 sm:p-7 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2E8F4] text-[#1B3270] capitalize mb-2">
                  {selectedJob.role_type}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-[#1B3270]">
                  {selectedJob.title}
                </h3>
                <div className="flex items-center text-xs sm:text-sm text-[#4A5568] mt-1">
                  <MapPin className="w-4 h-4 text-[#2952A3] mr-1" />
                  <span>{selectedJob.location || 'Germany'}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-[#94A3B8] hover:text-[#1B3270] p-1.5 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 border-t border-b border-[#E2E8F4] my-4 text-sm text-[#4A5568] leading-relaxed space-y-3">
              <div>
                <h4 className="font-semibold text-[#1B3270] text-sm mb-1.5">
                  Role Overview
                </h4>
                <p className="whitespace-pre-line">
                  {selectedJob.description || 'Full-time nursing and healthcare position in an accredited German clinical facility.'}
                </p>
              </div>
              <div className="bg-[#F8FAFD] p-3.5 rounded-[8px] border border-[#E2E8F4]">
                <p className="font-semibold text-[#1B3270] text-xs">
                  Candidate Anonymity &amp; Matching Standard:
                </p>
                <p className="text-xs text-[#4A5568] mt-1 leading-relaxed">
                  Employer names remain masked until verified matching. Applications unlock automatically once you complete the 5-gate qualification process and reach &apos;Interview Ready&apos;.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-xs text-[#94A3B8]">
                Public preview • Free qualification required
              </span>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  handleCtaClick();
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#1B3270] text-white text-xs sm:text-sm font-semibold rounded-[6px] hover:bg-[#2952A3] transition-colors flex items-center justify-center space-x-2"
              >
                <span>Check If You Qualify</span>
                <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: ELIGIBILITY (Interactive Self-Checker)
      ───────────────────────────────────────────────────────────── */}
      <section id="eligibility" className="py-16 sm:py-20 bg-[#F8FAFD] border-b border-[#E2E8F4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3 shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Simple Requirements</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-2">
              Are You Eligible?
            </h2>
            <p className="text-sm sm:text-base text-[#4A5568]">
              Review and click to check your baseline qualifications for German hospital placement.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-10">
            {/* Left Column: Interactive Criteria Checklist with generous padding */}
            <div className="lg:col-span-7 bg-white border border-[#E2E8F4] rounded-[10px] p-6 sm:p-7 shadow-[0_1px_4px_rgba(27,50,112,0.06)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
                  <h3 className="text-base font-bold text-[#1B3270]">
                    Qualification Checklist
                  </h3>
                  <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-full">
                    {checkedCriteria.length} of 5 Checked
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      title: 'Recognized Healthcare Degree / Diploma',
                      desc: 'B.Sc. Nursing, GNM, General Nursing Diploma, or high school for vocational Ausbildung.',
                    },
                    {
                      title: 'Commitment to Learn German',
                      desc: 'Willingness to study up to B1/B2 level. No prior certification needed to take the Diagnostic Test.',
                    },
                    {
                      title: 'Professional Integrity & Clean Record',
                      desc: 'Active nursing registration in your home country with clean clinical standing.',
                    },
                    {
                      title: 'Clinical Experience',
                      desc: 'Minimum 6 months bedside or ward experience preferred (fresh graduates eligible for Ausbildung).',
                    },
                    {
                      title: 'Long-Term Relocation Readiness',
                      desc: 'Genuine motivation to build a stable, long-term healthcare career in Germany.',
                    },
                  ].map((item, idx) => {
                    const isChecked = checkedCriteria.includes(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleCriteria(idx)}
                        className={`cursor-pointer p-3 sm:p-3.5 rounded-[8px] border transition-all flex items-start space-x-3.5 ${
                          isChecked
                            ? 'bg-[#F8FAFD] border-[#10B981]/40'
                            : 'bg-white border-[#E2E8F4] opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isChecked
                              ? 'bg-[#10B981] text-white font-bold'
                              : 'border border-[#E2E8F4] bg-white text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-[#1B3270]">
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#4A5568] mt-1 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Assessment Banner */}
              <div className="mt-5 pt-4 border-t border-[#E2E8F4] flex items-center justify-between text-xs sm:text-sm">
                <div className="text-[#10B981] font-semibold flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />
                  <span>
                    {checkedCriteria.length === 5
                      ? '100% Match: You are fully eligible for direct hospital placement!'
                      : `${checkedCriteria.length}/5 Met: You qualify for preparatory pathways!`}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Preview Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#1B3270] to-[#2952A3] rounded-[10px] p-6 sm:p-7 text-white shadow-[0_4px_16px_rgba(27,50,112,0.15)] flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#7EB3E8]/20 text-[#7EB3E8] mb-4">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Instant Diagnostic Benchmark
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  Find out exactly where you stand
                </h3>
                <p className="text-xs sm:text-sm text-[#E2E8F4]/80 leading-relaxed mb-6">
                  Our algorithm benchmarks your clinical decision-making and language readiness to generate your personalized 5-gate qualification roadmap.
                </p>

                <div className="space-y-3 mb-6 text-xs sm:text-sm">
                  <div className="flex items-center justify-between p-3 bg-white/10 rounded-[8px]">
                    <span className="text-[#E2E8F4]">Clinical Core Score</span>
                    <span className="font-bold text-[#10B981]">Instant Feedback</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/10 rounded-[8px]">
                    <span className="text-[#E2E8F4]">German Recommendation</span>
                    <span className="font-bold text-[#7EB3E8]">A2 / B1 / B2</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/10 rounded-[8px]">
                    <span className="text-[#E2E8F4]">Custom Roadmap</span>
                    <span className="font-bold text-white">5 Gate Milestones</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCtaClick}
                className="w-full py-3 bg-white text-[#1B3270] hover:bg-[#F8FAFD] text-sm font-bold rounded-[6px] transition-colors flex items-center justify-center space-x-2 shadow-sm"
              >
                <span>Take Diagnostic Test</span>
                <ArrowRight className="w-4 h-4 text-[#1B3270]" />
              </button>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleCtaClick}
              className="inline-flex items-center px-6 py-3 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] hover:bg-[#2952A3] transition-all"
            >
              <span>Start Free Diagnostic Test</span>
              <ArrowRight className="w-4 h-4 ml-2 text-[#7EB3E8]" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: PROCESS (Single Path with Small Boxes, Arrow Marks & Moving Blink)
      ───────────────────────────────────────────────────────────── */}
      <section id="process" className="py-16 sm:py-20 bg-white border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3 shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
              <Compass className="w-3.5 h-3.5" />
              <span>Step-by-Step Qualification Roadmap</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-3">
              Your Journey to Germany
            </h2>
            <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed">
              A transparent, locked 6-step pathway from clinical readiness to direct hospital placement. Zero candidate fees at every gate.
            </p>
          </div>

          {/* Desktop Single Path (Horizontal Row of Small Boxes Connected with Arrow Marks and Moving Blink) */}
          <div className="hidden lg:flex items-center justify-between gap-1 xl:gap-2 mb-8">
            {journeySteps.map((step, idx) => {
              const isActive = activeJourneyStep === idx;
              const isPassed = activeJourneyStep > idx;
              const StepIcon = step.icon;

              return (
                <React.Fragment key={step.gate}>
                  {/* Small Box */}
                  <div
                    onClick={() => setActiveJourneyStep(idx)}
                    className={`flex-1 min-w-0 p-3 sm:p-3.5 rounded-[10px] border transition-all duration-300 cursor-pointer text-left ${
                      isActive
                        ? 'border-[#2952A3] ring-2 ring-[#2952A3]/20 bg-white shadow-[0_4px_16px_rgba(41,82,163,0.12)] -translate-y-1'
                        : isPassed
                        ? 'border-[#CBD5E1] bg-[#F8FAFD] hover:border-[#2952A3]/50'
                        : 'border-[#E2E8F4] bg-white hover:border-[#CBD5E1] shadow-[0_1px_3px_rgba(27,50,112,0.04)]'
                    }`}
                  >
                    {/* Header: Gate Label + Animated Blink / Dot */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isActive ? 'text-[#2952A3]' : isPassed ? 'text-[#10B981]' : 'text-[#64748B]'
                        }`}
                      >
                        {step.gate}
                      </span>
                      {isActive ? (
                        <div className="flex items-center space-x-1">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981] ring-2 ring-[#10B981]/30" />
                          </span>
                          <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-wider">
                            Live
                          </span>
                        </div>
                      ) : isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                      )}
                    </div>

                    {/* Icon & Title */}
                    <div className="flex items-center space-x-2 mb-1.5">
                      <div
                        className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-300 ${
                          isActive
                            ? 'bg-[#1B3270] text-white shadow-xs'
                            : isPassed
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'bg-[#F8FAFD] text-[#2952A3] border border-[#E2E8F4]'
                        }`}
                      >
                        <StepIcon className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-[#1B3270] truncate leading-tight">
                        {step.title}
                      </h4>
                    </div>

                    {/* 1-Line Description */}
                    <p className="text-[11px] text-[#64748B] leading-tight truncate mb-2">
                      {step.shortDesc}
                    </p>

                    {/* Tag Chip */}
                    <span
                      className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full inline-block truncate max-w-full ${
                        isActive
                          ? 'bg-[#10B981]/15 text-[#047857]'
                          : isPassed
                          ? 'bg-[#2952A3]/10 text-[#2952A3]'
                          : 'bg-[#F1F5F9] text-[#64748B]'
                      }`}
                    >
                      {step.tag}
                    </span>
                  </div>

                  {/* Connecting Arrow Mark with Pulse */}
                  {idx < journeySteps.length - 1 && (
                    <div className="flex items-center justify-center px-1 shrink-0">
                      <div className="relative flex items-center justify-center">
                        <ArrowRight
                          className={`w-4 h-4 xl:w-5 xl:h-5 transition-all duration-300 ${
                            isActive
                              ? 'text-[#10B981] scale-125 stroke-[2.5]'
                              : isPassed
                              ? 'text-[#2952A3]'
                              : 'text-[#CBD5E1]'
                          }`}
                        />
                        {isActive && (
                          <span className="absolute -top-1 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Mobile & Tablet Single Path (Vertical Sequential Path of Small Boxes Connected with Arrow Marks) */}
          <div className="lg:hidden flex flex-col items-center space-y-2 max-w-md mx-auto mb-8">
            {journeySteps.map((step, idx) => {
              const isActive = activeJourneyStep === idx;
              const isPassed = activeJourneyStep > idx;
              const StepIcon = step.icon;

              return (
                <React.Fragment key={step.gate}>
                  {/* Small Box */}
                  <div
                    onClick={() => setActiveJourneyStep(idx)}
                    className={`w-full p-3.5 rounded-[10px] border transition-all duration-300 cursor-pointer text-left ${
                      isActive
                        ? 'border-[#2952A3] ring-2 ring-[#2952A3]/20 bg-white shadow-[0_4px_16px_rgba(41,82,163,0.12)]'
                        : isPassed
                        ? 'border-[#CBD5E1] bg-[#F8FAFD]'
                        : 'border-[#E2E8F4] bg-white hover:border-[#CBD5E1] shadow-[0_1px_3px_rgba(27,50,112,0.04)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            isActive ? 'text-[#2952A3]' : isPassed ? 'text-[#10B981]' : 'text-[#64748B]'
                          }`}
                        >
                          {step.gate}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-[#10B981]/15 text-[#047857]'
                              : isPassed
                              ? 'bg-[#2952A3]/10 text-[#2952A3]'
                              : 'bg-[#F1F5F9] text-[#64748B]'
                          }`}
                        >
                          {step.tag}
                        </span>
                      </div>

                      {/* Animated Blink on Mobile */}
                      {isActive ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
                          </span>
                          <span className="text-[10px] font-bold text-[#10B981]">Active</span>
                        </div>
                      ) : isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-[#1B3270] text-white'
                            : isPassed
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'bg-[#F8FAFD] text-[#2952A3] border border-[#E2E8F4]'
                        }`}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-[#1B3270] truncate">
                          {step.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#64748B] truncate">
                          {step.shortDesc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Downward Arrow Mark */}
                  {idx < journeySteps.length - 1 && (
                    <div className="py-1 flex items-center justify-center">
                      <ArrowDown
                        className={`w-4 h-4 transition-all duration-300 ${
                          isActive
                            ? 'text-[#10B981] scale-125 stroke-[2.5]'
                            : isPassed
                            ? 'text-[#2952A3]'
                            : 'text-[#CBD5E1]'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Active Milestone Card Strip */}
          <div className="max-w-3xl mx-auto bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-4 sm:p-5 shadow-xs transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3 text-left min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#1B3270] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  0{activeJourneyStep + 1}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-bold text-[#2952A3] uppercase tracking-wider">
                      {journeySteps[activeJourneyStep].gate}: {journeySteps[activeJourneyStep].title}
                    </span>
                    <span className="text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
                      {journeySteps[activeJourneyStep].tag}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#4A5568] mt-1 leading-relaxed">
                    {journeySteps[activeJourneyStep].detail}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCtaClick}
                className="shrink-0 w-full sm:w-auto px-5 py-2.5 bg-[#1B3270] text-white text-xs font-semibold rounded-[6px] hover:bg-[#2952A3] transition-all flex items-center justify-center space-x-1.5 shadow-sm active:scale-[0.98]"
              >
                <span>Start Qualification</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#7EB3E8]" />
              </button>
            </div>

            {/* Moving Blink Step Indicator Pips */}
            <div className="flex items-center justify-center space-x-2 mt-4 pt-3 border-t border-[#E2E8F4]/80">
              {journeySteps.map((step, i) => (
                <button
                  key={step.gate}
                  onClick={() => setActiveJourneyStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeJourneyStep === i
                      ? 'w-7 bg-[#2952A3]'
                      : 'w-2 bg-[#CBD5E1] hover:bg-[#94A3B8]'
                  }`}
                  aria-label={`Jump to ${step.gate}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: WHAT YOU GET (De-congested & Spacious Layout)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-[#F8FAFD] border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>The German Career Advantage</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-2">
              Life After Placement
            </h2>
            <p className="text-sm sm:text-base text-[#4A5568]">
              Long-term stability, career progression, and structured support in Germany.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center mb-12">
            {/* Left: 4 Value Proposition Cards with generous padding */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {[
                {
                  icon: Award,
                  title: 'Career Specialization',
                  desc: 'Access specialist nursing pathways in ICU, Surgical, Anesthesia, and Ward Management with subsidized continuous education.',
                },
                {
                  icon: Euro,
                  title: 'Regulated German Salary',
                  desc: 'Tariff-regulated base pay of €2,800 to €3,800+ gross monthly, plus shift bonuses, overtime pay, and statutory pension contributions.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Visa & Anerkennung Handled',
                  desc: 'Certified translations, document apostille, and official German employment visa processing managed end-to-end with zero fees.',
                },
                {
                  icon: HeartHandshake,
                  title: 'Post-Arrival Integration',
                  desc: 'Airport reception, initial housing assistance, health insurance registration, and local integration onboarding across Germany.',
                },
              ].map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 sm:p-7 shadow-[0_1px_4px_rgba(27,50,112,0.05)] flex flex-col justify-between hover:border-[#7EB3E8] hover:shadow-[0_6px_20px_rgba(27,50,112,0.08)] transition-all"
                  >
                    <div>
                      <div className="w-11 h-11 rounded-[10px] bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center mb-4">
                        <Icon className="w-5 h-5 text-[#1B3270]" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1B3270] mb-2">
                        {card.title}
                      </h3>
                      <p className="text-sm text-[#4A5568] leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Hospital Clinical Photo with Quote Card */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-[12px] overflow-hidden border border-[#E2E8F4] shadow-[0_12px_36px_rgba(27,50,112,0.10)] bg-white relative">
                <img
                  src="/images/german-clinic-life.jpg"
                  alt="International nurse reviewing patient records in a German hospital"
                  className="w-full h-[360px] sm:h-[420px] object-cover object-center"
                />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1B3270]/95 via-[#1B3270]/50 to-transparent p-5 sm:p-6 text-white">
                  <div className="text-xs font-semibold text-[#7EB3E8] uppercase tracking-wider mb-1">
                    German Hospital Experience
                  </div>
                  <p className="text-sm sm:text-base font-medium leading-relaxed mb-2">
                    &ldquo;Collaborative clinical teams, state-of-the-art medical technology, and respected professional standing.&rdquo;
                  </p>
                  <p className="text-xs text-[#E2E8F4]/80">
                    Internal Medicine Ward • Germany
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleCtaClick}
              className="inline-flex items-center px-6 py-3 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] hover:bg-[#2952A3] transition-all"
            >
              <span>See If You Qualify</span>
              <ArrowRight className="w-4 h-4 ml-2 text-[#7EB3E8]" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: FEATURES (Why TerraTern - Well-Proportioned Cards)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white border-b border-[#E2E8F4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Platform Transparency</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-2">
              Why TerraTern
            </h2>
            <p className="text-sm sm:text-base text-[#4A5568]">
              A transparent, ethical platform connecting qualified talent with German hospitals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: ShieldCheck,
                label: 'Verified Suppliers',
                desc: 'Audited sourcing agencies and partner training institutions adhering to strict international standards.',
                color: 'text-[#1B3270] bg-[#1B3270]/10',
              },
              {
                icon: Compass,
                label: 'Transparent Process',
                desc: 'Real-time visibility into every gate and milestone with zero hidden requirements or surprise fees.',
                color: 'text-[#2952A3] bg-[#2952A3]/10',
              },
              {
                icon: HeartHandshake,
                label: 'Free Access',
                desc: 'No placement or agency charges for candidates, strictly adhering to ethical German healthcare mobility standards.',
                color: 'text-[#10B981] bg-[#10B981]/10',
              },
              {
                icon: CheckCircle2,
                label: 'Tracked Progress',
                desc: 'Step-by-step gate assessments ensuring you advance only when fully prepared and supported.',
                color: 'text-[#2952A3] bg-[#7EB3E8]/20',
              },
              {
                icon: Building2,
                label: 'Compliance-First',
                desc: 'Built around the German "Faire Anwerbung Pflege" and Federal Employment Agency regulations.',
                color: 'text-[#1B3270] bg-[#1B3270]/10',
              },
              {
                icon: Users,
                label: 'Dedicated Support',
                desc: 'Direct platform coordination from your initial diagnostic test to your hospital ward onboarding.',
                color: 'text-[#10B981] bg-[#10B981]/10',
              },
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-6 sm:p-7 shadow-[0_1px_4px_rgba(27,50,112,0.04)] hover:bg-white hover:border-[#7EB3E8] hover:shadow-[0_8px_24px_rgba(27,50,112,0.08)] hover:-translate-y-1 transition-all duration-200"
                >
                  <div
                    className={`w-12 h-12 rounded-[10px] flex items-center justify-center mb-4 shadow-sm ${feat.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#1B3270] mb-2">
                    {feat.label}
                  </h3>
                  <p className="text-sm text-[#4A5568] leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: FOR HEALTHCARE EMPLOYERS (German Hospitals & Care Homes)
      ───────────────────────────────────────────────────────────── */}
      <section id="for-employers" className="py-16 sm:py-20 bg-[#F8FAFD] border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Employer Value Proposition */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#1B3270] mb-4 shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-[#2952A3]" />
                <span>For German Healthcare Providers &amp; Clinical Groups</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight leading-tight mb-4">
                Solve Clinical Staffing Deficits with Pre-Qualified International Nurses
              </h2>

              <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed mb-6">
                Access an accredited, regulated pipeline of certified foreign healthcare professionals rigorously audited through Germany&apos;s 5-gate clinical and linguistic standard. We eliminate bureaucratic bottlenecks so your wards remain reliably staffed.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-sm hover:border-[#7EB3E8] transition-colors">
                  <div className="w-9 h-9 rounded-[8px] bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center font-bold text-xs mb-3">
                    <ShieldCheck className="w-5 h-5 text-[#1B3270]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    100% Gate-Verified Credentials
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Diplomas, academic transcripts, and clinical bedside references authenticated prior to presentation on your hiring portal.
                  </p>
                </div>

                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-sm hover:border-[#7EB3E8] transition-colors">
                  <div className="w-9 h-9 rounded-[8px] bg-[#2952A3]/10 text-[#2952A3] flex items-center justify-center font-bold text-xs mb-3">
                    <Award className="w-5 h-5 text-[#2952A3]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    Clinical German (Fachsprache)
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    B1/B2 certified candidates trained in German clinical terminology, emergency communication, and digital EHR ward charting.
                  </p>
                </div>

                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-sm hover:border-[#7EB3E8] transition-colors">
                  <div className="w-9 h-9 rounded-[8px] bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-bold text-xs mb-3">
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    Direct Hospital Interviews
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Review candidate dossiers and conduct structured video interviews directly through the platform with zero intermediary delays.
                  </p>
                </div>

                <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-sm hover:border-[#7EB3E8] transition-colors">
                  <div className="w-9 h-9 rounded-[8px] bg-[#7EB3E8]/20 text-[#2952A3] flex items-center justify-center font-bold text-xs mb-3">
                    <FileCheck className="w-5 h-5 text-[#2952A3]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    Turnkey Anerkennung &amp; Visas
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    End-to-end administration of Defizitbescheid, state licensing (Landesprüfungsamt), embassy fast-track visas, and relocation.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Hospital Employer Action Card */}
            <div className="lg:col-span-5 bg-white border border-[#E2E8F4] rounded-[12px] p-6 sm:p-7 shadow-[0_8px_24px_rgba(27,50,112,0.08)]">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1B3270]/10 text-[#1B3270] mb-4">
                <Building2 className="w-3.5 h-3.5" />
                <span>Employer Talent Terminal</span>
              </div>

              <h3 className="text-xl font-bold text-[#1B3270] mb-2">
                Healthcare Employer Portal
              </h3>
              <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed mb-6">
                Post clinical positions, manage ward requirements, and interview pre-screened nurses who are already qualified for hospital placement.
              </p>

              <div className="space-y-3 mb-6 text-xs sm:text-sm">
                <div className="flex items-center justify-between p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                  <span className="text-[#4A5568]">Active German Hospital Networks</span>
                  <span className="font-bold text-[#1B3270]">12+ Networks</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                  <span className="text-[#4A5568]">Statutory Tariff Protection</span>
                  <span className="font-bold text-[#10B981]">100% TVöD / AVR</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                  <span className="text-[#4A5568]">Candidate Recruitment Fees</span>
                  <span className="font-bold text-[#2952A3]">0€ Candidate-side (WHO Code)</span>
                </div>
              </div>

              <button
                onClick={handleEmployerCta}
                className="w-full py-3 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-[6px] shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <span>Access Employer Portal</span>
                <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
              </button>

              <p className="text-xs text-[#94A3B8] text-center mt-3">
                Accredited German clinics and care providers sign in directly to manage hiring pipelines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 9: FOR CHANNEL PARTNERS & NURSING ACADEMIES
      ───────────────────────────────────────────────────────────── */}
      <section id="for-suppliers" className="py-16 sm:py-20 bg-white border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Channel Partner Terminal Card */}
            <div className="lg:col-span-5 order-2 lg:order-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[12px] p-6 sm:p-7 shadow-[0_8px_24px_rgba(27,50,112,0.08)]">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#10B981] mb-4">
                <Users className="w-3.5 h-3.5" />
                <span>Channel Partner Terminal</span>
              </div>

              <h3 className="text-xl font-bold text-[#1B3270] mb-2">
                Channel Partner Portal
              </h3>
              <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed mb-6">
                Submit candidate rosters, monitor individual milestone telemetry in real time, and match qualified healthcare cohorts to active German hospital quotas.
              </p>

              <div className="space-y-3 mb-6 text-xs sm:text-sm">
                <div className="flex items-center justify-between p-3 bg-white border border-[#E2E8F4] rounded-[8px]">
                  <span className="text-[#4A5568]">Milestone Telemetry</span>
                  <span className="font-bold text-[#1B3270]">Real-Time 5 Gates</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white border border-[#E2E8F4] rounded-[8px]">
                  <span className="text-[#4A5568]">Verification Rejection Risk</span>
                  <span className="font-bold text-[#10B981]">Minimized via AI Pre-Check</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white border border-[#E2E8F4] rounded-[8px]">
                  <span className="text-[#4A5568]">Placement Standards</span>
                  <span className="font-bold text-[#2952A3]">Tariff Protected &amp; Transparent</span>
                </div>
              </div>

              <button
                onClick={handleSupplierCta}
                className="w-full py-3 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-[6px] shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <span>Access Channel Partner Portal</span>
                <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
              </button>

              <p className="text-xs text-[#94A3B8] text-center mt-3">
                Registered nursing academies and certified channel partners sign in directly.
              </p>
            </div>

            {/* Right Column: Channel Partner Value Proposition */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#10B981] mb-4 shadow-sm">
                <Users className="w-3.5 h-3.5 text-[#10B981]" />
                <span>For Channel Partners &amp; Nursing Academies</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight leading-tight mb-4">
                Empower Your Nursing Graduates with Ethical European Career Pathways
              </h2>

              <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed mb-6">
                TerraTern gives international nursing schools, training academies, and licensed staffing partners a certified infrastructure to place candidates into reputable German healthcare networks with absolute transparency and statutory compliance.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-5">
                  <div className="w-9 h-9 rounded-[8px] bg-white border border-[#E2E8F4] text-[#10B981] flex items-center justify-center font-bold text-xs mb-3 shadow-sm">
                    <Compass className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    Live Telemetry Tracking
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Monitor each candidate&apos;s stage progression through Document Verification, Speaking Tests, and Interview Matching live.
                  </p>
                </div>

                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-5">
                  <div className="w-9 h-9 rounded-[8px] bg-white border border-[#E2E8F4] text-[#1B3270] flex items-center justify-center font-bold text-xs mb-3 shadow-sm">
                    <ShieldCheck className="w-5 h-5 text-[#1B3270]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    WHO &amp; German Compliance
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Built in full adherence to the WHO Global Code of Practice and statutory German &quot;Faire Anwerbung Pflege&quot; benchmarks.
                  </p>
                </div>

                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-5">
                  <div className="w-9 h-9 rounded-[8px] bg-white border border-[#E2E8F4] text-[#2952A3] flex items-center justify-center font-bold text-xs mb-3 shadow-sm">
                    <Building2 className="w-5 h-5 text-[#2952A3]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    Direct Hospital Quotas
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Connect qualified nursing batches directly with pre-contracted university clinics and care consortiums seeking verified talent.
                  </p>
                </div>

                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-5">
                  <div className="w-9 h-9 rounded-[8px] bg-white border border-[#E2E8F4] text-[#7EB3E8] flex items-center justify-center font-bold text-xs mb-3 shadow-sm">
                    <FileCheck className="w-5 h-5 text-[#2952A3]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1B3270] mb-1.5">
                    Automated Equivalence Audits
                  </h3>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Pre-screen diplomas and academic transcripts to detect potential deficit notices early and ensure high visa success rates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 10: PARTNERS (Infinite Moving Marquee Slider)
      ───────────────────────────────────────────────────────────── */}
      <section id="partners" className="py-14 sm:py-16 bg-[#F8FAFD] border-b border-[#E2E8F4] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8 text-center">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3 shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
            <Building2 className="w-3.5 h-3.5" />
            <span>Accredited German Network</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-2">
            Who We Work With
          </h2>
          <p className="text-sm sm:text-base text-[#4A5568] max-w-2xl mx-auto">
            Collaborating with leading university clinics, municipal hospital consortiums, and accredited language training centers across Germany.
          </p>
        </div>

        {/* Infinite Marquee Track: Duplicated list for seamless loop */}
        <div className="relative w-full overflow-hidden group py-3">
          {/* Subtle gradient fades on edges */}
          <div className="absolute left-0 inset-y-0 w-16 sm:w-32 bg-gradient-to-r from-[#F8FAFD] to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 inset-y-0 w-16 sm:w-32 bg-gradient-to-l from-[#F8FAFD] to-transparent z-20 pointer-events-none" />

          <div className="animate-marquee flex items-center space-x-5">
            {[...partners, ...partners].map((p, idx) => (
              <div
                key={idx}
                className="w-72 sm:w-80 shrink-0 bg-white border border-[#E2E8F4] hover:border-[#2952A3] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.05)] hover:shadow-[0_6px_20px_rgba(27,50,112,0.10)] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-[6px] bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#1B3270]" />
                  </div>
                  <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-full">
                    {p.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#1B3270] mb-1 line-clamp-1">
                  {p.name}
                </h3>
                <div className="text-xs font-semibold text-[#2952A3] mb-2">
                  {p.type} • {p.beds}
                </div>
                <div className="text-xs text-[#4A5568] flex items-center">
                  <MapPin className="w-3.5 h-3.5 text-[#94A3B8] mr-1.5 shrink-0" />
                  <span className="line-clamp-1">{p.region}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 11: TESTIMONIALS (De-congested Spacious Cards)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white border-b border-[#E2E8F4] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-10 text-center">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3 shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
            <Users className="w-3.5 h-3.5" />
            <span>Verified Placements</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-2">
            Real Placements, Real Stories
          </h2>
          <p className="text-sm sm:text-base text-[#4A5568] max-w-2xl mx-auto">
            Healthcare professionals who completed the 5-gate roadmap and are now practicing in German hospital wards.
          </p>
        </div>

        {/* Infinite Marquee Track: Duplicated list for seamless loop */}
        <div className="relative w-full overflow-hidden group py-3 mb-10">
          {/* Subtle gradient fades on edges */}
          <div className="absolute left-0 inset-y-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 inset-y-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-20 pointer-events-none" />

          <div className="animate-marquee-slow flex items-center space-x-6">
            {[...testimonials, ...testimonials].map((t, idx) => (
              <div
                key={idx}
                className="w-[360px] sm:w-[410px] shrink-0 bg-[#F8FAFD] border border-[#E2E8F4] hover:border-[#7EB3E8] rounded-[12px] p-6 sm:p-7 shadow-[0_2px_8px_rgba(27,50,112,0.05)] hover:shadow-[0_8px_24px_rgba(27,50,112,0.08)] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Rating Stars & Placement Year */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1 text-amber-400">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-[#10B981] bg-white px-3 py-1 rounded-full border border-[#E2E8F4] shadow-2xs">
                      {t.year}
                    </span>
                  </div>

                  {/* Quote with comfortable reading typography */}
                  <p className="text-sm text-[#4A5568] leading-relaxed mb-6 font-normal">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                {/* Candidate Profile Info with clean spacing */}
                <div className="pt-4 border-t border-[#E2E8F4] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[#1B3270] text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-sm">
                      {t.firstName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1B3270]">
                        {t.firstName}
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">
                        {t.role}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-[#2952A3] bg-white px-2.5 py-1 rounded-[6px] border border-[#E2E8F4] block">
                      {t.location}
                    </span>
                    <span className="text-[10px] text-[#10B981] font-medium flex items-center mt-1">
                      <Check className="w-3 h-3 mr-1 shrink-0" />
                      {t.lpa}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={handleCtaClick}
            className="inline-flex items-center px-6 py-3 bg-[#1B3270] text-white text-sm font-semibold rounded-[6px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] hover:bg-[#2952A3] transition-all"
          >
            <span>Start Like They Did</span>
            <ArrowRight className="w-4 h-4 ml-2 text-[#7EB3E8]" />
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 12: FAQS (Spacious, Airy Layout — No Congestion)
      ───────────────────────────────────────────────────────────── */}
      <section id="faqs" className="py-16 sm:py-20 bg-[#F8FAFD] border-b border-[#E2E8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Left Column: Heading & Support Callout */}
            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-[#E2E8F4] rounded-full text-xs font-semibold text-[#2952A3] mb-3 shadow-[0_1px_3px_rgba(27,50,112,0.04)]">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Common Questions</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3270] tracking-tight mb-4">
                Frequently Asked Questions
              </h2>

              <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed mb-6">
                Everything you need to know about qualifying for German hospital sponsorship, visa processing, language standards, and relocating to Germany.
              </p>

              {/* Direct Assistance Card with comfortable padding */}
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_4px_16px_rgba(27,50,112,0.05)]">
                <h3 className="text-base font-bold text-[#1B3270] mb-2">
                  Have more questions?
                </h3>
                <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed mb-5">
                  The fastest way to see if you qualify is to take our free, 15-minute Diagnostic Test. No documents needed, instant feedback.
                </p>
                <button
                  onClick={handleCtaClick}
                  className="w-full py-3 bg-[#1B3270] text-white text-xs sm:text-sm font-semibold rounded-[6px] hover:bg-[#2952A3] transition-colors flex items-center justify-center space-x-2 shadow-sm"
                >
                  <span>Take Free Diagnostic Test</span>
                  <ArrowRight className="w-4 h-4 text-[#7EB3E8]" />
                </button>
              </div>
            </div>

            {/* Right Column: Clean, Spacious Accordion */}
            <div className="lg:col-span-7 divide-y divide-[#E2E8F4] border-t border-b border-[#E2E8F4]">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="py-4 sm:py-5 transition-colors">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left flex items-start justify-between gap-4 group"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-[#2952A3] uppercase tracking-wider block">
                          {faq.categoryLabel}
                        </span>
                        <span className="text-base sm:text-lg font-bold text-[#1B3270] group-hover:text-[#2952A3] transition-colors leading-snug block">
                          {faq.question}
                        </span>
                      </div>
                      <span className="w-8 h-8 rounded-full bg-white border border-[#E2E8F4] group-hover:border-[#2952A3] flex items-center justify-center shrink-0 mt-1 text-[#1B3270] transition-colors shadow-sm">
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-[#2952A3]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#94A3B8] group-hover:text-[#2952A3]" />
                        )}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="pt-3.5 pr-8 text-sm sm:text-base text-[#4A5568] leading-relaxed animate-in fade-in duration-200">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 13: FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="bg-[#1B3270] text-white pt-12 pb-10 border-t border-[#2952A3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Pre-footer Callout with repeated Primary CTA button */}
          <div className="bg-[#2952A3]/50 border border-[#7EB3E8]/30 rounded-[12px] p-6 sm:p-8 mb-12 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                Ready to begin your journey to Germany?
              </h3>
              <p className="text-sm text-[#E2E8F4] leading-relaxed">
                Take the free Diagnostic Test today. 15 minutes, no documents, instant score.
              </p>
            </div>
            <button
              onClick={handleCtaClick}
              className="h-11 px-6 bg-white text-[#1B3270] hover:bg-[#F8FAFD] text-sm font-bold rounded-[6px] shadow transition-colors shrink-0 flex items-center space-x-2"
            >
              <span>Take Free Diagnostic Test</span>
              <ArrowRight className="w-4 h-4 text-[#2952A3]" />
            </button>
          </div>

          {/* Footer 4-Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 sm:gap-10 mb-12">
            {/* Column 1: TerraTern Branding */}
            <div>
              <div className="flex items-center space-x-2.5 mb-3">
                <img
                  src="/images/terratern-logo-white.png"
                  alt="TerraTern"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <p className="text-sm text-[#7EB3E8] font-medium mb-3">
                Connect. Qualify. Place.
              </p>
              <p className="text-xs sm:text-sm text-[#E2E8F4]/80 leading-relaxed">
                Empowering international healthcare professionals with verified, ethical career pathways to accredited hospitals across Germany.
              </p>
            </div>

            {/* Column 2: Quick Links & Stakeholder Portals */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7EB3E8] mb-4">
                Portals &amp; Links
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[#E2E8F4]/80">
                <li>
                  <button onClick={handleCtaClick} className="hover:text-white transition-colors">
                    Candidate Diagnostic Test
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/register?role=candidate')} className="hover:text-white transition-colors">
                    Candidate Registration
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/login?role=candidate')} className="hover:text-white transition-colors">
                    Candidate Sign In
                  </button>
                </li>
                <li>
                  <button onClick={handleEmployerCta} className="hover:text-white transition-colors">
                    Employer Portal Login
                  </button>
                </li>
                <li>
                  <button onClick={handleSupplierCta} className="hover:text-white transition-colors">
                    Channel Partner Portal Login
                  </button>
                </li>
                <li>
                  <a
                    href="#opportunities"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Open Opportunities
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal & Standards */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7EB3E8] mb-4">
                Compliance &amp; Legal
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[#E2E8F4]/80">
                <li>Faire Anwerbung Pflege</li>
                <li>Zero-Fee Candidate Policy</li>
                <li>WHO Global Code Standards</li>
                <li>Terms of Service &amp; GDPR</li>
              </ul>
            </div>

            {/* Column 4: Contact */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7EB3E8] mb-4">
                Contact &amp; Offices
              </h4>
              <p className="text-xs sm:text-sm text-[#E2E8F4]/80 leading-relaxed mb-2">
                Hospital Partnerships &amp; Inquiries:
              </p>
              <p className="text-sm font-semibold text-white mb-3">
                contact@terratern.com
              </p>
              <p className="text-xs text-[#7EB3E8]/80">
                Headquarters: Berlin, Germany • Global Sourcing Centers
              </p>
            </div>
          </div>

          {/* Copyright Line */}
          <div className="pt-6 border-t border-[#2952A3] text-center text-xs text-[#E2E8F4]/60">
            © {new Date().getFullYear()} TerraTern GmbH. All rights reserved. Built for ethical healthcare mobility.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
