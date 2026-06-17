import { DatabaseSync } from "node:sqlite";

export type SqliteBinding = string | number | bigint | Uint8Array | null;

export type SqliteRunResult = {
  lastInsertRowid: number | bigint;
};

export type SqliteStatement = {
  get: (...params: SqliteBinding[]) => unknown;
  all: (...params: SqliteBinding[]) => unknown[];
  run: (...params: SqliteBinding[]) => SqliteRunResult;
};

export type PackageDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

export function openPackageDatabase(file: string): PackageDatabase {
  const db = new DatabaseSync(file);

  return {
    exec(sql) {
      db.exec(sql);
    },
    prepare(sql) {
      const statement = db.prepare(sql);

      return {
        get: (...params) => statement.get(...params),
        all: (...params) => statement.all(...params),
        run: (...params) => statement.run(...params),
      };
    },
    close() {
      db.close();
    },
  };
}
