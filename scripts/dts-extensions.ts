// tsc copies relative specifiers into .d.ts files verbatim, and consumers on
// moduleResolution node16/nodenext cannot resolve extensionless ones (#63).
// Source imports stay extensionless; this adds `.js` to the emitted declarations,
// which TypeScript resolves to the matching .d.ts.
const relative = /((?:from|import)\s*\(?\s*)(['"])(\.\.?\/[^'"]+?)\2/g

let files = 0
for await (const path of new Bun.Glob('dist/**/*.d.ts').scan()) {
  files++
  const file = Bun.file(path)
  const code = await file.text()
  const fixed = code.replace(relative, (match, lead, quote, spec) =>
    /\.[cm]?[jt]s$/.test(spec) ? match : `${lead}${quote}${spec}.js${quote}`,
  )
  if (fixed !== code) await Bun.write(file, fixed)
}

if (files === 0) throw new Error('No dist/**/*.d.ts found: run tsc first')
