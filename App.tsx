/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCw,
  Trophy,
  Sparkles,
  CheckCircle2,
  XCircle,
  Flame,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Languages,
  Award,
  Layers,
  HelpCircle,
  Check,
  Star,
  RefreshCw,
} from 'lucide-react';
import {
  QUIZ_QUESTIONS,
  ROUNDS_INFO,
  SECRET_WORD,
  SECRET_WORD_HINT_ES,
  SECRET_WORD_HINT_HY,
  SECRET_WORD_TRANSLATION_HY,
} from './quizData.ts';
import type { QuizQuestion } from './quizData.ts';
import {
  createInitialGameState,
  getWordProgress,
  isWordFullyRevealed,
  getRemainingUniqueLetters,
  submitAnswer,
  revealLetter,
  guessFullWord,
  WHEEL_SECTORS,
} from './gameLogic.ts';
import type { GameState, WheelSector } from './gameLogic.ts';
import { sounds, speakSpanish } from './soundEffects.ts';

const SPANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    // Check autostart query parameter if present
    return createInitialGameState();
  });

  const [currentRoundId, setCurrentRoundId] = useState<number>(1);
  const [selectedLetterToOpen, setSelectedLetterToOpen] = useState<string | null>(null);
  const [showLetterPickerModal, setShowLetterPickerModal] = useState<boolean>(false);
  const [showGuessWordModal, setShowGuessWordModal] = useState<boolean>(false);
  const [guessWordInput, setGuessWordInput] = useState<string>('');
  const [showGrammarGuide, setShowGrammarGuide] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Translation interaction states: track which Spanish text IDs or elements have active translations shown
  const [revealedTranslations, setRevealedTranslations] = useState<Record<string, boolean>>({});
  const [alwaysShowTranslations, setAlwaysShowTranslations] = useState<boolean>(false);

  // Drum / Wheel state
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [activeSector, setActiveSector] = useState<WheelSector | null>(null);
  const [drumBonusMultiplier, setDrumBonusMultiplier] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const currentQuestion = useMemo(() => {
    return QUIZ_QUESTIONS[gameState.currentQuestionIndex] || QUIZ_QUESTIONS[0];
  }, [gameState.currentQuestionIndex]);

  const wordProgress = useMemo(() => {
    return getWordProgress(gameState.revealedLetters, SECRET_WORD);
  }, [gameState.revealedLetters]);

  const remainingLetters = useMemo(() => {
    return getRemainingUniqueLetters(gameState.revealedLetters, SECRET_WORD);
  }, [gameState.revealedLetters]);

  const isWordWon = useMemo(() => {
    return isWordFullyRevealed(gameState.revealedLetters, SECRET_WORD);
  }, [gameState.revealedLetters]);

  // Trigger victory modal when word is solved
  useEffect(() => {
    if (isWordWon && !gameState.isWordCompleted) {
      setGameState((prev) => ({ ...prev, isWordCompleted: true }));
      sounds.playFanfare();
      setShowVictoryModal(true);
    }
  }, [isWordWon, gameState.isWordCompleted]);

  // Show Toast Helper
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Toggle translation for a specific item
  const toggleTranslation = (id: string, textEs?: string) => {
    setRevealedTranslations((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    if (textEs) {
      speakSpanish(textEs);
    }
  };

  const isTranslationVisible = (id: string) => {
    return alwaysShowTranslations || !!revealedTranslations[id];
  };

  // Draw Drum / Wheel of Fortune on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const sectors = WHEEL_SECTORS;
    const arc = (2 * Math.PI) / sectors.length;

    ctx.clearRect(0, 0, size, size);

    // Save context for rotation
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((wheelRotation * Math.PI) / 180);

    // Outer golden rim
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Draw sectors
    sectors.forEach((sec, i) => {
      const angle = i * arc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 4, angle, angle + arc);
      ctx.lineTo(0, 0);
      ctx.fillStyle = sec.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff33';
      ctx.stroke();

      // Sector Text
      ctx.save();
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = sec.textColor;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 3;
      ctx.fillText(sec.label, radius - 24, 5);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚽ POLE', 0, 4);

    ctx.restore();
  }, [wheelRotation]);

  // Spin Drum Function
  const handleSpinDrum = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setActiveSector(null);

    const spinRotations = 5 + Math.random() * 4; // 5 to 9 full turns
    const randomSectorIndex = Math.floor(Math.random() * WHEEL_SECTORS.length);
    const sectorArcDeg = 360 / WHEEL_SECTORS.length;
    // Pointer is at the top (270 deg or 90 deg depending on orientation)
    const targetDeg = 360 * spinRotations + (360 - (randomSectorIndex * sectorArcDeg + sectorArcDeg / 2) + 270) % 360;

    const startRot = wheelRotation % 360;
    const finalRot = wheelRotation + (targetDeg - (wheelRotation % 360)) + 360 * 4;
    const duration = 3200; // ms
    const startTime = performance.now();

    let lastTickAngle = startRot;

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentRot = startRot + (finalRot - startRot) * ease;

      setWheelRotation(currentRot);

      // Play tick sound when passing sectors
      if (Math.abs(currentRot - lastTickAngle) > sectorArcDeg) {
        sounds.playTick();
        lastTickAngle = currentRot;
      }

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        setIsSpinning(false);
        const sectorWon = WHEEL_SECTORS[randomSectorIndex];
        setActiveSector(sectorWon);

        if (sectorWon.type === 'plus') {
          // +1 letter unlock
          setGameState((prev) => ({
            ...prev,
            availableLetterUnlocks: prev.availableLetterUnlocks + 1,
            score: prev.score + 100,
          }));
          sounds.playCorrect();
          showToast(`🎯 Сектор «+1 ТАРР»! Դուք ստացաք տառ բացելու լրացուցիչ հնարավորություն:`, 'success');
        } else if (sectorWon.type === 'multiplier') {
          setDrumBonusMultiplier(sectorWon.value);
          sounds.playCorrect();
          showToast(`⚡ Сектор «x2»! Հաջորդ ճիշտ պատասխանի միավորները կկրկնապատկվեն:`, 'success');
        } else if (sectorWon.type === 'prize') {
          setGameState((prev) => ({
            ...prev,
            score: prev.score + sectorWon.value,
            availableLetterUnlocks: prev.availableLetterUnlocks + 1,
          }));
          sounds.playFanfare();
          showToast(`🏆 Сектор «ՊՐԻԶ»! +${sectorWon.value} միավոր և +1 տառ բացելու իրավունք:`, 'success');
        } else {
          // Points
          setGameState((prev) => ({
            ...prev,
            score: prev.score + sectorWon.value,
          }));
          sounds.playCorrect();
          showToast(`🎰 Բարաբանը կանգնեց ${sectorWon.label} միավորի վրա!`, 'info');
        }
      }
    };

    requestAnimationFrame(animateSpin);
  };

  // Submit Answer to current Question
  const handleSelectOption = (optionKey: 'A' | 'B' | 'C') => {
    // Prevent re-answering already answered question
    if (gameState.answers[currentQuestion.id]) return;

    const { nextState, result } = submitAnswer(gameState, currentQuestion.id, optionKey, drumBonusMultiplier);
    setGameState(nextState);

    // Reset multiplier after answering
    if (drumBonusMultiplier > 1) {
      setDrumBonusMultiplier(1);
    }

    if (result.isCorrect) {
      sounds.playCorrect();
      showToast(
        `✅ Ճիշտ է! (+${result.pointsEarned} միավոր)։ Դուք վաստակեցիք +1 տառ բացելու իրավունք!`,
        'success'
      );
    } else {
      sounds.playWrong();
      showToast(
        `❌ Սխալ պատասխան: Ճիշտ էր ${currentQuestion.correctAnswer} տարբերակը:`,
        'error'
      );
    }
  };

  // Pick & Reveal Letter on DELANTERO board
  const handleOpenLetter = (letter: string) => {
    if (gameState.availableLetterUnlocks <= 0) {
      showToast(`⚠️ Տառ բացելու համար նախ ճիշտ պատասխանեք հարցին կամ պտտեք բարաբանը:`, 'error');
      return;
    }

    const { nextState, result } = revealLetter(gameState, letter, SECRET_WORD);
    setGameState(nextState);

    if (result.success) {
      sounds.playLetterReveal();
      showToast(result.messageHy, 'success');
      setShowLetterPickerModal(false);
      setSelectedLetterToOpen(null);

      if (result.isWordCompleted) {
        sounds.playFanfare();
        setShowVictoryModal(true);
      }
    } else {
      sounds.playWrong();
      showToast(result.messageHy, 'error');
    }
  };

  // Guess Full Word Directly
  const handleGuessFullWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessWordInput.trim()) return;

    const res = guessFullWord(gameState, guessWordInput, SECRET_WORD);
    setGameState(res.nextState);
    setShowGuessWordModal(false);
    setGuessWordInput('');

    if (res.success) {
      sounds.playFanfare();
      showToast(res.messageHy, 'success');
      setShowVictoryModal(true);
    } else {
      sounds.playWrong();
      showToast(res.messageHy, 'error');
    }
  };

  // Navigate to Question
  const handleSelectQuestion = (index: number) => {
    setGameState((prev) => ({
      ...prev,
      currentQuestionIndex: index,
    }));
    const targetQ = QUIZ_QUESTIONS[index];
    if (targetQ && targetQ.roundId !== currentRoundId) {
      setCurrentRoundId(targetQ.roundId);
    }
  };

  // Reset Game
  const handleRestart = () => {
    setGameState(createInitialGameState());
    setCurrentRoundId(1);
    setRevealedTranslations({});
    setShowVictoryModal(false);
    showToast(`🔄 Խաղը վերսկսվեց: Բարի գալուստ «Հրաշքների Դաշտ»!`, 'info');
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const answeredQuestionsCount = Object.keys(gameState.answers).length;
  const correctCount = Object.values(gameState.answers).filter((a) => a.isCorrect).length;
  const currentAnswer = gameState.answers[currentQuestion.id];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 text-xl">
              🎯
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500">
                  Поле Чудес — Presente de Subjuntivo
                </h1>
                <span className="hidden sm:inline-block text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                  A2–B1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Español – Հայերեն | 30 preguntas — 30 հարց
              </p>
            </div>
          </div>

          {/* Quick HUD Metrics */}
          <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
            {/* Score */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg shadow-inner">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-slate-400 font-medium">Միավոր / Очки:</span>
              <span className="font-bold text-amber-300 text-sm md:text-base">{gameState.score}</span>
            </div>

            {/* Unlocks Bank */}
            <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-lg shadow-inner">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium hidden sm:inline">Բացել տառ / Буква:</span>
              <span className="text-emerald-300 font-medium sm:hidden">Տառ:</span>
              <span className="font-extrabold text-emerald-200 text-sm md:text-base">
                {gameState.availableLetterUnlocks}
              </span>
            </div>

            {/* Streak */}
            {gameState.streak > 1 && (
              <div className="hidden sm:flex items-center gap-1 bg-orange-950/60 border border-orange-500/40 px-2.5 py-1.5 rounded-lg text-orange-300">
                <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
                <span className="font-bold">{gameState.streak}x</span>
              </div>
            )}

            {/* Translation Mode Switch */}
            <button
              onClick={() => setAlwaysShowTranslations(!alwaysShowTranslations)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                alwaysShowTranslations
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Միացնել/անջատել հայերեն բոլոր թարգմանությունների ավտոմատ ցուցադրումը"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {alwaysShowTranslations ? 'Թարգմ. Միշտ Բաց' : 'Սեղմել Թարգմ. Համար'}
              </span>
            </button>

            {/* Grammar Guide Button */}
            <button
              onClick={() => setShowGrammarGuide(true)}
              className="flex items-center gap-1 bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-500/40 text-indigo-200 px-2.5 py-1.5 rounded-lg font-medium transition"
              title="Presente de Subjuntivo կանոններ"
            >
              <BookOpen className="w-4 h-4 text-indigo-300" />
              <span className="hidden lg:inline">Քերականություն</span>
            </button>

            {/* Mute Toggle */}
            <button
              onClick={handleToggleMute}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              aria-label={isMuted ? 'Միացնել ձայնը' : 'Անջատել ձայնը'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Pole Chudes Secret Word Board & Drum Wheel (5 cols on lg) */}
        <section className="lg:col-span-5 flex flex-col gap-4">

          {/* Secret Word Display Board (Поле Чудес Табло) */}
          <div className="bg-gradient-to-b from-slate-900 to-indigo-950/80 rounded-2xl border-2 border-amber-500/30 p-4 md:p-5 shadow-xl shadow-amber-950/10 flex flex-col relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                    Գաղտնի Բառը · Главное Слово
                  </h2>
                  <p className="text-xs text-slate-400">
                    Պատասխանեք հարցերին՝ տառերը բացելու համար
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                {wordProgress.filter((p) => p.isRevealed).length} / {SECRET_WORD.length} տառ
              </span>
            </div>

            {/* Letter Slots Grid */}
            <div className="bg-slate-950/90 rounded-xl p-3 border border-amber-500/40 shadow-inner my-2 flex items-center justify-center">
              <div className="grid grid-cols-9 gap-1 sm:gap-1.5 w-full max-w-md mx-auto">
                {wordProgress.map((slot) => {
                  const isOpened = slot.isRevealed;
                  return (
                    <div
                      key={slot.index}
                      className={`relative aspect-[3/4] flex flex-col items-center justify-center rounded-lg border-2 font-black transition-all duration-300 select-none shadow-md ${
                        isOpened
                          ? 'bg-gradient-to-b from-amber-300 via-yellow-200 to-amber-400 border-amber-500 text-slate-950 scale-100 shadow-amber-500/20'
                          : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700/80 text-slate-500 hover:border-amber-400/50'
                      }`}
                    >
                      {/* Slot Header Number */}
                      <span
                        className={`text-[9px] font-mono absolute top-0.5 left-1 ${
                          isOpened ? 'text-amber-900/60' : 'text-slate-600'
                        }`}
                      >
                        {slot.index + 1}
                      </span>

                      {/* Letter or Question Mark */}
                      <span className="text-base sm:text-xl md:text-2xl font-black mt-1">
                        {isOpened ? slot.char : '?'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Secret Word Hint & Translation Section */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 text-xs mt-1 space-y-1.5">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-slate-300">
                    <span className="text-amber-400 font-semibold">Հուշում (Հայերեն): </span>
                    {SECRET_WORD_HINT_HY}
                  </p>
                  <p
                    onClick={() => toggleTranslation('hint_es', SECRET_WORD_HINT_ES)}
                    className="text-slate-400 italic mt-0.5 cursor-pointer hover:text-amber-300 transition flex items-center gap-1"
                    title="Սեղմեք իսպաներեն հուշումը լսելու համար"
                  >
                    <span>Pista (Español): {SECRET_WORD_HINT_ES}</span>
                    <Volume2 className="w-3 h-3 text-amber-400/70 inline" />
                  </p>
                </div>
              </div>

              {isWordWon && (
                <div className="mt-2 bg-emerald-950/70 border border-emerald-500/50 p-2.5 rounded-lg flex items-center gap-2 text-emerald-200">
                  <Award className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold">DELANTERO = {SECRET_WORD_TRANSLATION_HY}!</span>
                    <p className="text-[11px] text-emerald-300/90">
                      Դուք հաջողությամբ բացահայտեցիք գլխավոր բառը:
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons for Letter Revealing & Word Guessing */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => setShowLetterPickerModal(true)}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-lg ${
                  gameState.availableLetterUnlocks > 0
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 hover:brightness-110 shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-750 border border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Բացել Տառ / Буква ({gameState.availableLetterUnlocks})</span>
              </button>

              <button
                onClick={() => setShowGuessWordModal(true)}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:to-indigo-500 text-indigo-50 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-lg border border-indigo-400/30"
              >
                <Award className="w-4 h-4 text-yellow-300" />
                <span>Գուշակել / Назвать слово</span>
              </button>
            </div>
          </div>

          {/* Interactive Drum / Wheel Section (Барабан Поле Чудес) */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 md:p-5 flex flex-col items-center justify-center relative shadow-lg">
            <div className="w-full flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <RotateCw className={`w-4 h-4 text-amber-400 ${isSpinning ? 'animate-spin' : ''}`} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Բարաբան · Барабан
                </h3>
              </div>
              {drumBonusMultiplier > 1 && (
                <span className="text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40 px-2 py-0.5 rounded-full animate-pulse">
                  Ակտիվ է x{drumBonusMultiplier} բոնուս
                </span>
              )}
            </div>

            {/* Drum Canvas with Pointer */}
            <div className="relative my-2">
              {/* Pointer at the top */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[18px] border-t-amber-400 filter drop-shadow(0 2px 4px rgba(0,0,0,0.6))" />

              <canvas
                ref={canvasRef}
                width={260}
                height={260}
                className="rounded-full shadow-2xl border-4 border-slate-800"
              />
            </div>

            {/* Drum Controls & Status */}
            <div className="w-full flex flex-col items-center gap-2 mt-2">
              <button
                onClick={handleSpinDrum}
                disabled={isSpinning}
                className={`w-full max-w-xs py-2.5 px-4 rounded-xl font-black text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 ${
                  isSpinning
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 text-white hover:brightness-110 shadow-emerald-500/20 ring-2 ring-emerald-400/30'
                }`}
              >
                <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'Բարաբանը պտտվում է...' : 'Պտտել Բարաբանը! (Крутить барабан)'}</span>
              </button>

              <p className="text-[11px] text-slate-400 text-center">
                Պտտեք՝ միավորներ, բոնուսներ և տառ բացելու լրացուցիչ իրավունք շահելու համար
              </p>
            </div>
          </div>

          {/* Quick Round Selector Tabs */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3">
            <h4 className="text-xs font-semibold text-slate-400 mb-2 px-1 flex items-center justify-between">
              <span>Փուլեր (6 Rondas)</span>
              <span className="text-[11px] text-amber-400">
                {answeredQuestionsCount} / {QUIZ_QUESTIONS.length} ավարտված
              </span>
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ROUNDS_INFO.map((round) => {
                const isCurrent = round.id === currentRoundId;
                const roundQuestions = QUIZ_QUESTIONS.filter((q) => q.roundId === round.id);
                const roundAnswered = roundQuestions.filter((q) => gameState.answers[q.id]).length;
                const isComplete = roundAnswered === roundQuestions.length;

                return (
                  <button
                    key={round.id}
                    onClick={() => {
                      setCurrentRoundId(round.id);
                      handleSelectQuestion(round.startId - 1);
                    }}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-0.5 ${
                      isCurrent
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 ring-1 ring-amber-400/30'
                        : isComplete
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-slate-800'
                        : 'bg-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">{round.emoji}</span>
                    <span className="text-[11px] font-bold">Ronda {round.id}</span>
                    <span className="text-[9px] text-slate-400">
                      {roundAnswered}/{roundQuestions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </section>

        {/* Right Column: Interactive Subjunctive Quiz Card & Translation Explorer (7 cols on lg) */}
        <section className="lg:col-span-7 flex flex-col gap-4">

          {/* Round Header & Question Stepper */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentQuestion.roundEmoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Ronda {currentQuestion.roundId} · {currentQuestion.roundTitleEs}
                    </span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="text-xs text-slate-300 font-medium">
                      {currentQuestion.roundTitleHy}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-100">
                    Հարց #{currentQuestion.id} / 30
                  </h2>
                </div>
              </div>

              {/* Prev / Next Nav */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSelectQuestion(Math.max(0, gameState.currentQuestionIndex - 1))}
                  disabled={gameState.currentQuestionIndex === 0}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-300 border border-slate-700 transition"
                  aria-label="Նախորդ հարցը"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSelectQuestion(Math.min(QUIZ_QUESTIONS.length - 1, gameState.currentQuestionIndex + 1))}
                  disabled={gameState.currentQuestionIndex === QUIZ_QUESTIONS.length - 1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-300 border border-slate-700 transition"
                  aria-label="Հաջորդ հարցը"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question Quick Strip Navigation (30 pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
              {QUIZ_QUESTIONS.map((q, idx) => {
                const ans = gameState.answers[q.id];
                const isSelected = idx === gameState.currentQuestionIndex;
                let bgStyle = 'bg-slate-800 border-slate-700 text-slate-400';
                if (ans) {
                  bgStyle = ans.isCorrect
                    ? 'bg-emerald-950 border-emerald-500/70 text-emerald-300'
                    : 'bg-rose-950 border-rose-500/70 text-rose-300';
                }
                if (isSelected) {
                  bgStyle += ' ring-2 ring-amber-400 font-black text-amber-300';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleSelectQuestion(idx)}
                    className={`flex-shrink-0 w-7 h-7 rounded-lg border text-xs font-semibold flex items-center justify-center transition hover:scale-105 ${bgStyle}`}
                    title={`Հարց ${q.id} (${q.roundTitleEs})`}
                  >
                    {q.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Question Card */}
          <div className="bg-slate-900/90 rounded-2xl border-2 border-slate-800 p-5 md:p-6 shadow-xl flex flex-col gap-4 relative">

            {/* Spanish Sentence (Click to reveal Armenian translation) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-amber-400 flex items-center gap-1">
                  <span>Իսպաներեն նախադասություն (Español)</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                    💡 Սեղմեք՝ թարգմանությունը տեսնելու համար
                  </span>
                </span>

                <button
                  onClick={() => speakSpanish(currentQuestion.sentenceEs)}
                  className="flex items-center gap-1 text-slate-300 hover:text-amber-300 transition text-xs"
                  title="Լսել արտասանությունը"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Լսել</span>
                </button>
              </div>

              {/* Clickable Sentence Box */}
              <div
                onClick={() => toggleTranslation(`q_${currentQuestion.id}`, currentQuestion.sentenceEs)}
                className="group p-4 rounded-xl bg-gradient-to-r from-slate-950 to-indigo-950/40 border border-amber-500/30 hover:border-amber-400/70 cursor-pointer transition shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg md:text-xl font-bold text-amber-200 tracking-wide leading-relaxed group-hover:text-amber-100 transition">
                    {currentQuestion.sentenceEs}
                  </p>
                  <Languages className="w-5 h-5 text-amber-400/60 group-hover:text-amber-300 flex-shrink-0 mt-1" />
                </div>

                {/* Subjunctive Trigger Badge */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-medium">
                    Trigger: {currentQuestion.subjunctiveTrigger}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({currentQuestion.triggerMeaningHy})
                  </span>
                </div>
              </div>

              {/* Armenian Translation Box (revealed on click or alwaysShow) */}
              {isTranslationVisible(`q_${currentQuestion.id}`) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm animate-fadeIn flex items-start gap-2.5 shadow-inner">
                  <span className="text-base flex-shrink-0">🇦🇲</span>
                  <div>
                    <span className="font-bold text-amber-300 text-xs uppercase tracking-wider block mb-0.5">
                      Հայերեն թարգմանություն՝
                    </span>
                    <p className="text-sm md:text-base font-medium text-amber-100">
                      {currentQuestion.sentenceHy}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Answer Options (A, B, C) */}
            <div className="space-y-2.5 mt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Ընտրեք ճիշտ տարբերակը (Presente de Subjuntivo)՝
              </span>

              <div className="grid grid-cols-1 gap-2.5">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentAnswer?.selected === opt.key;
                  const isCorrectAnswer = currentQuestion.correctAnswer === opt.key;
                  const hasAnswered = !!currentAnswer;

                  let cardStyle = 'bg-slate-950/60 border-slate-800 hover:border-amber-400/50 hover:bg-slate-850';
                  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';

                  if (hasAnswered) {
                    if (isCorrectAnswer) {
                      cardStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-100 ring-1 ring-emerald-400/40';
                      badgeStyle = 'bg-emerald-600 text-white border-emerald-400';
                    } else if (isSelected) {
                      cardStyle = 'bg-rose-950/60 border-rose-500 text-rose-100 ring-1 ring-rose-400/40';
                      badgeStyle = 'bg-rose-600 text-white border-rose-400';
                    } else {
                      cardStyle = 'bg-slate-950/40 border-slate-800/80 opacity-60';
                    }
                  }

                  const translationId = `opt_${currentQuestion.id}_${opt.key}`;
                  const showOptTrans = isTranslationVisible(translationId);

                  return (
                    <div
                      key={opt.key}
                      onClick={() => !hasAnswered && handleSelectOption(opt.key)}
                      className={`p-3.5 rounded-xl border-2 transition-all flex flex-col gap-1.5 cursor-pointer shadow-md ${cardStyle}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg border flex items-center justify-center font-black text-sm ${badgeStyle}`}>
                            {opt.key}
                          </span>
                          <div>
                            <span className="text-base font-bold text-slate-100">
                              {opt.text}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Audio button for option */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakSpanish(opt.text);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-amber-300 transition"
                            title="Լսել արտասանությունը"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>

                          {/* Toggle option translation button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTranslation(translationId);
                            }}
                            className="text-xs px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
                            title="Տեսնել տարբերակի հայերեն բացատրությունը"
                          >
                            {showOptTrans ? 'Թաքցնել' : '🇦🇲 Թարգմ.'}
                          </button>

                          {hasAnswered && isCorrectAnswer && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          )}
                          {hasAnswered && isSelected && !isCorrectAnswer && (
                            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Option Armenian Translation */}
                      {showOptTrans && (
                        <div className="text-xs text-amber-300/90 pl-11 italic border-t border-slate-800/60 pt-1">
                          {opt.translationHy}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Answer Feedback & Subjunctive Explanation Card */}
            {currentAnswer && (
              <div className="mt-2 p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentAnswer.isCorrect ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Ճիշտ պատասխան! ✅ Respuesta: {currentQuestion.correctAnswer}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-rose-400 font-bold text-sm">
                        <XCircle className="w-5 h-5" />
                        <span>Սխալ: Ճիշտ պատասխանն է՝ {currentQuestion.correctAnswer}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => speakSpanish(currentQuestion.completedSentenceEs)}
                    className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 transition"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Լսել ամբողջական նախադասությունը</span>
                  </button>
                </div>

                {/* Completed Sentence Preview */}
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-xs md:text-sm">
                  <p className="font-bold text-indigo-200">
                    🇪🇸 {currentQuestion.completedSentenceEs}
                  </p>
                  <p className="text-indigo-300/80 mt-1">
                    🇦🇲 {currentQuestion.completedSentenceHy}
                  </p>
                </div>

                {/* Subjunctive Grammar Explanation */}
                <div className="text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-amber-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Ինչո՞ւ է այստեղ օգտագործվում Subjuntivo՝</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    {currentQuestion.explanationHy}
                  </p>
                  <p className="text-slate-400 italic text-[11px] pt-1">
                    Explicación en español: {currentQuestion.explanationEs}
                  </p>
                </div>

                {/* Bottom Action: Next Question or Unlock Letter */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  {gameState.availableLetterUnlocks > 0 && !isWordWon && (
                    <button
                      onClick={() => setShowLetterPickerModal(true)}
                      className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition shadow-md shadow-amber-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Օգտագործել տառ բացելու իրավունքը!</span>
                    </button>
                  )}

                  {gameState.currentQuestionIndex < QUIZ_QUESTIONS.length - 1 && (
                    <button
                      onClick={() => handleSelectQuestion(gameState.currentQuestionIndex + 1)}
                      className="ml-auto py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <span>Հաջորդ հարցը ({gameState.currentQuestionIndex + 2}/30)</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Quick Subjunctive Grammar Hint Card */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm">
                A2
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-200 block">
                  Presente de Subjuntivo Կանոն
                </span>
                <span className="text-slate-400">
                  -AR բայերը ստանում են <strong className="text-amber-300">-E</strong>, իսկ -ER / -IR բայերը՝ <strong className="text-amber-300">-A</strong>:
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowGrammarGuide(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold whitespace-nowrap"
            >
              Դիտել աղյուսակը →
            </button>
          </div>

        </section>

      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-bounce-short">
          <div
            className={`p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500 text-rose-100'
                : 'bg-slate-900/90 border-amber-500 text-amber-100'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
            {toastMessage.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
            {toastMessage.type === 'info' && <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />}
            <p className="text-xs sm:text-sm font-medium leading-relaxed">{toastMessage.text}</p>
          </div>
        </div>
      )}

      {/* Letter Picker Modal (Поле Чудес: Открыть букву на выбор) */}
      {showLetterPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl max-w-lg w-full p-5 md:p-6 shadow-2xl relative">
            <button
              onClick={() => setShowLetterPickerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Փակել"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✨</span>
              <h3 className="text-lg font-black text-amber-300">
                Բացել Տառ Ըստ Ձեր Ընտրության
              </h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Դուք ունեք <strong className="text-emerald-400 font-bold">{gameState.availableLetterUnlocks}</strong> տառ բացելու իրավունք:
              Ընտրեք իսպաներեն այբուբենի ցանկացած տառ՝ գաղտնի բառի մեջ այն բացելու համար:
            </p>

            {/* Word Slots Preview in Modal */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 flex items-center justify-center gap-1.5">
              {wordProgress.map((slot) => (
                <div
                  key={slot.index}
                  className={`w-7 h-9 sm:w-8 sm:h-10 rounded border flex items-center justify-center font-black text-base ${
                    slot.isRevealed
                      ? 'bg-amber-400 text-slate-950 border-amber-500'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {slot.isRevealed ? slot.char : '?'}
                </div>
              ))}
            </div>

            {/* Alphabet Keyboard */}
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 my-2">
              {SPANISH_ALPHABET.map((char) => {
                const isAlreadyOpened = gameState.revealedLetters.includes(char);
                const isSelected = selectedLetterToOpen === char;

                return (
                  <button
                    key={char}
                    disabled={isAlreadyOpened}
                    onClick={() => setSelectedLetterToOpen(char)}
                    className={`aspect-square rounded-lg border font-bold text-sm flex items-center justify-center transition ${
                      isAlreadyOpened
                        ? 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black scale-110 shadow-lg shadow-amber-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>

            {/* Selected Letter Action */}
            <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                {selectedLetterToOpen ? (
                  <span>
                    Ընտրված տառ՝ <strong className="text-amber-300 text-base">{selectedLetterToOpen}</strong>
                  </span>
                ) : (
                  'Սեղմեք տառի վրա'
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLetterPickerModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Չեղարկել
                </button>
                <button
                  type="button"
                  disabled={!selectedLetterToOpen}
                  onClick={() => selectedLetterToOpen && handleOpenLetter(selectedLetterToOpen)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20"
                >
                  Հաստատել և Բացել
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guess Entire Word Modal (Поле Чудес: Назвать слово сразу) */}
      {showGuessWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-2xl max-w-md w-full p-5 md:p-6 shadow-2xl relative">
            <button
              onClick={() => setShowGuessWordModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Փակել"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Award className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-black text-slate-100">
                Գուշակել Ամբողջ Բառը Միանգամից
              </h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Եթե գիտեք գաղտնի բառը (9 տառ, իսպաներեն ֆուտբոլային տերմին), մուտքագրեք այն այստեղ և ստացեք <strong>+2500 միավոր</strong>:
            </p>

            <form onSubmit={handleGuessFullWordSubmit} className="space-y-4">
              <div>
                <label htmlFor="guessWord" className="block text-xs font-semibold text-amber-400 mb-1">
                  Գաղտնի բառը (Español)՝
                </label>
                <input
                  id="guessWord"
                  type="text"
                  value={guessWordInput}
                  onChange={(e) => setGuessWordInput(e.target.value)}
                  placeholder="Օրինակ՝ DELANTERO"
                  maxLength={15}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-indigo-500/40 text-amber-300 font-mono text-center tracking-widest text-lg font-black focus:outline-none focus:border-amber-400 transition uppercase"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                💡 Հուշում. Թիմի հիմնական գոլահարը, որը խաղում է հարձակման գծում:
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGuessWordModal(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Փակել
                </button>
                <button
                  type="submit"
                  disabled={!guessWordInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs transition shadow-lg shadow-indigo-500/25"
                >
                  Ստուգել Բառը
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grammar Reference Guide Modal */}
      {showGrammarGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl max-w-2xl w-full p-5 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative">
            <button
              onClick={() => setShowGrammarGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Փակել"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-black text-amber-300">
                Presente de Subjuntivo — Կանոններ և Աղյուսակ
              </h3>
            </div>

            <div className="text-xs text-slate-300 space-y-4 leading-relaxed">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-amber-400 text-sm mb-1">
                  Ե՞րբ է օգտագործվում Subjuntivo-ն
                </h4>
                <p>
                  Subjuntivo-ն օգտագործվում է, երբ արտահայտում ենք <strong>ցանկություն, հույս, կասկած, հույզ կամ խորհուրդ</strong> (ոչ թե օբյեկտիվ փաստ)։
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Querer que</strong> (ցանկանալ, որ) → El profesor quiere que estudiemos.</li>
                  <li><strong className="text-slate-200">Esperar que</strong> (հուսալ, որ) → Espero que apruebes el examen.</li>
                  <li><strong className="text-slate-200">Es importante que</strong> (կարևոր է, որ) → Es importante que presten atención.</li>
                  <li><strong className="text-slate-200">No creer que</strong> (չկարծել, որ) → No creo que el árbitro tenga razón.</li>
                  <li><strong className="text-slate-200">Ojalá</strong> (երանի՜) → Ojalá podamos viajar este verano.</li>
                </ul>
              </div>

              {/* Conjugation Rules Table */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 overflow-x-auto">
                <h4 className="font-bold text-amber-400 text-sm mb-2">
                  Վերջավորությունները (Terminaciones)
                </h4>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1.5 px-2">Դերանուն</th>
                      <th className="py-1.5 px-2">-AR (estudiar)</th>
                      <th className="py-1.5 px-2">-ER (comer)</th>
                      <th className="py-1.5 px-2">-IR (vivir)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">yo</td>
                      <td className="py-1.5 px-2 text-amber-300">estudie</td>
                      <td className="py-1.5 px-2 text-indigo-300">coma</td>
                      <td className="py-1.5 px-2 text-indigo-300">viva</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">tú</td>
                      <td className="py-1.5 px-2 text-amber-300">estudies</td>
                      <td className="py-1.5 px-2 text-indigo-300">comas</td>
                      <td className="py-1.5 px-2 text-indigo-300">vivas</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">él/ella</td>
                      <td className="py-1.5 px-2 text-amber-300">estudie</td>
                      <td className="py-1.5 px-2 text-indigo-300">coma</td>
                      <td className="py-1.5 px-2 text-indigo-300">viva</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">nosotros</td>
                      <td className="py-1.5 px-2 text-amber-300">estudiemos</td>
                      <td className="py-1.5 px-2 text-indigo-300">comamos</td>
                      <td className="py-1.5 px-2 text-indigo-300">vivamos</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-400">ellos/ellas</td>
                      <td className="py-1.5 px-2 text-amber-300">estudien</td>
                      <td className="py-1.5 px-2 text-indigo-300">coman</td>
                      <td className="py-1.5 px-2 text-indigo-300">vivan</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Irregular Verbs */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-amber-400 text-sm mb-1">
                  Կարևոր անկանոն բայեր (Verbos Irregulares)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 font-mono text-[11px]">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-slate-300 block">IR (գնալ)</strong>
                    <span className="text-amber-300">vaya, vayas, vayamos</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-slate-300 block">SER (լինել)</strong>
                    <span className="text-amber-300">sea, seas, seamos</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-slate-300 block">TENER (ունենալ)</strong>
                    <span className="text-amber-300">tenga, tengas, tengamos</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-slate-300 block">HACER (անել)</strong>
                    <span className="text-amber-300">haga, hagas, hagamos</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-slate-300 block">DECIR (ասել)</strong>
                    <span className="text-amber-300">diga, digas, digamos</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <strong className="text-slate-300 block">ESTAR (գտնվել)</strong>
                    <span className="text-amber-300">esté, estés, estemos</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowGrammarGuide(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
              >
                Պարզ է, վերադառնալ խաղին
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {showVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-b from-slate-900 to-indigo-950 border-2 border-amber-400 rounded-3xl max-w-lg w-full p-6 md:p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/30 mb-4 animate-bounce">
              🏆
            </div>

            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 mb-1">
              ¡FELICITACIONES! · ՇՆՈՐՀԱՎՈՐՈՒՄ ԵՆՔ!
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Դուք հաջողությամբ բացեցիք գլխավոր բառը «Հրաշքների Դաշտ» խաղում!
            </p>

            {/* Solved Word Reveal */}
            <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40 my-3">
              <div className="text-xs text-amber-400 font-semibold mb-1">
                Գաղտնի բառը (Palabra secreta)՝
              </div>
              <div className="text-3xl font-black tracking-widest text-amber-300 font-mono">
                DELANTERO
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {SECRET_WORD_TRANSLATION_HY} (Football Striker / Forward)
              </div>
            </div>

            {/* Score & Accuracy Stats */}
            <div className="grid grid-cols-3 gap-2 my-4">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Միավոր</span>
                <span className="text-lg font-bold text-amber-300">{gameState.score}</span>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Ճիշտ</span>
                <span className="text-lg font-bold text-emerald-400">{correctCount} / 30</span>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Լավագույն Սթրիք</span>
                <span className="text-lg font-bold text-orange-400">{gameState.bestStreak}x</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5">
              <button
                onClick={() => setShowVictoryModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Շարունակել Թեստը
              </button>
              <button
                onClick={handleRestart}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Սկսել Նոր Խաղ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-850 bg-slate-950/90 px-4 py-3 text-center text-xs text-slate-500">
        <p>
          🎯 Quiz Presente de Subjuntivo | 30 preguntas (Español – Հայերեն A2–B1) | Խաղ «Հրաշքների Դաշտ» (Delantero)
        </p>
      </footer>
    </div>
  );
}
