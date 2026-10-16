import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  getWordProgress,
  isWordFullyRevealed,
  revealLetter,
  guessFullWord,
  submitAnswer,
  getRemainingUniqueLetters,
} from './gameLogic.ts';
import { QUIZ_QUESTIONS, SECRET_WORD } from './quizData.ts';

test('Initial state initializes properly with 1 free letter unlock turn', () => {
  const state = createInitialGameState();
  assert.equal(state.revealedLetters.length, 0);
  assert.equal(state.availableLetterUnlocks, 1);
  assert.equal(state.score, 0);
  assert.equal(state.isWordCompleted, false);
  assert.equal(state.isQuizCompleted, false);
});

test('Word progress reflects hidden and revealed letters correctly for DELANTERO', () => {
  const progress1 = getWordProgress([]);
  assert.equal(progress1.length, 9);
  assert.ok(progress1.every((p) => !p.isRevealed));
  assert.equal(progress1.map((p) => p.char).join(''), 'DELANTERO');

  const progress2 = getWordProgress(['E']);
  // 'E' is at index 1 and index 6 in DELANTERO (D - E - L - A - N - T - E - R - O)
  assert.equal(progress2[1].isRevealed, true);
  assert.equal(progress2[6].isRevealed, true);
  assert.equal(progress2[0].isRevealed, false);
  assert.equal(isWordFullyRevealed(['E']), false);
});

test('Revealing letter E reveals 2 occurrences in DELANTERO and awards points', () => {
  const state = createInitialGameState();
  const { nextState, result } = revealLetter(state, 'E');

  assert.equal(result.success, true);
  assert.equal(result.occurrences, 2);
  assert.equal(nextState.revealedLetters.includes('E'), true);
  assert.equal(nextState.availableLetterUnlocks, 0);
  assert.ok(nextState.score > 0);
});

test('Revealing a letter not in DELANTERO fails gracefully without adding to revealed letters', () => {
  const state = createInitialGameState();
  const { nextState, result } = revealLetter(state, 'Z');

  assert.equal(result.success, false);
  assert.equal(result.occurrences, 0);
  assert.equal(nextState.revealedLetters.includes('Z'), false);
  assert.equal(nextState.availableLetterUnlocks, 0);
});

test('Correct answer gives +1 letter unlock and increments score and streak', () => {
  const state = createInitialGameState();
  // Question 1: "El profesor quiere que nosotros ___ más." Correct is 'B' (estudiemos)
  const { nextState, result } = submitAnswer(state, 1, 'B');

  assert.equal(result.isCorrect, true);
  assert.equal(nextState.streak, 1);
  assert.equal(nextState.availableLetterUnlocks, 2); // 1 initial + 1 earned
  assert.ok(nextState.score >= 100);
});

test('Incorrect answer resets streak but does not reduce letter unlocks', () => {
  const state = createInitialGameState();
  // Question 1 incorrect: 'A' (estudiamos)
  const { nextState, result } = submitAnswer(state, 1, 'A');

  assert.equal(result.isCorrect, false);
  assert.equal(nextState.streak, 0);
  assert.equal(nextState.availableLetterUnlocks, 1);
  assert.equal(nextState.score, 0);
});

test('Guessing the full word DELANTERO directly finishes the word and grants bonus', () => {
  const state = createInitialGameState();
  const res = guessFullWord(state, 'delantero');

  assert.equal(res.success, true);
  assert.equal(res.nextState.isWordCompleted, true);
  assert.ok(res.bonusPoints >= 2000);
});

test('Remaining unique letters shrinks as letters are opened', () => {
  const lettersBefore = getRemainingUniqueLetters([]);
  const lettersAfter = getRemainingUniqueLetters(['D', 'E']);
  assert.equal(lettersBefore.length, 8); // D, E, L, A, N, T, R, O
  assert.equal(lettersAfter.length, 6);
  assert.ok(!lettersAfter.includes('D'));
  assert.ok(!lettersAfter.includes('E'));
});

test('All 30 quiz questions are defined with required properties', () => {
  assert.equal(QUIZ_QUESTIONS.length, 30);
  for (const q of QUIZ_QUESTIONS) {
    assert.ok(q.id >= 1 && q.id <= 30);
    assert.ok(q.sentenceEs.length > 0);
    assert.ok(q.sentenceHy.length > 0);
    assert.equal(q.options.length, 3);
    assert.ok(['A', 'B', 'C'].includes(q.correctAnswer));
    assert.ok(q.explanationEs.length > 0);
    assert.ok(q.explanationHy.length > 0);
  }
});
