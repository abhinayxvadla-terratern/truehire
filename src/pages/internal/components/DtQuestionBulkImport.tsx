import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ParsedRow {
  index: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  difficulty_level: string;
  topic: string;
  question_order: string;
  isValid: boolean;
  isDuplicate: boolean;
  errorReason?: string;
}

interface DtQuestionBulkImportProps {
  onImportComplete: () => void;
}

const VALID_DIFFICULTIES = ['beginner', 'elementary', 'intermediate', 'upper_intermediate'];
const VALID_OPTIONS = ['a', 'b', 'c', 'd'];

export const DtQuestionBulkImport: React.FC<DtQuestionBulkImportProps> = ({
  onImportComplete,
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    skippedCount: number;
    activeCount: number;
    poolStatus?: {
      beginner: number;
      elementary: number;
      intermediate: number;
      upper_intermediate: number;
    };
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Download CSV Template
  const handleDownloadTemplate = () => {
    const headers = [
      'question_text',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'correct_option',
      'difficulty_level',
      'topic',
      'question_order',
    ];
    const exampleRow = [
      'What does Guten Tag mean?',
      'Good morning',
      'Good afternoon',
      'Good evening',
      'Goodbye',
      'b',
      'beginner',
      'vocabulary',
      '16',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), exampleRow.map((v) => `"${v}"`).join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'dt_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 2 & 3: File Processing & Validation
  const processRawRows = async (rows: any[], sourceName: string) => {
    setValidating(true);
    setFileName(sourceName);
    setImportResult(null);

    try {
      // Fetch existing question texts to detect duplicates
      const { data: existingQuestions } = await supabase
        .from('dt_questions')
        .select('question_text');

      const existingSet = new Set(
        (existingQuestions || []).map((q) => q.question_text.trim().toLowerCase())
      );

      const validated: ParsedRow[] = [];

      rows.forEach((row, idx) => {
        // Skip empty rows or header duplicate if parsed as row
        const qText = (row.question_text || row['Question Text'] || '').toString().trim();
        if (!qText && idx === 0) return;

        const optA = (row.option_a || row['Option A'] || '').toString().trim();
        const optB = (row.option_b || row['Option B'] || '').toString().trim();
        const optC = (row.option_c || row['Option C'] || '').toString().trim();
        const optD = (row.option_d || row['Option D'] || '').toString().trim();
        const rawCorrect = (row.correct_option || row['Correct Option'] || '')
          .toString()
          .trim()
          .toLowerCase();
        const rawDiff = (row.difficulty_level || row['Difficulty Level'] || '')
          .toString()
          .trim()
          .toLowerCase();
        const topic = (row.topic || row['Topic'] || '').toString().trim();
        const qOrder = (row.question_order || row['Question Order'] || '').toString().trim();

        const errors: string[] = [];

        if (!qText) errors.push('Question text missing');
        if (!optA || !optB || !optC || !optD) errors.push('All 4 options (a,b,c,d) are required');
        if (!VALID_OPTIONS.includes(rawCorrect)) {
          errors.push(`Invalid correct_option "${rawCorrect}" (must be a, b, c, or d)`);
        }
        if (!VALID_DIFFICULTIES.includes(rawDiff)) {
          errors.push(
            `Invalid difficulty "${rawDiff}" (must be beginner, elementary, intermediate, upper_intermediate)`
          );
        }
        if (qOrder && isNaN(Number(qOrder))) {
          errors.push('question_order must be a number');
        }

        const isDuplicate = existingSet.has(qText.toLowerCase());
        if (isDuplicate) {
          errors.push('Duplicate — already exists');
        }

        validated.push({
          index: idx + 1,
          question_text: qText,
          option_a: optA,
          option_b: optB,
          option_c: optC,
          option_d: optD,
          correct_option: rawCorrect,
          difficulty_level: rawDiff,
          topic,
          question_order: qOrder,
          isValid: errors.length === 0,
          isDuplicate,
          errorReason: errors.join('; '),
        });
      });

      setParsedRows(validated);
    } catch (err) {
      console.error('Validation error:', err);
      alert('Error parsing and validating file rows.');
    } finally {
      setValidating(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      alert('Invalid file format. Please upload a .csv or .xlsx file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRawRows(results.data, file.name);
        },
        error: (err) => {
          alert(`CSV Parse error: ${err.message}`);
        },
      });
    } else {
      // XLSX via SheetJS
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);
          processRawRows(json, file.name);
        } catch (err: any) {
          alert(`XLSX Parse error: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Step 4: Execute Import
  const handleImportValid = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !user) return;

    setImporting(true);
    try {
      // Find starting question_order if auto-assigning
      const { data: maxOrderData } = await supabase
        .from('dt_questions')
        .select('question_order')
        .order('question_order', { ascending: false })
        .limit(1);

      let currentMaxOrder = maxOrderData?.[0]?.question_order || 0;
      let insertedCount = 0;

      for (const row of validRows) {
        currentMaxOrder += 1;
        const assignedOrder = row.question_order ? Number(row.question_order) : currentMaxOrder;

        const { data: inserted, error: insertErr } = await supabase
          .from('dt_questions')
          .insert({
            question_text: row.question_text,
            option_a: row.option_a,
            option_b: row.option_b,
            option_c: row.option_c,
            option_d: row.option_d,
            correct_option: row.correct_option,
            difficulty_level: row.difficulty_level,
            topic: row.topic || null,
            question_order: assignedOrder,
            is_active: true,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertErr) {
          console.error('Error inserting question:', insertErr);
          continue;
        }

        // Insert audit log
        await supabase.from('dt_question_audit').insert({
          question_id: inserted.id,
          action: 'created',
          changed_by: user.id,
          new_data: inserted,
        });

        insertedCount += 1;
      }

      // Query pool health
      const { data: statsData } = await supabase
        .from('dt_question_pool_stats')
        .select('*');

      const counts: Record<string, number> = {
        beginner: 0,
        elementary: 0,
        intermediate: 0,
        upper_intermediate: 0,
      };
      (statsData || []).forEach((row: any) => {
        if (row.difficulty_level) {
          counts[row.difficulty_level.toLowerCase()] = Number(row.active_count) || 0;
        }
      });

      const totalActive = counts.beginner + counts.elementary + counts.intermediate + counts.upper_intermediate;

      setImportResult({
        successCount: insertedCount,
        skippedCount: parsedRows.length - insertedCount,
        activeCount: totalActive,
        poolStatus: {
          beginner: counts.beginner,
          elementary: counts.elementary,
          intermediate: counts.intermediate,
          upper_intermediate: counts.upper_intermediate,
        },
      });

      onImportComplete();
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;
  const errorCount = parsedRows.filter((r) => !r.isValid && !r.isDuplicate).length;

  return (
    <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
      {/* Collapsible Header Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F8FAFD] transition-colors cursor-pointer bg-white text-left"
      >
        <div className="flex items-center space-x-2.5">
          <FileSpreadsheet className="w-4 h-4 text-[#1B3270]" />
          <span className="text-xs font-bold text-[#1B3270]">
            Import Questions from File (.csv / .xlsx)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-semibold text-[#1B3270] bg-[#F0F4FF] px-2.5 py-1 rounded-[6px]">
            {isOpen ? 'Collapse' : '+ Import from File'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Import Panel */}
      {isOpen && (
        <div className="p-5 border-t border-[#E2E8F4] bg-[#F8FAFD] space-y-5 animate-in fade-in duration-150">
          {/* STEP 1: Download Template */}
          <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <span>Step 1: Download Question Template</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Download the standardized CSV format with columns: question_text, options a-d, correct_option, difficulty_level, topic, question_order.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-500 space-y-0.5">
                <div>• correct_option: a / b / c / d (lowercase)</div>
                <div>• difficulty_level: beginner / elementary / intermediate / upper_intermediate</div>
                <div>• topic: optional text • question_order: optional number (auto-assigned if blank)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-[#E2E8F4] hover:bg-[#F0F4FF] text-[#1B3270] text-xs font-semibold rounded-[6px] transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>

          {/* STEP 2: Drag and Drop Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-[8px] p-6 text-center transition-colors bg-white ${
              dragOver
                ? 'border-[#1B3270] bg-[#F0F4FF]/30'
                : 'border-slate-300 hover:border-[#1B3270]/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
            <UploadCloud className="w-8 h-8 text-[#1B3270] mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">
              Drag and drop your CSV or XLSX file here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#1B3270] underline font-bold cursor-pointer"
              >
                browse files
              </button>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Accepts .csv and .xlsx up to 5MB</p>
            {fileName && (
              <p className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded mt-2 inline-block border border-emerald-200">
                Selected: {fileName}
              </p>
            )}
          </div>

          {/* STEP 3: Validation Preview Table */}
          {validating ? (
            <div className="p-8 text-center bg-white rounded-[8px] border border-[#E2E8F4]">
              <Loader2 className="w-6 h-6 text-[#1B3270] animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Validating rows and checking duplicates...</p>
            </div>
          ) : (
            parsedRows.length > 0 && (
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E8F4]">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Validation Preview ({parsedRows.length} rows parsed)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold text-emerald-700">{validCount} valid</span> ·{' '}
                      <span className="font-semibold text-rose-600">{errorCount} errors</span> ·{' '}
                      <span className="font-semibold text-amber-600">{duplicateCount} duplicates</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportValid}
                    disabled={validCount === 0 || importing}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing {validCount} Questions...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Import {validCount} Valid Questions</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[300px] border border-[#E2E8F4] rounded-[6px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 text-[10px] font-bold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Question Text</th>
                        <th className="py-2 px-3">Diff.</th>
                        <th className="py-2 px-3">Correct</th>
                        <th className="py-2 px-3">Reason / Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                      {parsedRows.map((r) => (
                        <tr
                          key={r.index}
                          className={`hover:bg-slate-50 transition-colors ${
                            !r.isValid ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{r.index}</td>
                          <td className="py-2 px-3">
                            {r.isValid ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                ✗ Invalid
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-medium max-w-[240px] truncate">
                            {r.question_text || '—'}
                          </td>
                          <td className="py-2 px-3 capitalize">{r.difficulty_level || '—'}</td>
                          <td className="py-2 px-3 font-mono font-bold uppercase">
                            {r.correct_option || '—'}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {r.errorReason ? (
                              <span className="text-rose-600 font-medium">{r.errorReason}</span>
                            ) : (
                              <span className="text-emerald-700">Ready to import</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* STEP 4: Results & Pool Status Banner */}
          {importResult && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>
                    <strong>Import successful. {importResult.successCount} questions added.</strong>{' '}
                    {importResult.skippedCount > 0 &&
                      `(${importResult.skippedCount} skipped due to validation errors or duplicates)`}
                  </p>
                  {importResult.poolStatus && (
                    <p className="text-emerald-800 font-medium">
                      Pool status: Beginner: {importResult.poolStatus.beginner}/30 | Elementary:{' '}
                      {importResult.poolStatus.elementary}/30 | Intermediate:{' '}
                      {importResult.poolStatus.intermediate}/30 | Upper Int:{' '}
                      {importResult.poolStatus.upper_intermediate}/60
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DtQuestionBulkImport;
