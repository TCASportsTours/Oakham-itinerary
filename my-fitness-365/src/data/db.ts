import Dexie, { type Table } from 'dexie'
import type { LocalBlob, MetaRow, SyncOperation, SyncedTable, TableRowMap } from './types'

type SyncedTables = { [K in SyncedTable]: Table<TableRowMap[K], string> }

export class FitnessDB extends Dexie {
  sync_operations!: Table<SyncOperation, string>
  blobs!: Table<LocalBlob, string>
  meta!: Table<MetaRow, string>

  constructor(name = 'my-fitness-365') {
    super(name)
    this.version(1).stores({
      profiles: 'id, user_id',
      user_settings: 'id, user_id',
      activity_templates: 'id, user_id, key',
      scheduled_activities: 'id, user_id, date, [user_id+date], status, workout_session_id',
      diary_entries: 'id, user_id, [user_id+date]',
      exercises: 'id, user_id, key',
      exercise_media: 'id, user_id, exercise_id',
      workout_templates: 'id, user_id, key',
      workout_template_exercises: 'id, user_id, template_id',
      workout_sessions: 'id, user_id, date, status, template_id',
      workout_sets: 'id, user_id, session_id, exercise_id',
      cycling_sessions: 'id, user_id, date',
      ingredients: 'id, user_id, key',
      recipes: 'id, user_id, key, meal_type',
      recipe_ingredients: 'id, user_id, recipe_id',
      planned_meals: 'id, user_id, date, [user_id+date]',
      food_log_entries: 'id, user_id, date, [user_id+date]',
      alcohol_entries: 'id, user_id, date',
      shopping_lists: 'id, user_id',
      shopping_list_items: 'id, user_id, list_id',
      weight_entries: 'id, user_id, date',
      body_measurements: 'id, user_id, date, type',
      progress_photos: 'id, user_id, date',
      notifications: 'id, user_id, due_date',
      sync_operations: 'id, table, record_id, created_at',
      blobs: 'id, user_id',
      meta: 'key',
    })
  }
}

export interface FitnessDB extends SyncedTables {}

export let db = new FitnessDB()

/** Tests use isolated databases. */
export function openDatabase(name: string) {
  db = new FitnessDB(name)
  return db
}
