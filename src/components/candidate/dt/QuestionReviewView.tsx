import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  ArrowLeft,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { formatDate } from '../../../utils/formatters';

interface QuestionReviewViewProps {
  attemptId: string;
  onBack: () => void;
  initialFilter?: 'all' | 'correct' | 'incorrect' | string;
  readOnly?: boolean;
}

export const QuestionReviewView: React.FC<QuestionReviewViewProps> = ({
  attemptId,
  onBack,
  initialFilter = 'all',
  readOnly = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | string>(initialFilter);

  useEffect(() => {
    const fetchAnswers = async () => {
      if (!attemptId) return;
      try {
        setLoading(true);

        // 1. Fetch attempt
        const { data: attData, error: attErr } = await supabase
          .from('dt_attempts')
          .select('*')
          .eq('id', attemptId)
          .maybeSingle();

        if (attErr) throw attErr;
        setAttempt(attData);

        // 2. Fetch dt_answers joined with dt_questions
        const { data: ansData, error: ansErr } = await supabase
          .from('dt_answers')
          .select(`
            id,
            attempt_id,
            question_id,
            selected_option,
            is_correct,
            answered_at,
            dt_questions (
              id,
              question_text,
              option_a,
              option_b,
              option_c,
              option_d,
              correct_option,
              difficulty_level,
              topic,
              question_order
            )
          `)
          .eq('attempt_id', attemptId);

        if (ansErr) throw ansErr;

        // Sort by dt_questions.question_order ascending
        const sorted = (ansData || []).sort((a: any, b: any) => {
          const orderA = a.dt_questions?.question_order ?? 0;
          const orderB = b.dt_questions?.question_order ?? 0;
          return orderA - orderB;
        });

        setAnswers(sorted);
      } catch (err) {
        console.error('Error fetching attempt review data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnswers();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
        <span className="text-xs text-[#94A3B8] font-medium">Loading answers review...</span>
      </div>
    );
  }

  const totalQuestions = answers.length || 15;
  const correctCount = answers.filter((a) => a.is_correct).length;
  const incorrectCount = answers.length - correctCount;
  const scorePct = attempt?.score_pct ?? Math.round((correctCount / totalQuestions) * 10000) / 100;

  // Filter items
  const filteredAnswers = answers.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'correct') return item.is_correct;
    if (filter === 'incorrect') return !item.is_correct;
    // Difficulty filters (e.g. 'beginner', 'elementary', etc.)
    return item.dt_questions?.difficulty_level === filter;
  });

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            Beginner
          </span>
        );
      case 'elementary':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            Elementary
          </span>
        );
      case 'intermediate':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Intermediate
          </span>
        );
      case 'upper_intermediate':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-orange-50 text-orange-700 border border-orange-200">
            Upper Intermediate
          </span>
        );
      case 'b2':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            B2 Level
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {difficulty}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150 pb-20">
      {/* HEADER */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-[6px] hover:bg-slate-100 text-[#1B3270] transition-colors"
            title="Back to results"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#1B3270] flex items-center space-x-2">
              <span>Review Your Answers</span>
              {readOnly && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  Read Only
                </span>
              )}
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Diagnostic Test — {attempt?.completed_at ? formatDate(attempt.completed_at) : 'Completed'}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right bg-slate-50 px-4 py-2 rounded-[8px] border border-[#E2E8F4]">
          <span className="text-sm font-bold text-[#1B3270] block">
            {scorePct}%
          </span>
          <span className="text-xs text-[#4A5568]">
            {correctCount}/{totalQuestions} correct
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-[#1B3270] text-white'
              : 'bg-white text-[#4A5568] border border-[#E2E8F4] hover:bg-slate-50'
          }`}
        >
          All {totalQuestions}
        </button>
        <button
          type="button"
          onClick={() => setFilter('correct')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
            filter === 'correct'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <Check size={13} strokeWidth={2.5} />
          <span>Correct ({correctCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('incorrect')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
            filter === 'incorrect'
              ? 'bg-rose-600 text-white'
              : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <X size={13} strokeWidth={2.5} />
          <span>Incorrect ({incorrectCount})</span>
        </button>

        {/* Difficulty filter tags */}
        {['beginner', 'elementary', 'intermediate', 'upper_intermediate', 'b2'].map((diff) => {
          const count = answers.filter((a) => a.dt_questions?.difficulty_level === diff).length;
          if (count === 0) return null;
          const label =
            diff === 'upper_intermediate'
              ? 'Upper Int'
              : diff === 'b2'
              ? 'B2'
              : diff.charAt(0).toUpperCase() + diff.slice(1);
          return (
            <button
              key={diff}
              type="button"
              onClick={() => setFilter(diff)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                filter === diff
                  ? 'bg-[#2952A3] text-white'
                  : 'bg-white text-[#4A5568] border border-[#E2E8F4] hover:bg-slate-50'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* QUESTION CARDS */}
      <div className="space-y-4">
        {filteredAnswers.length === 0 ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 text-center text-slate-400">
            <HelpCircle size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs">No questions match the selected filter.</p>
          </div>
        ) : (
          filteredAnswers.map((item) => {
            const q = item.dt_questions;
            const isCorrect = item.is_correct;
            const selectedOpt = item.selected_option?.toLowerCase();
            const correctOpt = q?.correct_option?.toLowerCase();

            const options: Array<{ key: 'a' | 'b' | 'c' | 'd'; label: string; text: string }> = [
              { key: 'a', label: 'A', text: q?.option_a || '' },
              { key: 'b', label: 'B', text: q?.option_b || '' },
              { key: 'c', label: 'C', text: q?.option_c || '' },
              { key: 'd', label: 'D', text: q?.option_d || '' },
            ];

            return (
              <div
                key={item.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.06)] relative overflow-hidden"
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: isCorrect ? '#10B981' : '#EF4444',
                }}
              >
                {/* CARD HEADER */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#1B3270]">
                      Q{q?.question_order ?? '-'}
                    </span>
                    {q?.difficulty_level && getDifficultyBadge(q.difficulty_level)}
                    {q?.topic && (
                      <span className="text-[10px] text-[#94A3B8] capitalize font-medium hidden sm:inline">
                        • {q.topic.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div>
                    {isCorrect ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} className="mr-1" />
                        Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle size={12} className="mr-1" />
                        Incorrect
                      </span>
                    )}
                  </div>
                </div>

                {/* QUESTION TEXT */}
                <p className="text-sm font-medium text-[#1B3270] mb-3 whitespace-pre-line leading-relaxed">
                  {q?.question_text}
                </p>

                {/* 4 ANSWER OPTIONS */}
                <div className="space-y-2">
                  {options.map((opt) => {
                    const isSelected = selectedOpt === opt.key;
                    const isThisCorrect = correctOpt === opt.key;

                    let rowBg = 'bg-white border-[#E2E8F4]';
                    let circleStyle = 'bg-[#E2E8F4] text-[#94A3B8]';
                    let icon = null;
                    let showCorrectLabel = false;

                    if (isSelected && isThisCorrect) {
                      rowBg = 'bg-[#F0FDF4] border-[#10B981]';
                      circleStyle = 'bg-[#10B981] text-white';
                      icon = <Check size={16} className="text-[#10B981] shrink-0" />;
                    } else if (isSelected && !isThisCorrect) {
                      rowBg = 'bg-[#FEF2F2] border-[#EF4444]';
                      circleStyle = 'bg-[#EF4444] text-white';
                      icon = <X size={16} className="text-[#EF4444] shrink-0" />;
                    } else if (!isSelected && isThisCorrect) {
                      rowBg = 'bg-[#F0FDF4] border-[#10B981]';
                      circleStyle = 'border border-[#10B981] text-[#10B981] bg-white';
                      icon = <Check size={16} className="text-[#10B981] shrink-0" />;
                      showCorrectLabel = true;
                    }

                    return (
                      <div
                        key={opt.key}
                        className={`p-3 rounded-[8px] border transition-all flex items-center justify-between ${rowBg}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${circleStyle}`}
                          >
                            {opt.label}
                          </div>
                          <div>
                            <span
                              className={`text-xs ${
                                isSelected || isThisCorrect ? 'font-medium text-[#1B3270]' : 'text-[#4A5568]'
                              }`}
                            >
                              {opt.text}
                            </span>
                            {showCorrectLabel && (
                              <span className="block text-[11px] font-semibold text-[#10B981] mt-0.5">
                                Correct answer
                              </span>
                            )}
                          </div>
                        </div>

                        {icon && <div className="ml-2">{icon}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F4] px-6 py-3.5 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-4">
            <span className="text-xs font-semibold text-emerald-700 flex items-center">
              <Check size={14} className="mr-1 text-emerald-600" />
              {correctCount} correct
            </span>
            <span className="text-xs font-semibold text-rose-700 flex items-center">
              <X size={14} className="mr-1 text-rose-600" />
              {incorrectCount} incorrect
            </span>

            {/* Micro Progress Bar */}
            <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(correctCount / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs cursor-pointer"
            >
              Back to Result
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
