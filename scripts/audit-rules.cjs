const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(__dirname, '..', 'regles-syllogisme.js'), 'utf8'), sandbox);
const rules = Array.isArray(sandbox.window.RULES_LIBRARY) ? sandbox.window.RULES_LIBRARY : [];
const markerInMajor = /(?:^|\n)\s*(?:en\s+l['’]espèce|mineure|en\s+conséquence|conclusion)\b/imu;
const consequenceInMinor = /(?:^|\n)\s*(?:en\s+conséquence|conclusion)\b/imu;
const findings = rules.map(rule => {
  const issues = [];
  if (!String(rule.rule || '').trim()) issues.push('majeure vide');
  if (!String(rule.enEspece || '').trim()) issues.push('mineure vide');
  if (!String(rule.enConsequence || '').trim()) issues.push('conclusion vide');
  if (markerInMajor.test(String(rule.rule || ''))) issues.push('mineure ou conclusion présente dans la majeure');
  if (consequenceInMinor.test(String(rule.enEspece || ''))) issues.push('conclusion présente dans la mineure');
  return { id: rule.id, title: rule.title, issues };
}).filter(item => item.issues.length);

const counts = {};
for (const item of findings) for (const issue of item.issues) counts[issue] = (counts[issue] || 0) + 1;
const markerFindings = findings.filter(item => item.issues.some(issue => issue.includes('présente')));
const markerDetails = rules.filter(rule => markerInMajor.test(String(rule.rule || ''))).map(rule => ({
  id: rule.id,
  title: rule.title,
  hasMinor: Boolean(String(rule.enEspece || '').trim()),
  hasConclusion: Boolean(String(rule.enConsequence || '').trim()),
  embeddedHeadings: String(rule.rule || '').split('\n').filter(line => /^\s*(?:en\s+l['’]espèce|mineure|en\s+conséquence|conclusion)\b/iu.test(line.trim())).slice(0,8)
}));
const selectedFindings = process.argv.includes('--details') ? markerDetails : process.argv.includes('--markers') ? markerFindings : process.argv.includes('--summary') ? [] : findings;
console.log(JSON.stringify({ total: rules.length, affected: findings.length, counts, markerAffected: markerFindings.length, findings: selectedFindings }, null, 2));
