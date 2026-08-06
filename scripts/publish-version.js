const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

const version = process.argv[2];
const currentVersion = require('../package.json').version;

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Indiquez une version au format X.Y.Z. Exemple : npm run publish-version -- 0.3.48');
  process.exit(1);
}

if (version === currentVersion) {
  console.error(`La version ${version} est déjà inscrite dans le projet.`);
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

run('npm', ['version', version, '--no-git-tag-version']);

for (const file of ['README.md', 'main.js', 'index.html']) {
  const content = readFileSync(file, 'utf8');
  const updated = content.replaceAll(currentVersion, version);
  if (updated === content) {
    console.error(`Le numéro de version ${currentVersion} est introuvable dans ${file}.`);
    process.exit(1);
  }
  writeFileSync(file, updated);
}

run('git', ['add', '-A']);
run('git', ['commit', '-m', `Publier la version ${version}`]);
run('git', ['push', 'origin', 'main']);
run('git', ['tag', `v${version}`]);
run('git', ['push', 'origin', `v${version}`]);

console.log(`Version ${version} envoyée. GitHub construit et publie maintenant l’installateur automatiquement.`);
