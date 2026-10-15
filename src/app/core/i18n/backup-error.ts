import type { BackupIssue } from '../storage';
import type { Translations } from './types';

/** Übersetzt einen Befund der Backup-Prüfung in einen lokalen Text. */
export function describeBackupIssue(t: Translations, issue: BackupIssue): string {
  const e = t.backupErrors;
  const text =
    issue.code === 'graph'
      ? issue.graph === 'cycle' || issue.graph === 'self-loop'
        ? e.graphCycle
        : issue.graph === 'duplicate-edge'
          ? e.graphDuplicate
          : e.graphReference
      : e.codes[issue.code];
  if (!issue.at) return text;
  const { kind, index, part } = issue.at;
  const where = [
    kind === 'list' ? e.list(index) : e.template(index),
    ...(part ? [part.kind === 'task' ? e.task(part.index) : e.edge(part.index)] : []),
  ].join(' / ');
  return `${where}: ${text}`;
}
