import { BookOpen } from 'lucide-react';
import './memoranda.css';

type Memorandum = { id: string; title: string; text: string };

/** Presentation only: accepted fragments and examined notes keep their existing sources. */
export function Memoranda({ fragments, notes }: { fragments: Memorandum[]; notes: Memorandum[] }) {
  return <div className="panel-items memoranda">
    <MemorandaSection title="Family Fragments" entries={fragments} testId="journal-family-fragments" fragment />
    <MemorandaSection title="Investigation Notes" entries={notes} testId="journal-notes" />
  </div>;
}

function MemorandaSection({ title, entries, testId, fragment = false }: {
  title: string; entries: Memorandum[]; testId: string; fragment?: boolean;
}) {
  return <details className="memoranda-section" open data-testid={testId}>
    <summary><span className="memoranda-chevron" aria-hidden="true" /><span>{title}</span><span className="memoranda-count">({entries.length})</span></summary>
    <div className="memoranda-entries">
      {entries.length ? entries.map(entry => <article key={entry.id} data-testid={`${fragment ? 'journal-fragment' : 'journal-entry'}-${entry.id}`}>
        <BookOpen aria-hidden="true" /><div><b>{entry.title}</b><p className="journal-text">{entry.text}</p></div>
      </article>) : <p className="memoranda-empty">{fragment ? 'No fragments preserved yet. Every room has a version of the truth.' : 'No evidence examined yet.'}</p>}
    </div>
  </details>;
}
