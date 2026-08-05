const { execFileSync } = require('node:child_process');

const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Indiquez une version au format X.Y.Z. Exemple : npm run publish-version -- 0.3.43');
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

run('npm', ['version', version, '--no-git-tag-version']);
run('git', ['add', '-A']);
run('git', ['commit', '-m', `Publier la version ${version}`]);
run('git', ['push', 'origin', 'main']);
run('git', ['tag', `v${version}`]);
run('git', ['push', 'origin', `v${version}`]);

console.log(`Version ${version} envoyée. GitHub construit et publie maintenant l’installateur automatiquement.`);
