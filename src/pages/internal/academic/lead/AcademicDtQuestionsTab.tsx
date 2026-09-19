import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Search,
  CheckCircle,
  Plus,
  Loader2,
  RefreshCw,
  X,
  Edit2,
  Power,
  Trash2,
} from 'lucide-react';
import { MultiSelectFilter } from '../../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../../components/DeleteConfirmationModal';
import { DtQuestionBulkImport } from '../../components/DtQuestionBulkImport';
import { PoolHealthSummary } from '../../components/PoolHealthSummary';

interface DtQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  difficulty_level: string;
  topic: string;
  question_order: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
  created_at?: string;
  updater_name?: string;
}

export const AcademicDtQuestionsTab: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<DtQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [poolRefreshTrigger, setPoolRefreshTrigger] = useState(0);
  const importSectionRef = useRef<HTMLDivElement>(null);

  // Filters (Multi-select)
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Row expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit Modal
  const [editingQuestion, setEditingQuestion] = useState<DtQuestion | null>(null);
  const [editForm, setEditForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    difficulty_level: 'beginner',
    topic: '',
    question_order: 1,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Toggle Status Modal
  const [togglingQuestion, setTogglingQuestion] = useState<DtQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<DtQuestion | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add Question Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDifficulty, setNewDifficulty] = useState('Beginner');
  const [newTopic, setNewTopic] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newOptionC, setNewOptionC] = useState('');
  const [newOptionD, setNewOptionD] = useState('');
  const [newCorrectOption, setNewCorrectOption] = useState('A');
  const [newQuestionOrder, setNewQuestionOrder] = useState<number>(1);
  const [addingQuestion, setAddingQuestion] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dt_questions')
        .select(`
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          difficulty_level,
          topic,
          question_order,
          is_active,
          updated_by,
          updated_at,
          created_at
        `)
        .order('question_order', { ascending: true });

      if (error) throw error;

      const qList = data || [];

      // Fetch updater profile names
      const updaterIds = Array.from(
        new Set(qList.map((q) => q.updated_by).filter((id): id is string => Boolean(id)))
      );

      const nameMap: Record<string, string> = {};
      if (updaterIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', updaterIds);

        (profs || []).forEach((p) => {
          nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const mapped: DtQuestion[] = qList.map((q) => ({
        ...q,
        updater_name: q.updated_by ? nameMap[q.updated_by] || 'Academic Staff' : undefined,
      }));

      setQuestions(mapped);
      setPoolRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('Error fetching DT questions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleOpenEdit = (q: DtQuestion) => {
    setEditingQuestion(q);
    setEditForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      difficulty_level: q.difficulty_level,
      topic: q.topic,
      question_order: q.question_order,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !user) return;

    try {
      setSavingEdit(true);
      const nowIso = new Date().toISOString();

      const previousData = {
        question_text: editingQuestion.question_text,
        option_a: editingQuestion.option_a,
        option_b: editingQuestion.option_b,
        option_c: editingQuestion.option_c,
        option_d: editingQuestion.option_d,
        correct_option: editingQuestion.correct_option,
        difficulty_level: editingQuestion.difficulty_level,
        topic: editingQuestion.topic,
        question_order: editingQuestion.question_order,
      };

      const newData = {
        question_text: editForm.question_text.trim(),
        option_a: editForm.option_a.trim(),
        option_b: editForm.option_b.trim(),
        option_c: editForm.option_c.trim(),
        option_d: editForm.option_d.trim(),
        correct_option: editForm.correct_option,
        difficulty_level: editForm.difficulty_level,
        topic: editForm.topic.trim(),
        question_order: Number(editForm.question_order) || 1,
      };

      // 1. Update dt_questions
      const { error: updateErr } = await supabase
        .from('dt_questions')
        .update({
          ...newData,
          updated_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', editingQuestion.id);

      if (updateErr) throw updateErr;

      // 2. Insert dt_question_audit
      await supabase.from('dt_question_audit').insert({
        question_id: editingQuestion.id,
        action: 'updated',
        changed_by: user.id,
        previous_data: previousData,
        new_data: newData,
        change_summary: `Academic Lead updated question #${newData.question_order}`,
      });

      showToast(`Question #${newData.question_order} updated successfully.`);
      setEditingQuestion(null);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to update question.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async () => {
    if (!togglingQuestion || !user || actionLoading) return;

    try {
      setActionLoading(true);
      const nowIso = new Date().toISOString();
      const nextActive = !togglingQuestion.is_active;
      const actionName = nextActive ? 'reactivated' : 'deactivated';

      const { error } = await supabase
        .from('dt_questions')
        .update({
          is_active: nextActive,
          updated_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', togglingQuestion.id);

      if (error) throw error;

      await supabase.from('dt_question_audit').insert({
        question_id: togglingQuestion.id,
        action: actionName,
        changed_by: user.id,
        previous_data: { is_active: togglingQuestion.is_active },
        new_data: { is_active: nextActive },
        change_summary: `Academic Lead ${actionName} question #${togglingQuestion.question_order}`,
      });

      showToast(`Question #${togglingQuestion.question_order} ${actionName}.`);
      setTogglingQuestion(null);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle question status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setAddingQuestion(true);
      const nowIso = new Date().toISOString();

      const insertPayload = {
        question_text: newQuestionText.trim(),
        option_a: newOptionA.trim(),
        option_b: newOptionB.trim(),
        option_c: newOptionC.trim(),
        option_d: newOptionD.trim(),
        correct_option: newCorrectOption,
        difficulty_level: newDifficulty.toLowerCase(),
        topic: newTopic.trim() || 'General Clinical German',
        question_order: Number(newQuestionOrder) || questions.length + 1,
        is_active: true,
        updated_by: user.id,
        updated_at: nowIso,
      };

      const { data: createdQ, error } = await supabase
        .from('dt_questions')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      if (createdQ) {
        await supabase.from('dt_question_audit').insert({
          question_id: createdQ.id,
          action: 'created',
          changed_by: user.id,
          previous_data: null,
          new_data: insertPayload,
          change_summary: `Academic Lead added question #${insertPayload.question_order}`,
        });
      }

      showToast('Diagnostic test question created successfully.');
      setIsAddModalOpen(false);
      setNewQuestionText('');
      setNewOptionA('');
      setNewOptionB('');
      setNewOptionC('');
      setNewOptionD('');
      setNewTopic('');
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to create question.');
    } finally {
      setAddingQuestion(false);
    }
  };

  // Delete Question (Tier 2 for Academic Lead)
  const handleDeleteQuestion = async () => {
    if (!deletingQuestion || !user || actionLoading) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('dt_questions')
        .delete()
        .eq('id', deletingQuestion.id);

      if (error) throw error;

      await supabase.from('dt_question_audit').insert({
        question_id: deletingQuestion.id,
        action: 'deleted',
        changed_by: user.id,
        previous_data: deletingQuestion,
        change_summary: `Academic Lead deleted question #${deletingQuestion.question_order}`,
      });

      showToast('Question deleted.');
      setDeletingQuestion(null);
      fetchQuestions();
    } catch (err: any) {
      console.error('Error deleting question:', err);
      alert(err.message || 'Failed to delete question.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (difficultyFilter.length > 0 && !difficultyFilter.includes(q.difficulty_level.toLowerCase())) {
        return false;
      }
      if (activeFilter.length > 0) {
        const status = q.is_active ? 'active' : 'inactive';
        if (!activeFilter.includes(status)) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchText = q.question_text.toLowerCase().includes(query);
        const matchTopic = q.topic.toLowerCase().includes(query);
        const matchOrder = String(q.question_order).includes(query);
        if (!matchText && !matchTopic && !matchOrder) return false;
      }
      return true;
    });
  }, [questions, difficultyFilter, activeFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Diagnostic Test Question Bank</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage the clinical diagnostic evaluation questions. Changes are logged to the academic audit ledger.
          </p>
        </div>
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchQuestions();
            }}
            disabled={loading || refreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Questions'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewQuestionOrder(questions.length + 1);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* POOL HEALTH MONITORING */}
      <PoolHealthSummary
        refreshTrigger={poolRefreshTrigger}
        onImportClick={() => {
          importSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* BULK IMPORT SECTION */}
      <div ref={importSectionRef}>
        <DtQuestionBulkImport onImportComplete={fetchQuestions} />
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-[#E2E8F4] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text, topic, or #..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Difficulty Filter */}
            <MultiSelectFilter
              label="Difficulties"
              options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'elementary', label: 'Elementary' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'upper intermediate', label: 'Upper Intermediate' },
                { value: 'b2', label: 'B2' },
              ]}
              selectedValues={difficultyFilter}
              onChange={setDifficultyFilter}
            />

            {/* Active Filter */}
            <MultiSelectFilter
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              selectedValues={activeFilter}
              onChange={setActiveFilter}
            />
          </div>
        </div>

        {/* Questions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3 w-12">#</th>
                <th className="px-4 py-3">Question & Topic</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Correct Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F4]">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No diagnostic test questions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q) => {
                  const isExpanded = expandedId === q.id;
                  return (
                    <React.Fragment key={q.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          !q.is_active ? 'opacity-60 bg-slate-50/40' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      >
                        <td className="px-5 py-3.5 font-bold text-slate-700">#{q.question_order}</td>
                        <td className="px-4 py-3.5 max-w-md">
                          <p className="font-semibold text-slate-900 line-clamp-1">{q.question_text}</p>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            Topic: {q.topic}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              q.difficulty_level.toLowerCase() === 'beginner'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : q.difficulty_level.toLowerCase() === 'intermediate'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {q.difficulty_level}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="w-6 h-6 rounded-full bg-[#1B3270]/10 text-[#1B3270] font-bold flex items-center justify-center text-xs">
                            {q.correct_option}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              q.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {q.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                          {q.updater_name || 'System'}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(q)}
                            className="p-1.5 text-slate-500 hover:text-[#1B3270] hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
                            title="Edit Question"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTogglingQuestion(q)}
                            className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                              q.is_active
                                ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                            title={q.is_active ? 'Deactivate Question' : 'Activate Question'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingQuestion(q)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-[6px] transition-colors cursor-pointer"
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Options Card */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-2.5 max-w-3xl">
                              <p className="text-xs font-bold text-slate-900 leading-relaxed">
                                {q.question_text}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div
                                  className={`p-2 rounded-[6px] border ${
                                    q.correct_option === 'A'
                                      ? 'bg-emerald-50/80 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <strong>A:</strong> {q.option_a}
                                </div>
                                <div
                                  className={`p-2 rounded-[6px] border ${
                                    q.correct_option === 'B'
                                      ? 'bg-emerald-50/80 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <strong>B:</strong> {q.option_b}
                                </div>
                                <div
                                  className={`p-2 rounded-[6px] border ${
                                    q.correct_option === 'C'
                                      ? 'bg-emerald-50/80 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <strong>C:</strong> {q.option_c}
                                </div>
                                <div
                                  className={`p-2 rounded-[6px] border ${
                                    q.correct_option === 'D'
                                      ? 'bg-emerald-50/80 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <strong>D:</strong> {q.option_d}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT QUESTION MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Diagnostic Question #{editingQuestion.question_order}
              </h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Question Order #</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.question_order}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, question_order: Number(e.target.value) }))
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Difficulty</label>
                  <select
                    value={editForm.difficulty_level}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, difficulty_level: e.target.value }))
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Topic</label>
                  <input
                    type="text"
                    required
                    value={editForm.topic}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, topic: e.target.value }))}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Question Text *</label>
                <textarea
                  required
                  rows={2}
                  value={editForm.question_text}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, question_text: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Options & Correct Answer</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">A:</span>
                    <input
                      type="text"
                      required
                      value={editForm.option_a}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, option_a: e.target.value }))}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">B:</span>
                    <input
                      type="text"
                      required
                      value={editForm.option_b}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, option_b: e.target.value }))}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">C:</span>
                    <input
                      type="text"
                      required
                      value={editForm.option_c}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, option_c: e.target.value }))}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">D:</span>
                    <input
                      type="text"
                      required
                      value={editForm.option_d}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, option_d: e.target.value }))}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="font-semibold text-slate-700">Correct Option</label>
                <div className="flex items-center space-x-4">
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <label key={opt} className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="correct_option"
                        value={opt}
                        checked={editForm.correct_option === opt}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, correct_option: e.target.value }))
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="font-bold text-slate-800">Option {opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD QUESTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">Add New Diagnostic Test Question</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Question Order #</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newQuestionOrder}
                    onChange={(e) => setNewQuestionOrder(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Difficulty</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Topic</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Clinical Terminology"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Question Text *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Enter the clinical German question..."
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Multiple Choice Options</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">A:</span>
                    <input
                      type="text"
                      required
                      placeholder="Option A"
                      value={newOptionA}
                      onChange={(e) => setNewOptionA(e.target.value)}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">B:</span>
                    <input
                      type="text"
                      required
                      placeholder="Option B"
                      value={newOptionB}
                      onChange={(e) => setNewOptionB(e.target.value)}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">C:</span>
                    <input
                      type="text"
                      required
                      placeholder="Option C"
                      value={newOptionC}
                      onChange={(e) => setNewOptionC(e.target.value)}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600 w-4">D:</span>
                    <input
                      type="text"
                      required
                      placeholder="Option D"
                      value={newOptionD}
                      onChange={(e) => setNewOptionD(e.target.value)}
                      className="flex-1 text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="font-semibold text-slate-700">Correct Option</label>
                <div className="flex items-center space-x-4">
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <label key={opt} className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="new_correct_option"
                        value={opt}
                        checked={newCorrectOption === opt}
                        onChange={(e) => setNewCorrectOption(e.target.value)}
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="font-bold text-slate-800">Option {opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingQuestion}
                  className="px-4 py-1.5 font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {addingQuestion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Question</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOGGLE ACTIVE CONFIRM MODAL */}
      {togglingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 text-center space-y-3">
              <div
                className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center ${
                  togglingQuestion.is_active ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {togglingQuestion.is_active ? 'Deactivate Question' : 'Reactivate Question'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to {togglingQuestion.is_active ? 'deactivate' : 'reactivate'} question #{' '}
                  {togglingQuestion.question_order}?
                  {togglingQuestion.is_active &&
                    ' Inactive questions will no longer appear on the diagnostic test for candidates.'}
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTogglingQuestion(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleToggleActive}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-[6px] cursor-pointer shadow-2xs flex items-center space-x-1 ${
                    togglingQuestion.is_active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{togglingQuestion.is_active ? 'Confirm Deactivate' : 'Confirm Reactivate'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE QUESTION MODAL (Tier 2) */}
      <DeleteConfirmationModal
        isOpen={!!deletingQuestion}
        onClose={() => setDeletingQuestion(null)}
        onConfirm={handleDeleteQuestion}
        tier="tier2"
        entityType="Question"
        entityName={`Question #${deletingQuestion?.question_order}`}
        bodyText="Deleting this question will remove it from the test permanently. Historical dt_answers will be retained."
        isDeleting={actionLoading}
      />
    </div>
  );
};
export default AcademicDtQuestionsTab;
