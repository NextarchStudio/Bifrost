export interface SchemaColumn { tableName: string; columnName: string }
export interface SchemaComparison { missingTables: string[]; missingColumns: string[] }

export function compareSchema(expected: Record<string, string[]>, actualColumns: SchemaColumn[]): SchemaComparison {
  const actual = new Map<string, Set<string>>();
  for (const row of actualColumns) {
    const tableName = row.tableName.toLowerCase();
    const columns = actual.get(tableName) ?? new Set<string>();
    columns.add(row.columnName.toLowerCase());
    actual.set(tableName, columns);
  }
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const [tableName, columns] of Object.entries(expected)) {
    const actualColumnsForTable = actual.get(tableName.toLowerCase());
    if (!actualColumnsForTable) { missingTables.push(tableName); continue; }
    for (const columnName of columns) if (!actualColumnsForTable.has(columnName.toLowerCase())) missingColumns.push(`${tableName}.${columnName}`);
  }
  return { missingTables: missingTables.sort(), missingColumns: missingColumns.sort() };
}

export function missingRoles(actualRoles: string[], requiredRoles: readonly string[]): string[] {
  const actual = new Set(actualRoles);
  return requiredRoles.filter((role) => !actual.has(role));
}
