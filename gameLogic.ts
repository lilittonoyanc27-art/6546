/**
 * Pure game logic for Поле Чудес — Presente de Subjuntivo
 * Secret Word: DELANTERO
 */

import { QUIZ_QUESTIONS, SECRET_WORD } from './quizData.ts';
import type { QuizQuestion } from './quizData.ts';

export type SectorType = 'points' | 'multiplier' | 'plus' | 'prize';

export interface WheelSector {
  id: number;
  label: string;
  labelHy: string;
  type: SectorType;
  value: number; // points value or multiplier
  color: string;
  textColor: string;
}

export const WHEEL_SECTORS: WheelSector[] = [
  { id: 0, label: '300', labelHy: '300 միավոր', type: 'points', value: 300, color: '#f59e0b', textColor: '#1e1b4b' },
  { id: 1, label: '+1 ТАРР', labelHy: '+1 Տառ (Բոնուս)', type: 'plus', value: 1, color: '#10b981', textColor: '#ffffff' },
  { id: 2, label: '500', labelHy: '500 միավոր', type: 'points', value: 500, color: '#6366f1', textColor: '#ffffff' },
  { id: 3, label: 'x2', labelHy: 'Կրկնակի միավոր (x2)', type: 'multiplier', value: 2, color: '#ec4899', textColor: '#ffffff' },
  { id: 4, label: '200', labelHy: '200 միավոր', type: 'points', value: 200, color: '#3b82f6', textColor: '#ffffff' },
  { id: 5, label: '750', labelHy: '750 միավոր', type: 'points', value: 750, color: '#8b5cf6', textColor: '#ffffff' },
  { id: 6, label: 'ПРИЗ', labelHy: 'Ֆուտբոլային Մրցանակ', type: 'prize', value: 600, color: '#eab308', textColor: '#1e1b4b' },
  { id: 7, label: '1000', labelHy: '1000 միավոր (Ջեքփոթ)', type: 'points', value: 1000, color: '#ef4444', textColor: '#ffffff' },
];

export interface GameState {
  revealedLetters: string[]; // e.g. ['D', 'E']
  availableLetterUnlocks: number; // turns to open a chosen letter
  currentQuestionIndex: number;
  answers: Record<number, { selected: 'A' | 'B' | 'C'; isCorrect: boolean }>;
  score: number;
  streak: number;
  bestStreak: number;
  lastSectorWon: WheelSector | null;
  isWordCompleted: boolean;
  isQuizCompleted: boolean;
}

export function createInitialGameState(): GameState {
  return {
    revealedLetters: [],
    availableLetterUnlocks: 1, // Start with 1 free turn to try opening a letter immediately!
    currentQuestionIndex: 0,
    answers: {},
    score: 0,
    streak: 0,
    bestStreak: 0,
    lastSectorWon: null,
    isWordCompleted: false,
    isQuizCompleted: false,
  };
}

export function normalizeLetter(char: string): string {
  return char.trim().toUpperCase();
}

export function getWordProgress(
  revealedLetters: string[],
  word: string = SECRET_WORD
): { char: string; isRevealed: boolean; index: number }[] {
  const upperRevealed = new Set(revealedLetters.map(normalizeLetter));
  return word.split('').map((char, index) => ({
    char,
    isRevealed: upperRevealed.has(char.toUpperCase()),
    index,
  }));
}

export function isWordFullyRevealed(
  revealedLetters: string[],
  word: string = SECRET_WORD
): boolean {
  const upperRevealed = new Set(revealedLetters.map(normalizeLetter));
  return word.split('').every((char) => upperRevealed.has(char.toUpperCase()));
}

export function getRemainingUniqueLetters(
  revealedLetters: string[],
  word: string = SECRET_WORD
): string[] {
  const upperRevealed = new Set(revealedLetters.map(normalizeLetter));
  const uniqueInWord = Array.from(new Set(word.split('').map((c) => c.toUpperCase())));
  return uniqueInWord.filter((c) => !upperRevealed.has(c));
}

export interface AnswerResult {
  isCorrect: boolean;
  pointsEarned: number;
  streak: number;
  newAvailableUnlocks: number;
  explanationHy: string;
  explanationEs: string;
  allDone: boolean;
}

export function submitAnswer(
  state: GameState,
  questionId: number,
  selected: 'A' | 'B' | 'C',
  multiplier: number = 1
): { nextState: GameState; result: AnswerResult } {
  const question = QUIZ_QUESTIONS.find((q) => q.id === questionId);
  if (!question) {
    throw new Error(`Question with id ${questionId} not found`);
  }

  const isCorrect = question.correctAnswer === selected;
  const currentStreak = isCorrect ? state.streak + 1 : 0;
  const newBestStreak = Math.max(state.bestStreak, currentStreak);

  // Score calculation: 100 base + streak bonus, multiplied by active wheel multiplier
  const basePoints = isCorrect ? 100 + (currentStreak - 1) * 20 : 0;
  const pointsEarned = basePoints * Math.max(1, multiplier);

  // Each correct answer gives +1 turn to unlock a letter on the Pole Chudes board!
  const newAvailableUnlocks = isCorrect
    ? state.availableLetterUnlocks + 1
    : state.availableLetterUnlocks;

  const nextAnswers = {
    ...state.answers,
    [questionId]: { selected, isCorrect },
  };

  const answeredCount = Object.keys(nextAnswers).length;
  const allDone = answeredCount >= QUIZ_QUESTIONS.length;

  const nextState: GameState = {
    ...state,
    answers: nextAnswers,
    score: state.score + pointsEarned,
    streak: currentStreak,
    bestStreak: newBestStreak,
    availableLetterUnlocks: newAvailableUnlocks,
    isQuizCompleted: allDone,
  };

  return {
    nextState,
    result: {
      isCorrect,
      pointsEarned,
      streak: currentStreak,
      newAvailableUnlocks,
      explanationHy: question.explanationHy,
      explanationEs: question.explanationEs,
      allDone,
    },
  };
}

export interface RevealResult {
  success: boolean;
  letter: string;
  occurrences: number;
  bonusPoints: number;
  isWordCompleted: boolean;
  messageEs: string;
  messageHy: string;
}

export function revealLetter(
  state: GameState,
  letterToOpen: string,
  word: string = SECRET_WORD
): { nextState: GameState; result: RevealResult } {
  const cleanLetter = normalizeLetter(letterToOpen);
  if (!cleanLetter || cleanLetter.length !== 1) {
    return {
      nextState: state,
      result: {
        success: false,
        letter: cleanLetter,
        occurrences: 0,
        bonusPoints: 0,
        isWordCompleted: state.isWordCompleted,
        messageEs: 'Letra no válida.',
        messageHy: 'Անվավեր տառ։',
      },
    };
  }

  const alreadyRevealed = state.revealedLetters.includes(cleanLetter);
  if (alreadyRevealed) {
    return {
      nextState: state,
      result: {
        success: false,
        letter: cleanLetter,
        occurrences: 0,
        bonusPoints: 0,
        isWordCompleted: state.isWordCompleted,
        messageEs: `La letra ${cleanLetter} ya está abierta en el tablero.`,
        messageHy: `«${cleanLetter}» տառն արդեն բացված է տախտակին։`,
      },
    };
  }

  // Count occurrences in SECRET_WORD
  const occurrences = word.split('').filter((c) => c.toUpperCase() === cleanLetter).length;
  const consumesCredit = state.availableLetterUnlocks > 0;
  const nextUnlocks = consumesCredit ? state.availableLetterUnlocks - 1 : 0;

  if (occurrences > 0) {
    const updatedRevealed = [...state.revealedLetters, cleanLetter];
    const wordCompleted = isWordFullyRevealed(updatedRevealed, word);
    const bonusPoints = occurrences * 150 + (wordCompleted ? 1000 : 0);

    const nextState: GameState = {
      ...state,
      revealedLetters: updatedRevealed,
      availableLetterUnlocks: nextUnlocks,
      score: state.score + bonusPoints,
      isWordCompleted: wordCompleted,
    };

    return {
      nextState,
      result: {
        success: true,
        letter: cleanLetter,
        occurrences,
        bonusPoints,
        isWordCompleted: wordCompleted,
        messageEs: `¡Excelente! Hay ${occurrences} letra(s) "${cleanLetter}" en la palabra. (+${bonusPoints} pts)`,
        messageHy: `Հիանալի է։ «${cleanLetter}» տառը հանդիպում է ${occurrences} անգամ։ (+${bonusPoints} միավոր)`,
      },
    };
  } else {
    // Letter not in word
    const nextState: GameState = {
      ...state,
      availableLetterUnlocks: nextUnlocks,
    };

    return {
      nextState,
      result: {
        success: false,
        letter: cleanLetter,
        occurrences: 0,
        bonusPoints: 0,
        isWordCompleted: state.isWordCompleted,
        messageEs: `La letra "${cleanLetter}" no está en la palabra secreta.`,
        messageHy: `«${cleanLetter}» տառը գաղտնի բառի մեջ չկա։ Փորձեք մեկ այլ տառ։`,
      },
    };
  }
}

export function guessFullWord(
  state: GameState,
  guessedWord: string,
  targetWord: string = SECRET_WORD
): { nextState: GameState; success: boolean; bonusPoints: number; messageHy: string; messageEs: string } {
  const cleanGuess = guessedWord.trim().toUpperCase().replace(/\s+/g, '');
  const cleanTarget = targetWord.trim().toUpperCase();

  if (cleanGuess === cleanTarget) {
    const allLetters = Array.from(new Set(cleanTarget.split('')));
    const bonusPoints = 2500;
    const nextState: GameState = {
      ...state,
      revealedLetters: allLetters,
      isWordCompleted: true,
      score: state.score + bonusPoints,
    };
    return {
      nextState,
      success: true,
      bonusPoints,
      messageEs: `¡BRAVO! ¡Has acertado la palabra secreta: "${cleanTarget}"! (+${bonusPoints} pts)`,
      messageHy: `ԿԵՑՑԵ՛Ք: Դուք գուշակեցիք գաղտնի բառը՝ «${cleanTarget}» (Հարձակվող)։ (+${bonusPoints} միավոր)`,
    };
  } else {
    return {
      nextState: state,
      success: false,
      bonusPoints: 0,
      messageEs: `"${cleanGuess}" no es la palabra correcta. ¡Sigue respondiendo preguntas!`,
      messageHy: `«${cleanGuess}»-ը ճիշտ բառը չէ։ Շարունակեք պատասխանել հարցերին և բացել տառեր։`,
    };
  }
}
