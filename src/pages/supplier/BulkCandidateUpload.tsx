import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  Eye,
  X,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface BulkCandidateUploadProps {
  supplier: any;
  onCandidateAdded?: () => void;
}

interface ParsedCandidateRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roleInterest: string;
  languageLevel: string;
  source?: string;
  notes?: string;
  isValid: boolean;
  errorReason?: string;
}

interface UploadResultItem {
  row_number: number;
  name: string;
  email: string;
  status: 'success' | 'error';
  error_reason?: string;
  invite_token?: string;
}

const VALID_ROLES = ['nursing', 'ausbildung', 'care', 'other'];
const VALID_LEVELS = ['A2', 'B1', 'B2'];

const normalizeRole = (role: string): string => {
  const r = (role || '').trim().toLowerCase();
  if (r.includes('nurs')) return 'nursing';
  if (r.includes('ausbild')) return 'ausbildung';
  if (r.includes('care')) return 'care';
  return 'other';
};

const normalizeLevel = (lvl: string): string => {
  const l = (lvl || '').trim().toUpperCase();
  if (l === 'A2') return 'A2';
  if (l === 'B1') return 'B1';
  if (l === 'B2') return 'B2';
  return l;
};

export const BulkCandidateUpload: React.FC<BulkCandidateUploadProps> = ({
  supplier,
  onCandidateAdded,
}) => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Flow Step: 1 (Upload), 2 (Validation Preview), 3 (Processing), 4 (Results)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedCandidateRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<UploadResultItem[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedRowIdx, setCopiedRowIdx] = useState<number | null>(null);

  // Previous Uploads History
  const [previousUploads, setPreviousUploads] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyModalResults, setHistoryModalResults] = useState<{
    fileName: string;
    date: string;
    results: UploadResultItem[];
  } | null>(null);

  useEffect(() => {
    if (supplier?.id) {
      fetchPreviousUploads();
    }
  }, [supplier?.id]);

  const fetchPreviousUploads = async () => {
    if (!supplier?.id) return;
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('supplier_bulk_uploads')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setPreviousUploads(data);
      }
    } catch (err) {
      console.error('Error fetching bulk uploads history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ----------------------------------------------------
  // STEP 1: DOWNLOAD TEMPLATE
  // ----------------------------------------------------
  const handleDownloadTemplate = () => {
    const csvContent =
      'First Name*,Last Name*,Email*,Phone,Role Interest*,Language Level*,Source,Notes\n' +
      'Priya,Sharma,priya.sharma@example.com,+919876543210,Nursing,B1,Academy,Top rank in clinical batch\n' +
      'Ravi,Kumar,ravi.kumar@example.com,+919876543211,Ausbildung,A2,Direct Referral,Hospital ward experience\n' +
      'Ananya,Patel,ananya.patel@example.com,+919876543212,Care,B2,Campus Recruitment,Geriatric care background\n' +
      '# Valid Role Interest values: Nursing / Ausbildung / Care / Other\n' +
      '# Valid Language Level values: A2 / B1 / B2\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'terratern_candidate_bulk_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // STEP 2 & 3: FILE PARSING & CLIENT-SIDE VALIDATION
  // ----------------------------------------------------
  const handleFileSelect = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setSelectedFile(file);
    setParsing(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rawData: any[] = [];

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        // Default CSV parsing via PapaParse
        const text = await file.text();
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: 'greedy',
          comments: '#',
        });
        rawData = parsed.data;
      }

      await validateAndSetRows(rawData);
      setStep(2);
    } catch (err: any) {
      console.error('File parse error:', err);
      alert('Failed to parse file. Ensure it is a valid .csv or .xlsx document.');
    } finally {
      setParsing(false);
    }
  };

  const validateAndSetRows = async (rows: any[]) => {
    // 1. Extract and normalize all emails from file to check database
    const extractedEmails: string[] = [];
    const normalizedRows: any[] = [];

    rows.forEach((r, idx) => {
      // Clean header keys
      const cleanRow: any = {};
      Object.keys(r).forEach((k) => {
        const cleanKey = k.trim().toLowerCase().replace('*', '');
        cleanRow[cleanKey] = r[k];
      });

      const firstName = (cleanRow['first name'] || cleanRow['firstname'] || cleanRow['first_name'] || '').toString().trim();
      const lastName = (cleanRow['last name'] || cleanRow['lastname'] || cleanRow['last_name'] || '').toString().trim();
      const email = (cleanRow['email'] || cleanRow['email address'] || '').toString().trim().toLowerCase();
      const phone = (cleanRow['phone'] || cleanRow['phone number'] || cleanRow['contact'] || '').toString().trim();
      const roleInterest = (cleanRow['role interest'] || cleanRow['role'] || cleanRow['target_role'] || '').toString().trim();
      const languageLevel = (cleanRow['language level'] || cleanRow['level'] || cleanRow['language'] || '').toString().trim();
      const source = (cleanRow['source'] || '').toString().trim();
      const notes = (cleanRow['notes'] || '').toString().trim();

      if (email) extractedEmails.push(email);

      normalizedRows.push({
        rowNumber: idx + 1,
        firstName,
        lastName,
        email,
        phone,
        roleInterest,
        languageLevel,
        source,
        notes,
      });
    });

    // 2. Query DB to check if any of these emails are already in candidates or profiles
    let registeredEmails = new Set<string>();
    if (extractedEmails.length > 0) {
      const { data: candMatches } = await supabase
        .from('candidates')
        .select('email')
        .in('email', extractedEmails);

      (candMatches || []).forEach((c) => {
        if (c.email) registeredEmails.add(c.email.toLowerCase());
      });

      const { data: profileMatches } = await supabase
        .from('profiles')
        .select('email')
        .in('email', extractedEmails);

      (profileMatches || []).forEach((p) => {
        if (p.email) registeredEmails.add(p.email.toLowerCase());
      });
    }

    // 3. Validate each row
    const seenEmailsInFile = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validated: ParsedCandidateRow[] = normalizedRows.map((row) => {
      let errorReason: string | undefined = undefined;

      if (!row.firstName) {
        errorReason = 'Missing first name';
      } else if (!row.lastName) {
        errorReason = 'Missing last name';
      } else if (!row.email || !emailRegex.test(row.email)) {
        errorReason = 'Missing/invalid email';
      } else if (seenEmailsInFile.has(row.email)) {
        errorReason = 'Duplicate in file';
      } else if (registeredEmails.has(row.email)) {
        errorReason = 'Already registered';
      } else {
        const normRole = normalizeRole(row.roleInterest);
        if (!VALID_ROLES.includes(normRole)) {
          errorReason = 'Invalid role interest';
        } else {
          const normLvl = normalizeLevel(row.languageLevel);
          if (!VALID_LEVELS.includes(normLvl)) {
            errorReason = 'Invalid language level (must be A2, B1, or B2)';
          }
        }
      }

      if (row.email && !seenEmailsInFile.has(row.email)) {
        seenEmailsInFile.add(row.email);
      }

      return {
        ...row,
        roleInterest: normalizeRole(row.roleInterest),
        languageLevel: normalizeLevel(row.languageLevel),
        isValid: !errorReason,
        errorReason,
      };
    });

    setParsedRows(validated);
  };

  // ----------------------------------------------------
  // STEP 4: PROCESS VALID ROWS
  // ----------------------------------------------------
  const handleProcessValidRows = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !supplier?.id) return;

    try {
      setProcessing(true);
      setStep(3);

      // 1. Insert supplier_bulk_uploads entry
      const { data: uploadRecord, error: uploadErr } = await supabase
        .from('supplier_bulk_uploads')
        .insert({
          supplier_id: supplier.id,
          uploaded_by: profile?.id,
          file_name: selectedFile?.name || 'bulk_candidates.csv',
          total_rows: parsedRows.length,
          status: 'processing',
          successful_rows: 0,
          failed_rows: 0,
        })
        .select()
        .single();

      if (uploadErr) throw uploadErr;

      const uploadId = uploadRecord.id;
      const processResults: UploadResultItem[] = [];
      let successCount = 0;
      let failedCount = 0;

      // Look up active RM for this supplier
      const { data: activeRmAssign } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'supplier')
        .eq('entity_id', supplier.id)
        .eq('active', true)
        .maybeSingle();

      const activeRmProfileId = activeRmAssign?.rm_profile_id || null;

      // 2. Process all rows
      for (const row of parsedRows) {
        if (!row.isValid) {
          processResults.push({
            row_number: row.rowNumber,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
            status: 'error',
            error_reason: row.errorReason || 'Validation failed',
          });
          failedCount++;
          continue;
        }

        // Generate invite token
        const inviteToken = crypto.randomUUID();

        // Insert into candidates table
        const { error: insertErr } = await supabase.from('candidates').insert({
          supplier_id: supplier.id,
          assigned_rm_id: activeRmProfileId,
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email,
          status: 'onboarding',
          invite_token: inviteToken,
          target_role: row.roleInterest,
          language_level_self_reported: row.languageLevel,
          user_id: null,
        });

        if (insertErr) {
          console.error(`Error inserting candidate row #${row.rowNumber}:`, insertErr);
          processResults.push({
            row_number: row.rowNumber,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
            status: 'error',
            error_reason: 'Insert failed: ' + insertErr.message,
          });
          failedCount++;
        } else {
          processResults.push({
            row_number: row.rowNumber,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
            status: 'success',
            invite_token: inviteToken,
          });
          successCount++;
        }
      }

      // 3. Update supplier_bulk_uploads entry with completion results
      await supabase
        .from('supplier_bulk_uploads')
        .update({
          successful_rows: successCount,
          failed_rows: failedCount,
          status: 'completed',
          results: processResults,
        })
        .eq('id', uploadId);

      // 4. Update suppliers.onboarding_checklist if at least 1 candidate added
      if (successCount > 0) {
        const currentChecklist = supplier.onboarding_checklist || {};
        await supabase
          .from('suppliers')
          .update({
            onboarding_checklist: {
              ...currentChecklist,
              first_candidate_added: true,
            },
          })
          .eq('id', supplier.id);

        if (onCandidateAdded) onCandidateAdded();
      }

      setResults(processResults);
      setStep(4);
      await fetchPreviousUploads();
    } catch (err: any) {
      console.error('Processing error:', err);
      alert('An error occurred during candidate upload processing: ' + err.message);
      setStep(2);
    } finally {
      setProcessing(false);
    }
  };

  // ----------------------------------------------------
  // STEP 5: ACTIONS & EXPORT
  // ----------------------------------------------------
  const handleCopyAllLinks = () => {
    const successfulItems = results.filter((r) => r.status === 'success' && r.invite_token);
    if (successfulItems.length === 0) return;

    const formattedList = successfulItems
      .map((r) => `${r.name}: ${window.location.origin}/invite/${r.invite_token}`)
      .join('\n');

    navigator.clipboard.writeText(formattedList);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleCopyRowLink = (token: string, idx: number) => {
    const fullLink = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedRowIdx(idx);
    setTimeout(() => setCopiedRowIdx(null), 2000);
  };

  const handleDownloadResultsCsv = () => {
    const csvRows = [
      ['Row', 'Name', 'Email', 'Status', 'Error Reason', 'Invite Link'].join(','),
      ...results.map((r) => {
        const link = r.invite_token ? `${window.location.origin}/invite/${r.invite_token}` : '';
        return [
          r.row_number,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.email.replace(/"/g, '""')}"`,
          r.status,
          `"${(r.error_reason || '').replace(/"/g, '""')}"`,
          link,
        ].join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bulk_upload_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setResults([]);
    setStep(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.length - validCount;
  const successResultsCount = results.filter((r) => r.status === 'success').length;
  const errorResultsCount = results.length - successResultsCount;

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* History Inspection Modal */}
      {historyModalResults && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-2xl w-full p-6 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Bulk Upload: {historyModalResults.fileName}
                </h3>
                <p className="text-xs text-[#4A5568]">
                  Processed on {formatDate(historyModalResults.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalResults(null)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F4] text-[#94A3B8]">
                    <th className="py-2 px-2.5 font-semibold">Row</th>
                    <th className="py-2 px-2.5 font-semibold">Candidate</th>
                    <th className="py-2 px-2.5 font-semibold">Email</th>
                    <th className="py-2 px-2.5 font-semibold">Status</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Invite Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4]">
                  {historyModalResults.results.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-2.5 font-mono text-[#94A3B8]">{r.row_number}</td>
                      <td className="py-2.5 px-2.5 font-medium text-[#0F172A]">{r.name}</td>
                      <td className="py-2.5 px-2.5 text-[#4A5568]">{r.email}</td>
                      <td className="py-2.5 px-2.5">
                        {r.status === 'success' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Added
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {r.error_reason || 'Error'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        {r.invite_token ? (
                          <button
                            type="button"
                            onClick={() => handleCopyRowLink(r.invite_token!, idx + 1000)}
                            className="text-xs text-[#1B3270] hover:underline font-medium"
                          >
                            {copiedRowIdx === idx + 1000 ? 'Copied' : 'Copy Link'}
                          </button>
                        ) : (
                          <span className="text-[#94A3B8] text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 mt-2 border-t border-[#E2E8F4] flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalResults(null)}
                className="px-4 py-2 bg-[#1B3270] text-white rounded-[6px] text-xs font-semibold hover:bg-[#2952A3]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Upload Flow Card */}
      <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
        {/* ==================================================== */}
        {/* STEP 1: DOWNLOAD TEMPLATE & FILE UPLOAD */}
        {/* ==================================================== */}
        {step === 1 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E2E8F4]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Bulk Candidate Upload</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Upload a spreadsheet of candidates. An invite link is generated for each row.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-[#E2E8F4] hover:bg-gray-50 text-[#1B3270] text-xs font-semibold rounded-[6px] transition-colors shadow-2xs self-start"
              >
                <Download className="w-3.5 h-3.5 text-[#1B3270]" />
                <span>Download Template (.csv)</span>
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelect(f);
              }}
              className="border-2 border-dashed border-[#E2E8F4] hover:border-[#1B3270] bg-[#F8FAFD] rounded-[10px] p-10 text-center transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv, .xlsx, .xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />

              {parsing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mb-3" />
                  <p className="text-xs font-semibold text-[#0F172A]">
                    Parsing and validating candidates spreadsheet...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#1B3270]/10 flex items-center justify-center text-[#1B3270] mb-3 border border-[#1B3270]/20">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-[#0F172A] mb-1">
                    Click to browse or drag and drop your spreadsheet
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Supports .CSV or .XLSX (Max file size: 5MB)
                  </p>
                </div>
              )}
            </div>

            {/* Instructions Strip */}
            <div className="mt-6 p-4 rounded-[8px] bg-gray-50 border border-[#E2E8F4] text-xs text-[#4A5568]">
              <h4 className="font-bold text-[#0F172A] mb-1.5">Spreadsheet Validation Guidelines</h4>
              <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                <li>Headers: First Name*, Last Name*, Email*, Phone, Role Interest*, Language Level*, Source, Notes</li>
                <li>Valid Role Interests: Nursing, Ausbildung, Care, Other</li>
                <li>Valid Language Levels: A2, B1, B2</li>
                <li>Duplicate emails within file or existing registered candidates will be automatically flagged.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 2: VALIDATION PREVIEW TABLE */}
        {/* ==================================================== */}
        {step === 2 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#E2E8F4]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Validation Preview</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  File: <span className="font-semibold text-[#0F172A]">{selectedFile?.name}</span> ({parsedRows.length} total rows)
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#94A3B8] hover:text-[#0F172A] font-medium"
              >
                Change File
              </button>
            </div>

            {/* Summary Strip */}
            <div className="p-4 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4] mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#0F172A]">
                  <span className="text-[#10B981] font-bold">{validCount} valid rows</span> ready to process.
                  {errorCount > 0 && (
                    <span className="text-rose-600 font-bold ml-1.5">
                      {errorCount} rows have errors and will be skipped.
                    </span>
                  )}
                </p>
                {errorCount > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Rows with errors will be skipped. You can fix errors and re-upload to include them.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={validCount === 0 || processing}
                onClick={handleProcessValidRows}
                className="bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-[6px] text-xs transition-colors flex items-center space-x-1.5 shadow-sm self-start sm:self-auto"
              >
                {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Process {validCount} Valid Rows</span>
              </button>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto max-h-[460px] border border-[#E2E8F4] rounded-[8px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#F8FAFD] z-10">
                  <tr className="border-b border-[#E2E8F4] text-[#94A3B8]">
                    <th className="py-2.5 px-3 font-semibold">Row</th>
                    <th className="py-2.5 px-3 font-semibold">First Name</th>
                    <th className="py-2.5 px-3 font-semibold">Last Name</th>
                    <th className="py-2.5 px-3 font-semibold">Email</th>
                    <th className="py-2.5 px-3 font-semibold">Role</th>
                    <th className="py-2.5 px-3 font-semibold">Level</th>
                    <th className="py-2.5 px-3 font-semibold">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                  {parsedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`hover:bg-gray-50 ${!row.isValid ? 'bg-rose-50/30' : ''}`}
                    >
                      <td className="py-2.5 px-3 font-mono text-[#94A3B8]">{row.rowNumber}</td>
                      <td className="py-2.5 px-3 font-medium">{row.firstName || '—'}</td>
                      <td className="py-2.5 px-3 font-medium">{row.lastName || '—'}</td>
                      <td className="py-2.5 px-3 text-[#4A5568]">{row.email || '—'}</td>
                      <td className="py-2.5 px-3 capitalize">{row.roleInterest || '—'}</td>
                      <td className="py-2.5 px-3 font-mono">{row.languageLevel || '—'}</td>
                      <td className="py-2.5 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Valid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-700 font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{row.errorReason}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 3: PROCESSING OVERLAY */}
        {/* ==================================================== */}
        {step === 3 && (
          <div className="py-16 text-center">
            <Loader2 className="w-10 h-10 text-[#1B3270] animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-[#0F172A] mb-1">
              Processing Candidate Batches...
            </h3>
            <p className="text-xs text-[#4A5568]">
              Creating candidate records and generating secure qualification invite tokens.
            </p>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 4: RESULTS TABLE & ACTIONS */}
        {/* ==================================================== */}
        {step === 4 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#E2E8F4]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Upload Complete</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  <span className="text-emerald-700 font-bold">{successResultsCount} candidates added</span>
                  {' · '}
                  <span className={errorResultsCount > 0 ? 'text-rose-600 font-bold' : 'text-[#94A3B8]'}>
                    {errorResultsCount} errors
                  </span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAllLinks}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#1B3270] text-white rounded-[6px] text-xs font-semibold hover:bg-[#2952A3] transition-colors shadow-xs"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAll ? 'All Links Copied' : 'Copy All Links'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadResultsCsv}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-[#E2E8F4] text-[#0F172A] rounded-[6px] text-xs font-semibold hover:bg-gray-50 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#1B3270]" />
                  <span>Download Results as CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-[#4A5568] rounded-[6px] text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Upload Another File</span>
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto max-h-[460px] border border-[#E2E8F4] rounded-[8px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#F8FAFD] z-10">
                  <tr className="border-b border-[#E2E8F4] text-[#94A3B8]">
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Name</th>
                    <th className="py-2.5 px-3 font-semibold">Email</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Invite Link</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                  {results.map((r, idx) => {
                    const fullInviteLink = r.invite_token
                      ? `${window.location.origin}/invite/${r.invite_token}`
                      : null;

                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-mono text-[#94A3B8]">{r.row_number}</td>
                        <td className="py-2.5 px-3 font-medium">{r.name}</td>
                        <td className="py-2.5 px-3 text-[#4A5568]">{r.email}</td>
                        <td className="py-2.5 px-3">
                          {r.status === 'success' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Added
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Error ({r.error_reason})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#4A5568] max-w-[200px] truncate">
                          {fullInviteLink ? (
                            <a
                              href={fullInviteLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#1B3270] hover:underline"
                            >
                              {fullInviteLink}
                            </a>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {r.invite_token ? (
                            <button
                              type="button"
                              onClick={() => handleCopyRowLink(r.invite_token!, idx)}
                              className="text-xs text-[#1B3270] hover:underline font-semibold"
                            >
                              {copiedRowIdx === idx ? 'Copied' : 'Copy'}
                            </button>
                          ) : (
                            <span className="text-[#94A3B8] text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* PREVIOUS BULK UPLOADS HISTORY SECTION */}
      {/* ==================================================== */}
      <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
        <div className="mb-4 pb-3 border-b border-[#E2E8F4]">
          <h3 className="text-sm font-bold text-[#0F172A]">Previous Bulk Uploads</h3>
          <p className="text-xs text-[#4A5568] mt-0.5">
            Audit history of candidate spreadsheets processed for your organization.
          </p>
        </div>

        {loadingHistory ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 text-[#1B3270] animate-spin" />
          </div>
        ) : previousUploads.length === 0 ? (
          <p className="text-xs text-[#94A3B8] italic py-3">No previous bulk uploads on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F4] text-[#94A3B8]">
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">File Name</th>
                  <th className="py-2.5 px-3 font-semibold">Status / Counts</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                {previousUploads.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-[#4A5568]">{formatDate(item.created_at)}</td>
                    <td className="py-2.5 px-3 font-medium flex items-center space-x-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#1B3270]" />
                      <span>{item.file_name || 'candidates.csv'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-700 font-bold">{item.successful_rows || 0} added</span>
                      {' · '}
                      <span className={item.failed_rows > 0 ? 'text-rose-600 font-bold' : 'text-[#94A3B8]'}>
                        {item.failed_rows || 0} errors
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {Array.isArray(item.results) && item.results.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryModalResults({
                              fileName: item.file_name || 'Upload Batch',
                              date: item.created_at,
                              results: item.results,
                            })
                          }
                          className="inline-flex items-center space-x-1 text-xs text-[#1B3270] hover:underline font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Results</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8] italic">No saved results</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
