// The evidence behind AvirLog, as shipped to the Theory screen.
//
// Every entry here was checked against PubMed / publisher pages (see
// prototypes/designs/RESEARCH.md, which this file is derived from). The tiers
// are the point: the nasal cycle and slow-breathing effects are well
// established, while the *meaning* of a given side is a traditional hypothesis
// with mixed and partly contradicted support. Claims from the weaker tiers must
// never be presented as settled — the null results are shown on the very topic
// that makes the laterality claim.

export type Tier = "Established" | "Emerging" | "Preliminary" | "Traditional";

export interface Paper {
  authors: string;
  year: number;
  title: string;
  journal: string;
  /** What this specific study actually found, in plain language. */
  finding: string;
  /** PubMed / publisher link, opened on tap. */
  url?: string;
  id?: string; // PMID / DOI as printed
  /** Marks a study that argues against the laterality claim. */
  skeptic?: boolean;
}

export interface Topic {
  key: string;
  title: string;
  tier: Tier;
  summary: string;
  /** Shown as a callout under the summary when precision matters. */
  caveat?: string;
  papers: Paper[];
}

export const TIER_NOTE: Record<Tier, string> = {
  Established: "Well replicated across independent studies.",
  Emerging: "Several studies, but mixed or heterogeneous results.",
  Preliminary: "Small or single studies — treat as a lead, not a fact.",
  Traditional: "Heritage teaching, not an empirical finding.",
};

export const THESIS =
  "We reliably measure which nostril is open, and the nasal cycle is real physiology. " +
  "The meaning of a given side — active vs. calming, Pingala vs. Ida — is a hypothesis " +
  "from tradition with only preliminary and partly contradicted scientific support. " +
  "AvirLog helps you test it on yourself.";

export const TOPICS: Topic[] = [
  {
    key: "cycle",
    title: "The nasal cycle is real",
    tier: "Established",
    summary:
      "Healthy people alternate which nostril carries most airflow, driven by autonomic control of the venous sinusoids in the nose.",
    caveat:
      "It is far less tidy than popular accounts claim: only about 72% show a clearly defined cycle, the period is hours (mean ~2.6 h) rather than minutes, and it is irregular — not a clock.",
    papers: [
      {
        authors: "Hasegawa, M. & Kern, E.B.",
        year: 1977,
        title: "The human nasal cycle",
        journal: "Mayo Clin. Proc. 52(1):28–34",
        finding: "In 50 subjects over ~7 h, 72% showed a clearly defined cycle; mean duration ~2.6 h.",
      },
      {
        authors: "Eccles, R.",
        year: 1996,
        title: "A role for the nasal cycle in respiratory defence",
        journal: "Eur. Respir. J. 9(2):371–376",
        finding: "Review of autonomic control of the cycle; it intensifies during infection.",
        id: "PMID 8777979",
        url: "https://pubmed.ncbi.nlm.nih.gov/8777979/",
      },
      {
        authors: "Kahana-Zweig, R. et al.",
        year: 2016,
        title: "Measuring and characterizing the human nasal cycle",
        journal: "PLOS ONE 11(10):e0162918",
        finding:
          "Long-duration home measurement confirms the cycle but shows it is more variable and individual than the tidy popular version.",
        id: "PMID 27711189",
        url: "https://pubmed.ncbi.nlm.nih.gov/27711189/",
      },
      {
        authors: "Lindemann, J. et al.",
        year: 2023,
        title: "Continuous investigation of the nasal cycle over 48 hours",
        journal: "Eur. Arch. Otorhinolaryngol.",
        finding: "Over a full 48 h, a cycle was detected in all 30 adults studied.",
        id: "PMID 38088419",
        url: "https://pubmed.ncbi.nlm.nih.gov/38088419/",
      },
      {
        authors: "Kimura, A. et al.",
        year: 2013,
        title: "Phase of nasal cycle during sleep tends to be associated with sleep stage",
        journal: "Laryngoscope 123(8):2050–2055",
        finding: "Cycle present in 19 of 20 sleepers; phase shifts occur during sleep, often at REM.",
        id: "PMID 23576311",
        url: "https://pubmed.ncbi.nlm.nih.gov/23576311/",
      },
    ],
  },
  {
    key: "slow",
    title: "Slow breathing changes physiology",
    tier: "Established",
    summary:
      "Breathing slowly — under about 10 breaths a minute — raises heart-rate variability and shifts autonomic balance toward the calming, parasympathetic side.",
    caveat:
      "This is the app's most defensible claim, and it does not depend on which nostril you breathe through.",
    papers: [
      {
        authors: "Laborde, S. et al.",
        year: 2022,
        title: "Effects of voluntary slow breathing on heart rate and heart rate variability",
        journal: "Neurosci. Biobehav. Rev. 138:104711",
        finding: "Systematic review and meta-analysis of 223 studies: slow breathing reliably raises vagally-mediated HRV.",
        id: "PMID 35623448",
        url: "https://pubmed.ncbi.nlm.nih.gov/35623448/",
      },
      {
        authors: "Zaccaro, A. et al.",
        year: 2018,
        title: "How breath-control can change your life: a systematic review on slow breathing",
        journal: "Front. Hum. Neurosci. 12:353",
        finding: "Slow breathing raises HRV, respiratory sinus arrhythmia and alpha activity.",
        id: "PMID 30245619",
        url: "https://pubmed.ncbi.nlm.nih.gov/30245619/",
      },
      {
        authors: "Russo, M.A. et al.",
        year: 2017,
        title: "The physiological effects of slow breathing in the healthy human",
        journal: "Breathe 13(4):298–309",
        finding: "Improved HRV, baroreflex sensitivity and sympathovagal balance.",
        id: "DOI 10.1183/20734735.009817",
        url: "https://doi.org/10.1183/20734735.009817",
      },
      {
        authors: "Lehrer, P.M. & Gevirtz, R.",
        year: 2014,
        title: "Heart rate variability biofeedback: how and why does it work?",
        journal: "Front. Psychol. 5:756",
        finding: "Breathing near the resonance frequency (~6/min) maximises RSA and baroreflex gain.",
        id: "PMC4104929",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4104929/",
      },
    ],
  },
  {
    key: "brain",
    title: "Nasal breathing reaches the brain",
    tier: "Established",
    summary:
      "Breathing through the nose — not the mouth — synchronises rhythms in brain regions tied to memory and emotion, and the nose is the body's main source of airway nitric oxide.",
    papers: [
      {
        authors: "Zelano, C. et al.",
        year: 2016,
        title: "Nasal respiration entrains human limbic oscillations and modulates cognitive function",
        journal: "J. Neurosci. 36(49):12448–12467",
        finding:
          "Intracranial EEG: nasal, but not oral, breathing entrains piriform, amygdala and hippocampal oscillations; nasal-inhale timing improved fear discrimination and memory.",
        id: "PMID 27927961",
        url: "https://pubmed.ncbi.nlm.nih.gov/27927961/",
      },
      {
        authors: "Watso, J.C. et al.",
        year: 2023,
        title: "Acute nasal breathing lowers diastolic blood pressure and increases parasympathetic HRV",
        journal: "Am. J. Physiol. Regul. Integr. Comp. Physiol.",
        finding: "In 20 adults, nasal versus oral breathing lowered diastolic and mean blood pressure and raised HF-HRV.",
        id: "PMID 37867476",
        url: "https://pubmed.ncbi.nlm.nih.gov/37867476/",
      },
      {
        authors: "Lundberg, J.O.N. et al.",
        year: 1995,
        title: "High nitric oxide production in human paranasal sinuses",
        journal: "Nat. Med. 1(4):370–373",
        finding: "The sinuses are the major source of airway nitric oxide, which nasal breathing carries to the lungs.",
        id: "DOI 10.1038/nm0495-370",
        url: "https://doi.org/10.1038/nm0495-370",
      },
      {
        authors: "Weitzberg, E. & Lundberg, J.O.N.",
        year: 2002,
        title: "Humming greatly increases nasal nitric oxide",
        journal: "Am. J. Respir. Crit. Care Med. 166(2):144–145",
        finding: "Nasal nitric oxide rose roughly 15-fold during humming.",
        id: "PMID 12119224",
        url: "https://pubmed.ncbi.nlm.nih.gov/12119224/",
      },
    ],
  },
  {
    key: "side",
    title: "Does the side mean anything?",
    tier: "Emerging",
    summary:
      "Some studies link right-nostril breathing to more activating effects and left-nostril to more calming ones. Others find nothing of the sort. This is the tradition's central claim, and it is the least settled part of the app.",
    caveat:
      "Read the two studies marked below: they found no laterality effect, or found the benefit came from breathing slowly rather than from the nostril. AvirLog labels side-based guidance as a suggestion to test, never as fact.",
    papers: [
      {
        authors: "Telles, S. et al.",
        year: 1994,
        title: "Breathing through a particular nostril can alter metabolism and autonomic activities",
        journal: "Indian J. Physiol. Pharmacol. 38(2):133–137",
        finding: "Right-nostril practice raised oxygen consumption ~37%; left reduced sympathetic sweat activity.",
        id: "PMID 8063359",
        url: "https://pubmed.ncbi.nlm.nih.gov/8063359/",
      },
      {
        authors: "Pal, G.K. et al.",
        year: 2014,
        title: "Slow yogic breathing through right and left nostril influences sympathovagal balance",
        journal: "N. Am. J. Med. Sci. 6(3):145–151",
        finding: "Left-nostril breathing favoured parasympathetic/HRV gains; right favoured sympathetic.",
        id: "PMID 24741554",
        url: "https://pubmed.ncbi.nlm.nih.gov/24741554/",
      },
      {
        authors: "Werntz, D.A. et al.",
        year: 1983,
        title: "Alternating cerebral hemispheric activity and the lateralization of autonomic function",
        journal: "Hum. Neurobiol. 2(1):39–43",
        finding: "The foundational claim linking nostril dominance to hemispheric lateralisation — not robustly replicated since.",
        id: "PMID 6874437",
        url: "https://pubmed.ncbi.nlm.nih.gov/6874437/",
      },
      {
        authors: "Larson, G. et al.",
        year: 1993,
        title: "Forced unilateral nostril breathing effects on the autonomic nervous system: an unsupported claim",
        journal: "Med. Hypotheses 41(4):367–369",
        finding:
          "A controlled test found no significant change in heart rate, pulse amplitude, temperature, skin conductance or respiration.",
        id: "PMID 8289706",
        url: "https://pubmed.ncbi.nlm.nih.gov/8289706/",
        skeptic: true,
      },
      {
        authors: "Telles, S. et al.",
        year: 2024,
        title: "Heart rate variability during nostril-regulated yoga breathing: a randomized crossover study",
        journal: "Int. J. Yoga 17(3):203–210",
        finding:
          "In 47 men, right- and left-nostril breathing produced common, not opposite, changes — driven by slower respiration rather than distinct autonomic poles.",
        id: "PMID 39959514",
        url: "https://pubmed.ncbi.nlm.nih.gov/39959514/",
        skeptic: true,
      },
      {
        authors: "Gholamrezaei, A. et al.",
        year: 2021,
        title: "Psychophysiological responses to various slow, deep breathing techniques",
        journal: "Psychophysiology 58(2):e13712",
        finding:
          "RSA was higher during loaded and pursed-lips breathing than during left-nostril breathing — much of the benefit is the slow breathing itself.",
        id: "PMID 33111377",
        url: "https://pubmed.ncbi.nlm.nih.gov/33111377/",
        skeptic: true,
      },
      {
        authors: "Samantaray, S. & Telles, S.",
        year: 2008,
        title: "Nostril dominance at rest and a left-hemisphere-specific cancellation task",
        journal: "Int. J. Yoga 1(2):56–59",
        finding: "Found no significant right-versus-left difference on the task.",
        id: "PMID 21829285",
        url: "https://pubmed.ncbi.nlm.nih.gov/21829285/",
        skeptic: true,
      },
    ],
  },
  {
    key: "anb",
    title: "Alternate-nostril breathing",
    tier: "Emerging",
    summary:
      "Trials of alternate-nostril breathing report lower blood pressure and better vigilance, but the pooled evidence is heterogeneous.",
    caveat:
      "The meta-analysis found heterogeneity above 75%. Treat this as a promising adjunct, never as a replacement for medical treatment.",
    papers: [
      {
        authors: "Nam, T.G. et al.",
        year: 2024,
        title: "Effectiveness of alternate nostril breathing on blood pressure: review and meta-analysis of RCTs",
        journal: "Complement. Med. Res. 31(5):449–460",
        finding: "6 RCTs (525 participants): systolic fell ~7.2 and diastolic ~5.2 mmHg, but heterogeneity exceeded 75%.",
        id: "PMID 39008954",
        url: "https://pubmed.ncbi.nlm.nih.gov/39008954/",
      },
      {
        authors: "Kalaivani, S. et al.",
        year: 2019,
        title: "Effect of alternate nostril breathing on blood pressure and heart rate in hypertension",
        journal: "J. Educ. Health Promot. 8:145",
        finding: "Randomised trial: five days of practice lowered systolic and diastolic pressure, heart rate and rate-pressure product.",
        id: "PMID 31463330",
        url: "https://pubmed.ncbi.nlm.nih.gov/31463330/",
      },
      {
        authors: "Telles, S. et al.",
        year: 2017,
        title: "Alternate-nostril yoga breathing reduced blood pressure while increasing performance in a vigilance test",
        journal: "Med. Sci. Monit. Basic Res.",
        finding: "In 15 men, practice reduced systolic and mean arterial pressure and improved vigilance.",
        id: "PMID 29284770",
        url: "https://pubmed.ncbi.nlm.nih.gov/29284770/",
      },
    ],
  },
  {
    key: "cognition",
    title: "Effects on cognition and mood",
    tier: "Preliminary",
    summary:
      "A handful of small studies suggest nostril side may nudge spatial versus verbal performance. The effects are small and inconsistently significant.",
    papers: [
      {
        authors: "Jella, S.A. & Shannahoff-Khalsa, D.S.",
        year: 1993,
        title: "The effects of unilateral forced nostril breathing on cognitive performance",
        journal: "Int. J. Neurosci. 73(1–2):61–68",
        finding:
          "Spatial task performance was better during left-nostril breathing (p = .028); the verbal difference was not significant (p = .14).",
        id: "PMID 8132419",
        url: "https://pubmed.ncbi.nlm.nih.gov/8132419/",
      },
      {
        authors: "Niazi, I.K. et al.",
        year: 2022,
        title: "EEG signatures change during unilateral yogi nasal breathing",
        journal: "Sci. Rep. 12:522",
        finding: "Forced unilateral breathing produced lateralised, frequency-specific EEG changes.",
        id: "PMID 35017606",
        url: "https://pubmed.ncbi.nlm.nih.gov/35017606/",
      },
      {
        authors: "Fincham, G.W. et al.",
        year: 2023,
        title: "Effect of breathwork on stress and mental health: a meta-analysis of RCTs",
        journal: "Sci. Rep. 13:432",
        finding: "12 RCTs showed small-to-medium reductions in stress, anxiety and depression, with moderate risk of bias.",
        id: "PMID 36624160",
        url: "https://pubmed.ncbi.nlm.nih.gov/36624160/",
      },
    ],
  },
  {
    key: "tradition",
    title: "Where the tradition comes from",
    tier: "Traditional",
    summary:
      "Swara Yoga is systematised in the Shiva Svarodaya, a Sanskrit text of roughly 395 sutras. It names breath flowing through ida (left, cooling/lunar), pingala (right, warming/solar) and sushumna (central), and prescribes actions by which is dominant.",
    caveat:
      "This is an interpretive framework and heritage teaching. AvirLog uses its vocabulary because it is the origin of the practice — not as evidence.",
    papers: [
      {
        authors: "Shiva Svarodaya",
        year: 0,
        title: "Shiva Swarodaya — Sanskrit tantric text",
        journal: "Traditional source, ~395 sutras",
        finding: "A dialogue of Shiva and Parvati systematising swara yoga and its prescriptions by nostril dominance.",
        url: "https://en.wikipedia.org/wiki/Shiva_Swarodaya",
      },
    ],
  },
];

export const PAPER_COUNT = TOPICS.reduce((n, t) => n + t.papers.length, 0);
