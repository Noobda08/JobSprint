(function (global) {
  const root = global || (typeof window !== 'undefined' ? window : {});
  const ACTION_VERBS = [
    'achieved','built','created','delivered','designed','developed','drove','enabled','enhanced','executed','expanded','improved',
    'implemented','launched','led','managed','optimized','orchestrated','reduced','shipped','spearheaded','streamlined','supervised',
    'secured','transformed','won'
  ];

  const SECTION_PATTERNS = [
    { key: 'summary', pattern: /(summary|about me|profile)/i },
    { key: 'experience', pattern: /(experience|employment|work history)/i },
    { key: 'projects', pattern: /(projects?|case studies)/i },
    { key: 'education', pattern: /(education|academic)/i },
    { key: 'skills', pattern: /(skills|technologies|tech stack)/i },
    { key: 'certifications', pattern: /(certifications?|licenses?)/i },
    { key: 'contact', pattern: /(contact|info|details)/i }
  ];

  const ROLE_LIBRARY = {
    'software_engineer': {
      required: ['javascript', 'react', 'api', 'testing'],
      nice: ['typescript', 'node', 'docker', 'aws', 'microservices']
    },
    'frontend_developer': {
      required: ['javascript', 'css', 'html', 'react'],
      nice: ['typescript', 'next.js', 'accessibility', 'testing']
    },
    'backend_developer': {
      required: ['api', 'database', 'microservices', 'testing'],
      nice: ['node', 'python', 'java', 'cloud', 'docker', 'kubernetes']
    },
    'data_scientist': {
      required: ['python', 'model', 'statistics', 'sql'],
      nice: ['pandas', 'numpy', 'ml', 'scikit', 'tableau']
    },
    'data_analyst': {
      required: ['sql', 'excel', 'dashboard', 'insights'],
      nice: ['tableau', 'power bi', 'python', 'visualisation']
    },
    'product_manager': {
      required: ['roadmap', 'stakeholder', 'product', 'launch'],
      nice: ['metrics', 'user research', 'experiments', 'agile']
    },
    'designer': {
      required: ['design', 'ux', 'ui', 'prototype'],
      nice: ['figma', 'user research', 'wireframe', 'visual']
    },
    'qa_engineer': {
      required: ['testing', 'test cases', 'automation', 'qa'],
      nice: ['selenium', 'cypress', 'regression', 'ci/cd']
    },
    'marketing_manager': {
      required: ['campaign', 'strategy', 'growth', 'marketing'],
      nice: ['roi', 'content', 'performance', 'analytics']
    }
  };

  const ROLE_ALIASES = [
    { match: /(front[-\s]?end|ui) developer/i, key: 'frontend_developer' },
    { match: /(full[-\s]?stack)/i, key: 'software_engineer' },
    { match: /(software|swe|engineer)/i, key: 'software_engineer' },
    { match: /(back[-\s]?end)/i, key: 'backend_developer' },
    { match: /(data scientist)/i, key: 'data_scientist' },
    { match: /(data analyst|business analyst)/i, key: 'data_analyst' },
    { match: /(product manager|pm)/i, key: 'product_manager' },
    { match: /(designer|ux|ui)/i, key: 'designer' },
    { match: /(qa|quality assurance|test engineer)/i, key: 'qa_engineer' },
    { match: /(growth|marketing)/i, key: 'marketing_manager' }
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normaliseRoleKey(role) {
    if (!role || typeof role !== 'string') return null;
    const trimmed = role.trim();
    const lower = trimmed.toLowerCase();
    const direct = lower.replace(/[^a-z]+/g, '_');
    if (ROLE_LIBRARY[direct]) return direct;
    for (const alias of ROLE_ALIASES) {
      if (alias.match.test(trimmed)) {
        return alias.key;
      }
    }
    return null;
  }

  function detectSections(text) {
    const found = new Set();
    SECTION_PATTERNS.forEach(({ key, pattern }) => {
      if (pattern.test(text)) {
        found.add(key);
      }
    });
    return found;
  }

  function keywordCoverage(text, roleKey) {
    const lowerText = text.toLowerCase();
    const roleEntry = roleKey ? ROLE_LIBRARY[roleKey] : null;
    if (!roleEntry) {
      return {
        score: 0.55,
        matchedRequired: [],
        missingRequired: [],
        matchedNice: [],
        missingNice: []
      };
    }
    const checkList = (list) => {
      const matched = [];
      const missing = [];
      for (const keyword of list) {
        if (!keyword) continue;
        const normalizedKeyword = keyword.toLowerCase();
        const pattern = new RegExp(`\\b${normalizedKeyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(lowerText)) {
          matched.push(keyword);
        } else {
          missing.push(keyword);
        }
      }
      return { matched, missing };
    };

    const required = checkList(roleEntry.required || []);
    const nice = checkList(roleEntry.nice || []);

    const requiredRatio = roleEntry.required?.length
      ? required.matched.length / roleEntry.required.length
      : 0.7;
    const niceRatio = roleEntry.nice?.length ? nice.matched.length / roleEntry.nice.length : 0.5;
    const score = clamp(requiredRatio * 0.7 + niceRatio * 0.3, 0, 1);

    return {
      score,
      matchedRequired: required.matched,
      missingRequired: required.missing,
      matchedNice: nice.matched,
      missingNice: nice.missing
    };
  }

  function bulletMetrics(text) {
    const lines = text.split(/\r?\n/);
    const bullets = [];
    const bulletRegex = /^\s*(?:[-*•]|\d+\.)\s+/;
    const actionVerbRegex = new RegExp(`^\s*(?:[-*•]|\d+\.)?\s*(?:${ACTION_VERBS.join('|')})`, 'i');
    lines.forEach((line) => {
      if (bulletRegex.test(line)) {
        bullets.push(line.trim());
      }
    });
    const bulletCount = bullets.length;
    const totalLines = lines.filter((line) => line.trim().length > 0).length || 1;
    const bulletDensity = bulletCount / totalLines;
    const actionVerbCount = bullets.filter((bullet) => actionVerbRegex.test(bullet)).length;
    const actionVerbCoverage = bulletCount ? actionVerbCount / bulletCount : 0;
    const bulletScore = clamp(bulletDensity / 0.35, 0, 1);
    const actionVerbScore = clamp(actionVerbCoverage / 0.7, 0, 1);
    const score = clamp(bulletScore * 0.55 + actionVerbScore * 0.45, 0, 1);

    return {
      score,
      bulletCount,
      bulletDensity,
      actionVerbCoverage
    };
  }

  function contactMetrics(text) {
    const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
    const hasPhone = /\b(?:\+?\d[\d\s\-]{6,}\d)\b/.test(text);
    const hasLinkedIn = /linkedin\.com\//i.test(text);
    const hasPortfolio = /(github\.com\/|behance\.net\/|dribbble\.com\/|medium\.com\/|portfolio)/i.test(text);
    const score = clamp([
      hasEmail ? 1 : 0,
      hasPhone ? 1 : 0,
      hasLinkedIn ? 1 : 0,
      hasPortfolio ? 1 : 0
    ].reduce((sum, item) => sum + item, 0) / 3.2, 0, 1);
    return {
      score,
      hasEmail,
      hasPhone,
      hasLinkedIn,
      hasPortfolio
    };
  }

  function readabilityMetrics(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) {
      return { score: 0, avgSentenceLength: 0, wordCount: 0, sentenceCount: 0 };
    }
    const sentences = clean.split(/[.!?]+\s*/).filter(Boolean);
    const words = clean.split(/\s+/).filter(Boolean);
    const avgSentenceLength = sentences.length ? words.length / sentences.length : words.length;
    let score;
    if (avgSentenceLength <= 16) {
      score = 1;
    } else if (avgSentenceLength <= 20) {
      score = 0.85;
    } else if (avgSentenceLength <= 24) {
      score = 0.65;
    } else if (avgSentenceLength <= 28) {
      score = 0.45;
    } else {
      score = 0.3;
    }
    return {
      score,
      avgSentenceLength,
      wordCount: words.length,
      sentenceCount: sentences.length
    };
  }

  function sectionMetrics(text) {
    const sections = detectSections(text);
    const expected = SECTION_PATTERNS.map((item) => item.key);
    const required = ['experience', 'education'];
    const missingRequired = required.filter((key) => !sections.has(key));
    const missingOptional = expected.filter((key) => !sections.has(key) && !required.includes(key));
    const coverage = sections.size / expected.length;
    const requiredScore = clamp((required.length - missingRequired.length) / required.length, 0, 1);
    const score = clamp(requiredScore * 0.7 + clamp(coverage, 0, 1) * 0.3, 0, 1);
    return {
      score,
      found: Array.from(sections),
      missingRequired,
      missingOptional
    };
  }

  function deriveFixes(metrics) {
    const fixes = [];
    if (metrics.sections.missingRequired.length) {
      fixes.push(`Add a dedicated ${metrics.sections.missingRequired.join(' & ')} section so recruiters can scan it quickly.`);
    } else if (metrics.sections.missingOptional.length >= 2) {
      fixes.push('Include a Skills or Summary section to help the ATS understand your strengths.');
    }

    if (metrics.keywords.missingRequired.length) {
      const highlight = metrics.keywords.missingRequired.slice(0, 3).join(', ');
      fixes.push(`Work the role-critical keywords (${highlight}) into your achievements.`);
    } else if (metrics.keywords.missingNice.length >= 2) {
      fixes.push('Sprinkle in a few domain keywords from your target job description.');
    }

    if (metrics.bullets.bulletCount < 8) {
      fixes.push('Break dense paragraphs into bullet points so accomplishments pop.');
    }

    if (metrics.bullets.actionVerbCoverage < 0.55) {
      fixes.push('Start bullet points with strong action verbs like "Led" or "Shipped".');
    }

    const contactFlags = [
      !metrics.contact.hasEmail && 'Add a professional email address up top.',
      !metrics.contact.hasPhone && 'Include a reachable phone number for quick callbacks.',
      !metrics.contact.hasLinkedIn && 'Link your LinkedIn so recruiters can review your profile.',
      !metrics.contact.hasPortfolio && 'Share a portfolio or GitHub link for deeper context.'
    ].filter(Boolean);
    if (contactFlags.length) {
      fixes.push(contactFlags[0]);
    }

    if (metrics.readability.score < 0.6) {
      fixes.push('Shorten long sentences and keep each bullet crisp (under 20 words).');
    }

    if (!fixes.length) {
      fixes.push('Great shape overall—keep tailoring keywords to each JD you target.');
    }

    return fixes.slice(0, 5);
  }

  function analyzeResume(options) {
    const opts = options || {};
    const text = typeof opts.text === 'string' ? opts.text : '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const fingerprint = cleaned ? `${cleaned.length}:${cleaned.slice(0, 120).toLowerCase()}` : null;
    const hasContent = cleaned.length > 40;
    const roleKey = normaliseRoleKey(opts.role || opts.targetRole || '');

    if (!hasContent) {
      const fallbackFixes = ['Upload your latest resume so we can run a full ATS check.'];
      const fallback = {
        score: 35,
        level: 'poor',
        fixes: fallbackFixes,
        topSuggestion: fallbackFixes[0],
        coachNote: 'Let’s get your wins into the system so we can polish them together.',
        fingerprint,
        breakdown: {
          sections: { score: 0, found: [], missingRequired: ['experience', 'education'], missingOptional: [] },
          keywords: { score: 0, matchedRequired: [], missingRequired: [], matchedNice: [], missingNice: [] },
          bullets: { score: 0, bulletCount: 0, bulletDensity: 0, actionVerbCoverage: 0 },
          contact: { score: 0, hasEmail: false, hasPhone: false, hasLinkedIn: false, hasPortfolio: false },
          readability: { score: 0, avgSentenceLength: 0, wordCount: 0, sentenceCount: 0 }
        }
      };
      return fallback;
    }

    const sectionData = sectionMetrics(text);
    const keywordData = keywordCoverage(text, roleKey);
    const bulletData = bulletMetrics(text);
    const contactData = contactMetrics(text);
    const readabilityData = readabilityMetrics(text);

    const weightedScore = (
      sectionData.score * 0.22 +
      keywordData.score * 0.28 +
      bulletData.score * 0.18 +
      contactData.score * 0.12 +
      readabilityData.score * 0.20
    );

    const score = Math.round(clamp(weightedScore, 0, 1) * 100);

    let level;
    if (score >= 85) {
      level = 'great';
    } else if (score >= 70) {
      level = 'good';
    } else if (score >= 55) {
      level = 'average';
    } else {
      level = 'poor';
    }

    const fixes = deriveFixes({
      sections: sectionData,
      keywords: keywordData,
      bullets: bulletData,
      contact: contactData,
      readability: readabilityData
    });

    const coachNotes = {
      great: 'Recruiters will love how quickly your story flows.',
      good: 'Good structure— a quick tune-up will make it shine.',
      average: 'Let’s highlight your wins so they stand out instantly.',
      poor: 'We’ll reshape this into a story hiring managers can’t ignore.'
    };

    return {
      score,
      level,
      fixes,
      topSuggestion: fixes[0],
      coachNote: coachNotes[level] || coachNotes.good,
      fingerprint,
      breakdown: {
        sections: {
          score: Math.round(sectionData.score * 100),
          found: sectionData.found,
          missingRequired: sectionData.missingRequired,
          missingOptional: sectionData.missingOptional
        },
        keywords: {
          score: Math.round(keywordData.score * 100),
          matchedRequired: keywordData.matchedRequired,
          missingRequired: keywordData.missingRequired,
          matchedNice: keywordData.matchedNice,
          missingNice: keywordData.missingNice,
        },
        bullets: {
          score: Math.round(bulletData.score * 100),
          bulletCount: bulletData.bulletCount,
          bulletDensity: Number(bulletData.bulletDensity.toFixed(2)),
          actionVerbCoverage: Number((bulletData.actionVerbCoverage * 100).toFixed(1))
        },
        contact: {
          score: Math.round(contactData.score * 100),
          hasEmail: contactData.hasEmail,
          hasPhone: contactData.hasPhone,
          hasLinkedIn: contactData.hasLinkedIn,
          hasPortfolio: contactData.hasPortfolio
        },
        readability: {
          score: Math.round(readabilityData.score * 100),
          avgSentenceLength: Number(readabilityData.avgSentenceLength.toFixed(1)),
          wordCount: readabilityData.wordCount,
          sentenceCount: readabilityData.sentenceCount
        }
      }
    };
  }

  root.JobSprintATS = Object.freeze({
    analyzeResume
  });
})(typeof window !== 'undefined' ? window : globalThis);
