import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MISTRAL_API_KEY = "aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ";

interface ScriptEditorProps {
  script: string;
  setScript: (value: string) => void;
}

const ScriptEditor = ({ script, setScript }: ScriptEditorProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

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
          className="min-h-[200px] resize-y"
        />
      </div>
    </div>
  );
};

export default ScriptEditor;
