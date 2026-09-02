import { Injectable } from '@nestjs/common';
import { getSqliteDb } from '../../database/sqlite';
import type { AiImageTaskResult, AiTaskStatus } from './ai.types';

export interface StoredAiTask {
  taskId: string;
  status: AiTaskStatus;
  result?: AiImageTaskResult;
  error?: string;
}

@Injectable()
export class AiTaskStore {
  private readonly db = getSqliteDb();

  create(taskId: string, status: AiTaskStatus): StoredAiTask {
    const task: StoredAiTask = { taskId, status };
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO ai_tasks (task_id, status, result_json, error, created_at, updated_at)
         VALUES (@taskId, @status, NULL, NULL, @createdAt, @updatedAt)`
      )
      .run({
        taskId,
        status,
        createdAt: now,
        updatedAt: now
      });
    return task;
  }

  get(taskId: string): StoredAiTask | undefined {
    const row = this.db
      .prepare(
        `SELECT task_id as taskId, status, result_json as resultJson, error
         FROM ai_tasks
         WHERE task_id = ?`
      )
      .get(taskId) as { taskId: string; status: AiTaskStatus; resultJson: string | null; error: string | null } | undefined;

    if (!row) {
      return undefined;
    }

    return {
      taskId: row.taskId,
      status: row.status,
      result: row.resultJson ? (JSON.parse(row.resultJson) as AiImageTaskResult) : undefined,
      error: row.error ?? undefined
    };
  }

  update(taskId: string, payload: Partial<Omit<StoredAiTask, 'taskId'>>): StoredAiTask | undefined {
    const current = this.get(taskId);
    if (!current) {
      return undefined;
    }

    const next: StoredAiTask = {
      ...current,
      ...payload,
      taskId
    };

    this.db
      .prepare(
        `UPDATE ai_tasks
         SET status = @status,
             result_json = @resultJson,
             error = @error,
             updated_at = @updatedAt
         WHERE task_id = @taskId`
      )
      .run({
        taskId,
        status: next.status,
        resultJson: next.result ? JSON.stringify(next.result) : null,
        error: next.error ?? null,
        updatedAt: Date.now()
      });

    return next;
  }
}
