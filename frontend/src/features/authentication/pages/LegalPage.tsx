import { Link } from 'react-router-dom'
import { AUTH_PATH } from '../domain/authPaths'
import { LegalDocument } from '../components/LegalDocument'
import { LEGAL_DOCUMENTS, type LegalKind } from '../domain/legalContent'

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = LEGAL_DOCUMENTS[kind]
  return <main className="mx-auto min-h-screen max-w-3xl bg-page px-5 py-12 text-ink sm:px-8">
    <Link to={AUTH_PATH.signIn} className="text-sm font-bold text-brand underline">Quay lại đăng nhập</Link>
    <article className="mt-8 rounded-2xl border border-field bg-white p-7 shadow-sm">
      <h1 className="m-0 text-3xl font-bold">{page.title}</h1>
      <p className="mb-7 mt-4 text-subtle">{page.summary}</p>
      <LegalDocument kind={kind} />
    </article>
  </main>
}
