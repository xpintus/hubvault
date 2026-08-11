import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const source = 'C:/Users/xpint/Downloads/consignment-a57c1c04-2592-4396-88b6-9324a259af3c (1).xlsx';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const overview = await workbook.inspect({
  kind: 'workbook,sheet,table',
  maxChars: 12000,
  tableMaxRows: 12,
  tableMaxCols: 30,
  tableMaxCellChars: 180,
});
console.log(overview.ndjson);
