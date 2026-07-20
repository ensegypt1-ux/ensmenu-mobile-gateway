import * as fs from 'fs';
import * as path from 'path';

/**
 * JwtAuthGuard must be registered once via APP_GUARD only.
 * Controller-level @UseGuards(JwtAuthGuard) caused:
 * TypeError: Cannot redefine property: authIdentity
 */
describe('JwtAuthGuard registration', () => {
  const srcRoot = path.join(__dirname, '../..');

  function walkTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        out.push(...walkTsFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  it('is registered exactly once as APP_GUARD in app.module.ts', () => {
    const appModule = fs.readFileSync(
      path.join(srcRoot, 'app.module.ts'),
      'utf8',
    );
    const matches = appModule.match(/useClass:\s*JwtAuthGuard/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(appModule).toMatch(/provide:\s*APP_GUARD/);
  });

  it('is never applied via @UseGuards on controllers', () => {
    const controllersDir = path.join(srcRoot, 'modules');
    const files = walkTsFiles(controllersDir).filter((f) =>
      f.endsWith('.controller.ts'),
    );
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (
        /UseGuards\([^)]*JwtAuthGuard/.test(text) ||
        /@UseGuards\(\s*JwtAuthGuard\s*\)/.test(text)
      ) {
        offenders.push(path.relative(srcRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
