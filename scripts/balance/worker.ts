// worker_threads entry: runs batches of games and posts their records back.
import { parentPort } from 'node:worker_threads';
import { runGame, type GameRecord, type GameSpec } from './game';

export interface Task { id: number; specs: GameSpec[] }
export interface TaskResult { id: number; records: GameRecord[] }

parentPort?.on('message', (task: Task | null) => {
  if (task === null) { parentPort?.close(); return; }
  const records = task.specs.map(runGame);
  parentPort?.postMessage({ id: task.id, records } satisfies TaskResult);
});
