import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, History, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

const MISTRAL_API_KEY = "aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ";
const SCRIPT_HISTORY_KEY = "teleprompter_script_history";
const MAX_HISTORY_ITEMS = 10;

interface ScriptHistoryItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  source: "manual" | "ai";
}

interface ScriptEditorProps {
  script: string;
  setScript: (value: string) => void;
}

const ScriptEditor = ({ script, setScript }: ScriptEditorProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<ScriptHistoryItem[]>([]);
  const { toast } = useToast();

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SCRIPT_HISTORY_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading script history:", e);
      }
    }
  }, []);

  // Save script to history
  const saveToHistory = (content: string, source: "manual" | "ai", customTitle?: string) => {
    if (!content.trim() || content.length < 20) return;

    const title = customTitle || content.substring(0, 50).replace(/\n/g, " ").trim() + "...";
    
    const newItem: ScriptHistoryItem = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date().toISOString(),
      source,
    };

    setHistory(prev => {
      // Check if same content already exists
      const exists = prev.some(item => item.content === content);
      if (exists) return prev;

      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(SCRIPT_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Load script from history
  const loadFromHistory = (item: ScriptHistoryItem) => {
    setScript(item.content);
    toast({
      title: "Roteiro carregado",
      description: `"${item.title}" foi carregado`,
    });
  };

  // Delete from history
  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(SCRIPT_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    toast({
      title: "Removido",
      description: "Roteiro removido do histórico",
    });
  };

  // Clear all history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(SCRIPT_HISTORY_KEY);
    toast({
      title: "Histórico limpo",
      description: "Todos os roteiros foram removidos",
    });
  };

  const generateScript = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Erro",
        description: "Digite um tema para gerar o roteiro",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

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
              content:
                "Você é um roteirista profissional. Crie roteiros claros, bem estruturados e fáceis de ler em um teleprompter. Use frases curtas, parágrafos pequenos e linguagem natural para falar. Não use emojis ou formatação especial. O roteiro deve ser fluido para leitura em voz alta.",
            },
            {
              role: "user",
              content: `Crie um roteiro para teleprompter sobre: ${prompt}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na API da Mistral");
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || "";
      setScript(generatedText);
      
      // Save to history with the prompt as title
      saveToHistory(generatedText, "ai", `IA: ${prompt.substring(0, 40)}...`);

      toast({
        title: "Sucesso!",
        description: "Roteiro gerado com sucesso",
      });
    } catch (error) {
      console.error("Error generating script:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o roteiro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save manual script on blur
  const handleScriptBlur = () => {
    if (script.trim().length >= 20) {
      saveToHistory(script, "manual");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Gerar Roteiro com IA</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Digite o tema do roteiro..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateScript()}
          />
          <Button
            onClick={generateScript}
            disabled={isGenerating}
            className="gap-2 shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Gerar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Roteiro</Label>
        <Textarea
          placeholder="Digite ou gere seu roteiro aqui..."
          value={script}
          onChange={(e) => setScript(e.target.value)}
          onBlur={handleScriptBlur}
          className="min-h-[200px] resize-y"
        />
      </div>

      {/* Script History */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="history" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="text-sm font-medium">Histórico de Roteiros</span>
              {history.length > 0 && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                  {history.length}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum roteiro salvo ainda
              </p>
            ) : (
              <>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(item.createdAt)}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                item.source === "ai" 
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" 
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              }`}>
                                {item.source === "ai" ? "IA" : "Manual"}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => deleteFromHistory(item.id, e)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  className="w-full mt-3 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Histórico
                </Button>
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default ScriptEditor;