import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Brain, AlertCircle, SkipForward, Rewind, Target } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useToast } from "@/hooks/use-toast";
import CalibrationPanel, { CalibrationSettings, defaultCalibrationSettings } from "./CalibrationPanel";

const MISTRAL_API_KEY = "aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ";

interface WordStatus {
  word: string;
  index: number;
  status: "pending" | "current" | "correct" | "incorrect";
}

interface AIReadingAssistantProps {
  script: string;
  isEnabled: boolean;
  setIsEnabled: (value: boolean) => void;
  onWordStatusChange: (words: WordStatus[]) => void;
  onControlCommand: (command: "pause" | "play" | "back" | "forward") => void;
  isPlaying: boolean;
}

// Normalize text for comparison (remove accents, lowercase, etc.)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
};

// Extract words from text
const extractWords = (text: string): string[] => {
  return text
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.replace(/[^\w\sáéíóúâêîôûãõàèìòùäëïöüç]/gi, ""));
};

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity percentage between two strings
const calculateSimilarity = (a: string, b: string): number => {
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(a, b);
  return Math.round((1 - distance / maxLen) * 100);
};

// Play audio feedback
const playFeedbackSound = (type: "correct" | "incorrect") => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === "correct") {
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.type = "sine";
    } else {
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
      oscillator.type = "square";
    }
    
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.error("Audio feedback error:", e);
  }
};

const AIReadingAssistant = ({
  script,
  isEnabled,
  setIsEnabled,
  onWordStatusChange,
  onControlCommand,
  isPlaying,
}: AIReadingAssistantProps) => {
  const { toast } = useToast();
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
  } = useSpeechRecognition();

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [scriptWords, setScriptWords] = useState<string[]>([]);
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastAnalyzedRef = useRef("");
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [calibration, setCalibration] = useState<CalibrationSettings>(defaultCalibrationSettings);
  const lastMatchedWordsRef = useRef<string[]>([]);
  const [matchHistory, setMatchHistory] = useState<{word: string; matched: boolean; similarity: number}[]>([]);

  // Parse script into words
  useEffect(() => {
    const words = extractWords(script);
    setScriptWords(words);
    setWordStatuses(
      words.map((word, index) => ({
        word,
        index,
        status: index === 0 ? "current" : "pending",
      }))
    );
    setCurrentWordIndex(0);
    lastMatchedWordsRef.current = [];
    setMatchHistory([]);
  }, [script]);

  // Find best matching word in look-ahead/behind window
  const findBestMatch = useCallback((spokenWord: string, fromIndex: number) => {
    const normalizedSpoken = normalizeText(spokenWord);
    let bestMatch = { index: -1, similarity: 0 };
    
    const startIdx = Math.max(0, fromIndex - calibration.wordsLookBehind);
    const endIdx = Math.min(scriptWords.length - 1, fromIndex + calibration.wordsLookAhead);
    
    for (let i = startIdx; i <= endIdx; i++) {
      const normalizedExpected = normalizeText(scriptWords[i]);
      const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
      
      if (similarity > bestMatch.similarity) {
        bestMatch = { index: i, similarity };
      }
    }
    
    return bestMatch;
  }, [scriptWords, calibration.wordsLookAhead, calibration.wordsLookBehind]);

  // Analyze speech with Mistral AI
  const analyzeWithMistral = useCallback(async (spokenText: string, expectedWords: string[], currentIndex: number) => {
    if (!spokenText.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);
    
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            {
              role: "system",
              content: `Você é um assistente de leitura de teleprompter. Analise o que o usuário falou e compare com o texto esperado.
              
Responda APENAS em JSON válido com este formato:
{
  "wordsMatched": número de palavras corretas consecutivas desde a posição atual,
  "incorrectWords": [índices das palavras incorretas],
  "command": "continue" | "pause" | "back",
  "reason": "breve explicação"
}

Regras:
- Se o usuário falou corretamente, incremente wordsMatched
- Se pulou ou errou uma palavra, marque em incorrectWords e command="pause"
- Se está muito atrás, command="back"
- Seja MUITO tolerante com pequenas variações de pronúncia
- Palavras parecidas devem ser aceitas (ex: "pra" = "para", "tá" = "está")`,
            },
            {
              role: "user",
              content: `Texto esperado a partir da posição ${currentIndex}: "${expectedWords.slice(currentIndex, currentIndex + calibration.wordsLookAhead).join(" ")}"
              
O usuário falou: "${spokenText}"

Analise e responda em JSON.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na API");
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Update word statuses based on analysis
        setWordStatuses(prev => {
          const updated = [...prev];
          
          // Mark matched words as correct
          for (let i = currentIndex; i < currentIndex + (analysis.wordsMatched || 0); i++) {
            if (updated[i]) {
              updated[i].status = "correct";
            }
          }
          
          // Mark incorrect words
          if (analysis.incorrectWords && calibration.pauseOnError) {
            analysis.incorrectWords.forEach((idx: number) => {
              const actualIdx = currentIndex + idx;
              if (updated[actualIdx]) {
                updated[actualIdx].status = "incorrect";
              }
            });
          }
          
          // Set new current word
          const newCurrentIndex = currentIndex + (analysis.wordsMatched || 0);
          if (updated[newCurrentIndex]) {
            updated[newCurrentIndex].status = "current";
          }
          
          return updated;
        });
        
        // Update current index
        const newIndex = currentIndex + (analysis.wordsMatched || 0);
        setCurrentWordIndex(newIndex);
        
        // Audio feedback
        if (calibration.audioFeedback) {
          if (analysis.wordsMatched > 0) {
            playFeedbackSound("correct");
          } else if (analysis.incorrectWords?.length > 0) {
            playFeedbackSound("incorrect");
          }
        }
        
        // Send command
        if (analysis.command === "pause" && isPlaying && calibration.pauseOnError) {
          onControlCommand("pause");
          toast({
            title: "Pausado",
            description: analysis.reason || "Palavra incorreta detectada",
            variant: "destructive",
          });
        } else if (analysis.command === "back") {
          onControlCommand("back");
        }
        
        onWordStatusChange(wordStatuses);
      }
    } catch (error) {
      console.error("Mistral analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isPlaying, onControlCommand, onWordStatusChange, toast, wordStatuses, calibration]);

  // Real-time word matching (faster, local) with calibration
  useEffect(() => {
    if (!isEnabled || !isListening) return;

    const fullTranscript = (transcript + " " + interimTranscript).trim();
    if (!fullTranscript || fullTranscript === lastAnalyzedRef.current) return;

    const spokenWords = extractWords(fullTranscript);
    
    // Check if we have new words
    if (spokenWords.length <= lastMatchedWordsRef.current.length) return;
    
    // Get only new words
    const newWords = spokenWords.slice(lastMatchedWordsRef.current.length);
    
    for (const spokenWord of newWords) {
      if (!spokenWord) continue;
      
      const expectedWord = scriptWords[currentWordIndex];
      if (!expectedWord) continue;

      const normalizedSpoken = normalizeText(spokenWord);
      const normalizedExpected = normalizeText(expectedWord);
      
      // Calculate similarity
      const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
      const distance = levenshteinDistance(normalizedSpoken, normalizedExpected);

      // Check if word matches using calibration settings
      const isExactMatch = normalizedSpoken === normalizedExpected;
      const isPartialMatch = normalizedExpected.includes(normalizedSpoken) || normalizedSpoken.includes(normalizedExpected);
      const isSimilarEnough = similarity >= calibration.matchThreshold;
      const isWithinTolerance = distance <= calibration.levenshteinTolerance;
      
      const isMatch = isExactMatch || isPartialMatch || (isSimilarEnough && isWithinTolerance);

      // Also check look-ahead/behind for possible matches
      const bestMatch = findBestMatch(spokenWord, currentWordIndex);
      const foundInWindow = bestMatch.similarity >= calibration.matchThreshold && bestMatch.index >= 0;

      // Update match history for debugging
      setMatchHistory(prev => [...prev.slice(-9), { word: spokenWord, matched: isMatch || foundInWindow, similarity: Math.max(similarity, bestMatch.similarity) }]);

      if (isMatch) {
        // Direct match with current word
        if (calibration.audioFeedback) {
          playFeedbackSound("correct");
        }
        
        setWordStatuses(prev => {
          const updated = [...prev];
          if (updated[currentWordIndex]) {
            updated[currentWordIndex].status = "correct";
          }
          if (updated[currentWordIndex + 1]) {
            updated[currentWordIndex + 1].status = "current";
          }
          return updated;
        });
        setCurrentWordIndex(prev => prev + 1);
        lastMatchedWordsRef.current = [...lastMatchedWordsRef.current, spokenWord];
      } else if (foundInWindow && bestMatch.index > currentWordIndex) {
        // User skipped ahead - mark skipped words and jump
        if (calibration.audioFeedback) {
          playFeedbackSound("correct");
        }
        
        setWordStatuses(prev => {
          const updated = [...prev];
          // Mark skipped words as correct (user likely said them quickly)
          for (let i = currentWordIndex; i <= bestMatch.index; i++) {
            if (updated[i]) {
              updated[i].status = "correct";
            }
          }
          if (updated[bestMatch.index + 1]) {
            updated[bestMatch.index + 1].status = "current";
          }
          return updated;
        });
        setCurrentWordIndex(bestMatch.index + 1);
        lastMatchedWordsRef.current = [...lastMatchedWordsRef.current, spokenWord];
      } else {
        // No match - schedule Mistral analysis for complex cases
        if (analysisTimeoutRef.current) {
          clearTimeout(analysisTimeoutRef.current);
        }
        analysisTimeoutRef.current = setTimeout(() => {
          analyzeWithMistral(fullTranscript, scriptWords, currentWordIndex);
          lastAnalyzedRef.current = fullTranscript;
        }, calibration.analysisDelay);
      }
    }
  }, [transcript, interimTranscript, isEnabled, isListening, currentWordIndex, scriptWords, analyzeWithMistral, calibration, findBestMatch]);

  // Update parent with word statuses
  useEffect(() => {
    onWordStatusChange(wordStatuses);
  }, [wordStatuses, onWordStatusChange]);

  // Start/stop listening based on playing state
  useEffect(() => {
    if (isEnabled && isPlaying && !isListening) {
      startListening();
    } else if (!isPlaying && isListening) {
      stopListening();
    }
  }, [isEnabled, isPlaying, isListening, startListening, stopListening]);

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (!enabled) {
      stopListening();
      resetTranscript();
      setWordStatuses(
        scriptWords.map((word, index) => ({
          word,
          index,
          status: index === 0 ? "current" : "pending",
        }))
      );
      setCurrentWordIndex(0);
      lastMatchedWordsRef.current = [];
      setMatchHistory([]);
    }
  };

  const handleGoBack = (words: number = 3) => {
    const newIndex = Math.max(0, currentWordIndex - words);
    setWordStatuses(prev => {
      const updated = [...prev];
      // Reset words from newIndex onwards
      for (let i = newIndex; i < updated.length; i++) {
        updated[i].status = i === newIndex ? "current" : "pending";
      }
      // Keep previous words as correct
      for (let i = 0; i < newIndex; i++) {
        updated[i].status = "correct";
      }
      return updated;
    });
    setCurrentWordIndex(newIndex);
    onControlCommand("back");
  };

  const handleSkip = (words: number = 1) => {
    const newIndex = Math.min(scriptWords.length - 1, currentWordIndex + words);
    setWordStatuses(prev => {
      const updated = [...prev];
      // Mark skipped words as correct
      for (let i = currentWordIndex; i < newIndex; i++) {
        if (updated[i]) {
          updated[i].status = "correct";
        }
      }
      if (updated[newIndex]) {
        updated[newIndex].status = "current";
      }
      return updated;
    });
    setCurrentWordIndex(newIndex);
  };

  const handleRecalibrate = () => {
    resetTranscript();
    lastMatchedWordsRef.current = [];
    setMatchHistory([]);
    lastAnalyzedRef.current = "";
    toast({
      title: "Recalibrado",
      description: "O assistente foi recalibrado. Continue lendo.",
    });
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-yellow-500 text-sm">
        <AlertCircle className="w-4 h-4" />
        Reconhecimento de voz não suportado
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          <Label className="text-sm font-medium">Assistente de Leitura IA</Label>
        </div>
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
      </div>

      {isEnabled && (
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-green-500">Ouvindo...</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Aguardando</span>
              </>
            )}
            {isAnalyzing && (
              <span className="text-cyan-400 text-xs ml-2">Analisando...</span>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Progresso: {currentWordIndex}/{scriptWords.length} palavras
          </div>

          {interimTranscript && (
            <div className="text-xs text-muted-foreground italic truncate">
              "{interimTranscript}"
            </div>
          )}

          {/* Match history */}
          {matchHistory.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {matchHistory.slice(-5).map((m, i) => (
                <span
                  key={i}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    m.matched
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                  title={`Similaridade: ${m.similarity}%`}
                >
                  {m.word} ({m.similarity}%)
                </span>
              ))}
            </div>
          )}

          {/* Quick controls */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGoBack(3)}
              className="text-xs flex-1"
            >
              <Rewind className="w-3 h-3 mr-1" />
              Voltar 3
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRecalibrate}
              className="text-xs flex-1"
            >
              <Target className="w-3 h-3 mr-1" />
              Recalibrar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSkip(1)}
              className="text-xs flex-1"
            >
              <SkipForward className="w-3 h-3 mr-1" />
              Pular
            </Button>
          </div>

          {/* Calibration panel */}
          <CalibrationPanel
            settings={calibration}
            onSettingsChange={setCalibration}
            onReset={() => setCalibration(defaultCalibrationSettings)}
          />
        </div>
      )}
    </div>
  );
};

export default AIReadingAssistant;
