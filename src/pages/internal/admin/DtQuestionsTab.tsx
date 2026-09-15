import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  HelpCircle,
  Search,
  CheckCircle,
  AlertTriangle,
  Plus,
  Loader2,
  RefreshCw,
  X,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { DtQuestionBulkImport } from '../components/DtQuestionBulkImport';

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

export const DtQuestionsTab: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<DtQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // Deactivate Confirm Modal
  const [deactivatingQuestion, setDeactivatingQuestion] = useState<DtQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<DtQuestion | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add Question Form state
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
          created_at,
          updater:updated_by (first_name, last_name, email)
        `)
        .order('question_order', { ascending: true });

      if (error) throw error;

      const mapped: DtQuestion[] = (data || []).map((q: any) => {
        const updater = q.updater;
        const uName = updater
          ? `${updater.first_name || ''} ${updater.last_name || ''}`.trim() || updater.email
          : 'System';

        return {
          id: q.id,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          difficulty_level: q.difficulty_level,
          topic: q.topic,
          question_order: q.question_order,
          is_active: q.is_active ?? true,
          updated_by: q.updated_by,
          updated_at: q.updated_at,
          created_at: q.created_at,
          updater_name: uName,
        };
      });

      setQuestions(mapped);

      // Default new question order to max + 1
      const maxOrder = mapped.reduce((max, cur) => Math.max(max, cur.question_order || 0), 0);
      setNewQuestionOrder(maxOrder + 1);
    } catch (err) {
      console.error('Error fetching dt questions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const activeCount = useMemo(() => {
    return questions.filter((q) => q.is_active).length;
  }, [questions]);

  // Edit Action
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
    if (!editingQuestion || !user || savingEdit) return;
    setSavingEdit(true);
    try {
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
        question_order: Number(editForm.question_order),
      };

      // 1. Update question
      const { error: updateErr } = await supabase
        .from('dt_questions')
        .update({
          ...newData,
          updated_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', editingQuestion.id);

      if (updateErr) throw updateErr;

      // 2. Insert audit
      await supabase.from('dt_question_audit').insert({
        question_id: editingQuestion.id,
        action: 'updated',
        changed_by: user.id,
        previous_data: previousData,
        new_data: newData,
        change_summary: `Super Admin updated question #${newData.question_order}`,
      });

      showToast(`Question #${newData.question_order} updated successfully.`);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (err: any) {
      console.error('Error saving question:', err);
      alert(err.message || 'Failed to update question.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Active/Deactive
  const handleToggleDeactivate = async () => {
    if (!deactivatingQuestion || !user || actionLoading) return;
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const nextActive = !deactivatingQuestion.is_active;
      const actionName = nextActive ? 'reactivated' : 'deactivated';

      const { error } = await supabase
        .from('dt_questions')
        .update({
          is_active: nextActive,
          updated_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', deactivatingQuestion.id);

      if (error) throw error;

      await supabase.from('dt_question_audit').insert({
        question_id: deactivatingQuestion.id,
        action: actionName,
        changed_by: user.id,
        previous_data: { is_active: deactivatingQuestion.is_active },
        new_data: { is_active: nextActive },
        change_summary: `Super Admin ${actionName} question #${deactivatingQuestion.question_order}`,
      });

      showToast(`Question #${deactivatingQuestion.question_order} ${actionName}.`);
      setDeactivatingQuestion(null);
      fetchQuestions();
    } catch (err: any) {
      console.error('Error toggling question status:', err);
      alert(err.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Question
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || addingQuestion) return;
    if (!newQuestionText.trim() || !newOptionA.trim() || !newOptionB.trim() || !newTopic.trim()) {
      alert('Fill out all required fields.');
      return;
    }

    setAddingQuestion(true);
    try {
      const payload = {
        question_text: newQuestionText.trim(),
        option_a: newOptionA.trim(),
        option_b: newOptionB.trim(),
        option_c: newOptionC.trim(),
        option_d: newOptionD.trim(),
        correct_option: newCorrectOption,
        difficulty_level: newDifficulty,
        topic: newTopic.trim(),
        question_order: Number(newQuestionOrder),
        is_active: true,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('dt_questions')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      if (data?.id) {
        await supabase.from('dt_question_audit').insert({
          question_id: data.id,
          action: 'created',
          changed_by: user.id,
          previous_data: null,
          new_data: payload,
          change_summary: `Super Admin created question #${payload.question_order}`,
        });
      }

      showToast(`Question #${payload.question_order} added to bank!`);
      // Reset form
      setNewQuestionText('');
      setNewOptionA('');
      setNewOptionB('');
      setNewOptionC('');
      setNewOptionD('');
      setNewTopic('');
      fetchQuestions();
    } catch (err: any) {
      console.error('Error adding question:', err);
      alert(err.message || 'Failed to add question.');
    } finally {
      setAddingQuestion(false);
    }
  };

  // Delete Question (Tier 2)
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
        change_summary: `Super Admin deleted question #${deletingQuestion.question_order}`,
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
        const s = searchQuery.toLowerCase();
        const text = q.question_text.toLowerCase();
        const topic = q.topic.toLowerCase();
        if (!text.includes(s) && !topic.includes(s)) return false;
      }
      return true;
    });
  }, [questions, difficultyFilter, activeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Diagnostic Test Questions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain the Diagnostic Test question bank, configure difficulty thresholds, and track audit history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchQuestions();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ACTIVE COUNT BANNER */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-[#1B3270] rounded-lg">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {activeCount} active questions in the test
            </p>
            <p className="text-xs text-slate-500">
              Diagnostic assessment randomly draws from the active question bank.
            </p>
          </div>
        </div>

        {activeCount !== 15 ? (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Test has {activeCount} active questions. Expected: 15.
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Standard 15-question quota met.
          </span>
        )}
      </div>

      {/* BULK IMPORT SECTION */}
      <DtQuestionBulkImport onImportComplete={fetchQuestions} />

      {/* SECTION: QUESTION BANK */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800">Question Bank</h2>

          {/* Difficulty & Active Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>

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

        {/* Question List Table */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading question bank...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="py-16 text-center">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No questions found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your difficulty or search filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F4] text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5 w-12 text-center">#</th>
                    <th className="px-4 py-3.5">Question Preview</th>
                    <th className="px-4 py-3.5">Difficulty</th>
                    <th className="px-4 py-3.5">Topic</th>
                    <th className="px-4 py-3.5">Active</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4]">
                  {filteredQuestions.map((q) => {
                    const isExpanded = expandedId === q.id;
                    return (
                      <React.Fragment key={q.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700">
                            {q.question_order}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-800 line-clamp-1 max-w-md">
                              {q.question_text}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                              {q.difficulty_level}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-medium">{q.topic}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                q.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {q.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : q.id)}
                              className="px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded text-xs font-semibold"
                            >
                              {isExpanded ? 'Hide' : 'Expand'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(q)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#1B3270] hover:bg-slate-100 rounded"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeactivatingQuestion(q)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                q.is_active
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {q.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingQuestion(q)}
                              className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-[#EF4444] hover:bg-red-50 border border-[#EF4444] rounded transition-colors cursor-pointer"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>

                        {/* EXPANDED ROW */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={6} className="px-6 py-4 space-y-3 border-y border-[#E2E8F4]">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                  Full Question Text
                                </span>
                                <p className="text-sm font-semibold text-slate-900 mt-0.5 leading-relaxed">
                                  {q.question_text}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {[
                                  { label: 'A', text: q.option_a },
                                  { label: 'B', text: q.option_b },
                                  { label: 'C', text: q.option_c },
                                  { label: 'D', text: q.option_d },
                                ].map((opt) => {
                                  const isCorrect = q.correct_option.toUpperCase() === opt.label;
                                  return (
                                    <div
                                      key={opt.label}
                                      className={`p-2.5 rounded-[6px] border text-xs flex items-center justify-between ${
                                        isCorrect
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                          : 'bg-white border-slate-200 text-slate-700'
                                      }`}
                                    >
                                      <span>
                                        <strong>Option {opt.label}:</strong> {opt.text}
                                      </span>
                                      {isCorrect && (
                                        <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                          Correct Answer
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200/60">
                                <span>Topic: <strong>{q.topic}</strong></span>
                                <span>
                                  Last modified: {q.updated_at ? new Date(q.updated_at).toLocaleString() : '—'} by {q.updater_name}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: ADD NEW QUESTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="border-b border-[#E2E8F4] pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1B3270]">Add New Question</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Insert a new item directly into the active diagnostic test bank.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
            Next Order: #{newQuestionOrder}
          </span>
        </div>

        <form onSubmit={handleAddQuestion} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Difficulty Level *
              </label>
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="Beginner">Beginner</option>
                <option value="Elementary">Elementary</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Upper Intermediate">Upper Intermediate</option>
                <option value="B2">B2</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Topic *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Clinical Terminology, Grammar, Patient Care"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Question Order *
              </label>
              <input
                type="number"
                required
                min={1}
                value={newQuestionOrder}
                onChange={(e) => setNewQuestionOrder(Number(e.target.value))}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Question Text *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Enter the full question prompt..."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              className="w-full border border-[#E2E8F4] rounded-[6px] p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Option A *
              </label>
              <input
                type="text"
                required
                placeholder="First answer option"
                value={newOptionA}
                onChange={(e) => setNewOptionA(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Option B *
              </label>
              <input
                type="text"
                required
                placeholder="Second answer option"
                value={newOptionB}
                onChange={(e) => setNewOptionB(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Option C *
              </label>
              <input
                type="text"
                required
                placeholder="Third answer option"
                value={newOptionC}
                onChange={(e) => setNewOptionC(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Option D *
              </label>
              <input
                type="text"
                required
                placeholder="Fourth answer option"
                value={newOptionD}
                onChange={(e) => setNewOptionD(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-semibold text-slate-700">Correct Answer *</label>
              <select
                value={newCorrectOption}
                onChange={(e) => setNewCorrectOption(e.target.value)}
                className="border border-[#E2E8F4] rounded-[6px] px-3 py-1.5 text-xs font-bold text-slate-800 bg-white focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={addingQuestion}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              {addingQuestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Question</span>
            </button>
          </div>
        </form>
      </div>

      {/* EDIT MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-base font-bold text-slate-800">Edit Question #{editForm.question_order}</h3>
              <button onClick={() => setEditingQuestion(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
                  <select
                    value={editForm.difficulty_level}
                    onChange={(e) => setEditForm({ ...editForm, difficulty_level: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Elementary">Elementary</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Upper Intermediate">Upper Intermediate</option>
                    <option value="B2">B2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Topic</label>
                  <input
                    type="text"
                    value={editForm.topic}
                    onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Question Text</label>
                <textarea
                  rows={3}
                  value={editForm.question_text}
                  onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                  className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Option A</label>
                  <input
                    type="text"
                    value={editForm.option_a}
                    onChange={(e) => setEditForm({ ...editForm, option_a: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Option B</label>
                  <input
                    type="text"
                    value={editForm.option_b}
                    onChange={(e) => setEditForm({ ...editForm, option_b: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Option C</label>
                  <input
                    type="text"
                    value={editForm.option_c}
                    onChange={(e) => setEditForm({ ...editForm, option_c: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Option D</label>
                  <input
                    type="text"
                    value={editForm.option_d}
                    onChange={(e) => setEditForm({ ...editForm, option_d: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correct Option</label>
                  <select
                    value={editForm.correct_option}
                    onChange={(e) => setEditForm({ ...editForm, correct_option: e.target.value })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs font-bold"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order Position</label>
                  <input
                    type="number"
                    value={editForm.question_order}
                    onChange={(e) => setEditForm({ ...editForm, question_order: Number(e.target.value) })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] disabled:opacity-50 flex items-center space-x-1"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE CONFIRM MODAL */}
      {deactivatingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-800">
                {deactivatingQuestion.is_active ? 'Deactivate Question' : 'Reactivate Question'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {deactivatingQuestion.is_active
                ? 'Deactivating this question removes it from the test. Active tests in progress will not be affected.'
                : 'Reactivating this question makes it immediately available in the active diagnostic test bank.'}
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeactivatingQuestion(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleDeactivate}
                disabled={actionLoading}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5 ${
                  deactivatingQuestion.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {deactivatingQuestion.is_active ? 'Confirm Deactivation' : 'Confirm Reactivation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE QUESTION CONFIRMATION (Tier 2) */}
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
