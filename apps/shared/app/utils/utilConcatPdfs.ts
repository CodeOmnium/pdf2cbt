import { PDFDocument } from 'pdf-lib'

export default async function (pdfBuffers: Uint8Array[]): Promise<Uint8Array | null> {
  if (pdfBuffers.length === 0) return null
  if (pdfBuffers.length === 1) return pdfBuffers[0]

  const mergedPdf = await PDFDocument.create()

  for (let i = 0; i < pdfBuffers.length; i++) {
    const pdfBytes = pdfBuffers[i]
    try {
      const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      for (const page of pages) {
        mergedPdf.addPage(page)
      }
    }
    catch (err) {
      console.error(`Error processing PDF at index ${i}:`, err)
      throw err
    }
  }

  return await mergedPdf.save()
}
