export type QuizStatus = 'lobby' | 'live' | 'finished';
export type QuestionType = 'single' | 'multiple' | 'boolean';

export type PublicQuestion = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  points: number;
  time_limit: number;
  position: number;
};
