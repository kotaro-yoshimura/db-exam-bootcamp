// sql.js 型宣言（バンドル時のstrict型チェック用）
declare module 'sql.js' {
  export interface SqlJsConfig {
    locateFile?: (file: string, prefix?: string) => string;
  }

  export interface QueryExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  export interface Database {
    run(sql: string): Database;
    exec(sql: string): QueryExecResult[];
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
