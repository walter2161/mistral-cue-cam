import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Brain, AlertCircle } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useToast } from "@/hooks/use-toast";

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
  }, [script]);

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
- Seja tolerante com pequenas variações de pronúncia`,
            },
            {
              role: "user",
              content: `Texto esperado a partir da posição ${currentIndex}: "${expectedWords.slice(currentIndex, currentIndex + 10).join(" ")}"
              
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
          if (analysis.incorrectWords) {
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
        
        // Send command
        if (analysis.command === "pause" && isPlaying) {
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
  }, [isAnalyzing, isPlaying, onControlCommand, onWordStatusChange, toast, wordStatuses]);

  // Real-time word matching (faster, local)
  useEffect(() => {
    if (!isEnabled || !isListening) return;

    const fullTranscript = (transcript + " " + interimTranscript).trim();
    if (!fullTranscript || fullTranscript === lastAnalyzedRef.current) return;

    const spokenWords = extractWords(fullTranscript);
    const lastSpokenWord = spokenWords[spokenWords.length - 1];
    
    if (!lastSpokenWord) return;

    // Quick local matching
    const expectedWord = scriptWords[currentWordIndex];
    if (!expectedWord) return;

    const normalizedSpoken = normalizeText(lastSpokenWord);
    const normalizedExpected = normalizeText(expectedWord);

    // Check if word matches (with some tolerance)
    const isMatch = normalizedSpoken === normalizedExpected ||
      normalizedExpected.includes(normalizedSpoken) ||
      normalizedSpoken.includes(normalizedExpected) ||
      levenshteinDistance(normalizedSpoken, normalizedExpected) <= 2;

    if (isMatch) {
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
    } else {
      // Schedule Mistral analysis for complex cases
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      analysisTimeoutRef.current = setTimeout(() => {
        analyzeWithMistral(fullTranscript, scriptWords, currentWordIndex);
        lastAnalyzedRef.current = fullTranscript;
      }, 1500);
    }
  }, [transcript, interimTranscript, isEnabled, isListening, currentWordIndex, scriptWords, analyzeWithMistral]);

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
      // Reset all words to pending
      setWordStatuses(
        scriptWords.map((word, index) => ({
          word,
          index,
          status: index === 0 ? "current" : "pending",
        }))
      );
      setCurrentWordIndex(0);
    }
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
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
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

          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setWordStatuses(prev => {
                  const updated = [...prev];
                  // Find last incorrect and mark as current
                  let lastIncorrect = -1;
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].status === "incorrect") {
                      lastIncorrect = i;
                      break;
                    }
                  }
                  if (lastIncorrect >= 0) {
                    updated[lastIncorrect].status = "current";
                    setCurrentWordIndex(lastIncorrect);
                  }
                  return updated;
                });
                onControlCommand("back");
              }}
              className="text-xs"
            >
              Voltar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Skip current word
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
              }}
              className="text-xs"
            >
              Pular
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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

export default AIReadingAssistant;
