declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string, params?: any[]): { columns: string[]; values: any[][] }[];
    export(): Uint8Array;
    prepare(sql: string): PreparedStatement;
  }

  export interface PreparedStatement {
    bind(params: any[]): void;
    step(): boolean;
    get(): any[];
    getAsObject(): any;
    free(): void;
  }

  export interface SqlJsStatic {
    Database: {
      new (data?: Uint8Array): Database;
    };
  }

  export default function initSqlJs(options: { locateFile: (file: string) => string }): Promise<SqlJsStatic>;
}
