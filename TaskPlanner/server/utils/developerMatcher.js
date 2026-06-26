function normalizeSkill(skill) {
  return String(skill || '').trim().toLowerCase();
}

function scoreDeveloper(developerSkills, requiredSkills) {
  const normalizedDevSkills = new Set((developerSkills || []).map(normalizeSkill));
  const normalizedRequired = (requiredSkills || []).map(normalizeSkill).filter(Boolean);

  if (!normalizedRequired.length) {
    return 1;
  }

  let overlap = 0;
  for (const skill of normalizedRequired) {
    if (normalizedDevSkills.has(skill)) {
      overlap += 1;
    }
  }

  return overlap / normalizedRequired.length;
}

function pickBestDeveloper(developers, requiredSkills) {
  if (!developers.length) {
    return null;
  }

  let best = developers[0];
  let bestScore = -1;

  developers.forEach((dev) => {
    const score = scoreDeveloper(dev.skills, requiredSkills);
    if (score > bestScore) {
      best = dev;
      bestScore = score;
    }
  });

  return best;
}

module.exports = {
  pickBestDeveloper,
  scoreDeveloper,
};
