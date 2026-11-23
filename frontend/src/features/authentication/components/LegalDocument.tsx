import { LEGAL_DOCUMENTS, type LegalKind } from '../domain/legalContent'

export function LegalDocument({ kind }: { kind: LegalKind }) {
  const document = LEGAL_DOCUMENTS[kind]
  return <div className="space-y-7">
    {document.sections.map((section, index) => <section key={section.id} aria-labelledby={`legal-${kind}-${section.id}`}>
      <h3 id={`legal-${kind}-${section.id}`} className="m-0 text-base font-bold text-ink">{index + 1}. {section.title}</h3>
      {section.paragraphs.map((paragraph) => <p key={paragraph} className="m-0 mt-3 text-sm leading-7 text-subtle">{paragraph}</p>)}
    </section>)}
  </div>
}
