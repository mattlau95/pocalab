import { PDFDocument, PDFArray, PDFRawStream, PDFName, decodePDFRawStream } from 'pdf-lib'

export type PageSummary = {
  size: [number, number]
  // Every image draw as [x, y, width, height] in points, rounded to 0.01.
  images: [number, number, number, number][]
  // Stroked line segments (crop marks, trim guides).
  lines: number
  // The decoded content stream with image names normalised and numbers rounded
  // to 0.001 pt: the drawing operators without timestamps, stable across runs.
  ops: string
}

type Matrix = [number, number, number, number, number, number]

const round = (n: number) => Math.round(n * 100) / 100

function contentStreamText(doc: PDFDocument, pageIndex: number): string {
  const contents = doc.getPage(pageIndex).node.get(PDFName.of('Contents'))
  const resolved = contents ? doc.context.lookup(contents) : undefined
  const streams = resolved instanceof PDFArray
    ? resolved.asArray().map(ref => doc.context.lookup(ref))
    : [resolved]
  return streams
    .filter((s): s is PDFRawStream => s instanceof PDFRawStream)
    .map(s => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1'))
    .join('\n')
}

const multiply = ([a, b, c, d, e, f]: Matrix, [A, B, C, D, E, F]: Matrix): Matrix => [
  a * A + b * C, a * B + b * D,
  c * A + d * C, c * B + d * D,
  e * A + f * C + E, e * B + f * D + F,
]

// Replays q / Q / cm to find where each image lands. An image fills the unit
// square of its transform, so the translation and axis lengths are its box.
function imageDraws(ops: string): PageSummary['images'] {
  const images: PageSummary['images'] = []
  const stack: Matrix[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const tokens = ops.split(/\s+/).filter(Boolean)
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t]
    if (tok === 'q') stack.push(ctm)
    else if (tok === 'Q') ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    else if (tok === 'cm') ctm = multiply(tokens.slice(t - 6, t).map(Number) as Matrix, ctm)
    else if (tok === 'Do' && tokens[t - 1].startsWith('/Image')) {
      const [a, b, c, d, e, f] = ctm
      images.push([round(e), round(f), round(Math.hypot(a, b)), round(Math.hypot(c, d))])
    }
  }
  return images
}

export async function summarizePdf(bytes: Uint8Array): Promise<PageSummary[]> {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((page, i) => {
    // Image resource names are random per run; number them in first-use order.
    const names = new Map<string, string>()
    const ops = contentStreamText(doc, i)
      .replace(/\/Image-?\d+/g, name => {
        if (!names.has(name)) names.set(name, `/Image${names.size}`)
        return names.get(name)!
      })
      // 0.001 pt is far below print resolution; rounding hides float noise
      // from equivalent arithmetic while still catching any real change.
      .replace(/-?\d+\.\d+/g, n => String(Math.round(Number(n) * 1000) / 1000 || 0))
    const { width, height } = page.getSize()
    return {
      size: [round(width), round(height)],
      images: imageDraws(ops),
      lines: (ops.match(/ l\s/g) ?? []).length,
      ops,
    }
  })
}
