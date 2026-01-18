import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, useAnimationControls } from "framer-motion";

interface WordStatus {
  word: string;
  index: number;
  status: "pending" | "current" | "correct" | "incorrect";
}

interface SmartTeleprompterProps {
  text: string;
  speed: number;
  fontSize: number;
  position: "top" | "center" | "bottom";
  isPlaying: boolean;
  mirrorMode: boolean;
  onProgressUpdate?: (progress: number) => void;
  wordStatuses?: WordStatus[];
  aiAssistEnabled?: boolean;
  onWordClick?: (wordIndex: number) => void;
}

export interface SmartTeleprompterRef {
  setScrollPosition: (percent: number) => void;
  reset: () => void;
  scrollToWord: (wordIndex: number) => void;
}

const SmartTeleprompter = forwardRef<SmartTeleprompterRef, SmartTeleprompterProps>(
  ({ text, speed, fontSize, position, isPlaying, mirrorMode, onProgressUpdate, wordStatuses: externalWordStatuses, aiAssistEnabled, onWordClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const controls = useAnimationControls();
    const [maxScroll, setMaxScroll] = useState(0);
    const animationRef = useRef<number | null>(null);
    const currentYRef = useRef(0);
    const [internalWordStatuses, setInternalWordStatuses] = useState<WordStatus[]>([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);

    // Track the highest word index reached to prevent going backwards
    const highestWordIndexRef = useRef(0);

    // Initialize word statuses from text
    useEffect(() => {
      const words = text.split(/\s+/).filter(w => w.length > 0);
      setInternalWordStatuses(
        words.map((word, index) => ({
          word,
          index,
          status: index === 0 ? "current" : "pending",
        }))
      );
      setCurrentWordIndex(0);
      highestWordIndexRef.current = 0;
    }, [text]);

    // Use external statuses if AI assist is enabled, otherwise use internal
    const wordStatuses = aiAssistEnabled && externalWordStatuses?.length ? externalWordStatuses : internalWordStatuses;

    // Auto-advance current word based on scroll position when not using AI assist
    useEffect(() => {
      if (aiAssistEnabled || !isPlaying) return;
      
      const totalWords = internalWordStatuses.length;
      if (totalWords === 0 || maxScroll === 0) return;

      const progress = Math.abs(currentYRef.current / maxScroll) * 100;
      const newWordIndex = Math.min(Math.floor((progress / 100) * totalWords), totalWords - 1);
      
      if (newWordIndex !== currentWordIndex) {
        setCurrentWordIndex(newWordIndex);
        setInternalWordStatuses(prev => 
          prev.map((ws, i) => ({
            ...ws,
            status: i < newWordIndex ? "correct" : i === newWordIndex ? "current" : "pending"
          }))
        );
      }
    }, [aiAssistEnabled, isPlaying, currentWordIndex, internalWordStatuses.length, maxScroll]);

    // Auto-scroll to current word when AI assist is enabled (only forward, never backward)
    useEffect(() => {
      if (!aiAssistEnabled || !externalWordStatuses?.length) return;
      
      // Find the current word index from external statuses
      const currentIdx = externalWordStatuses.findIndex(ws => ws.status === "current");
      if (currentIdx === -1) return;
      
      // Only scroll forward, never backward
      if (currentIdx <= highestWordIndexRef.current) return;
      
      highestWordIndexRef.current = currentIdx;
      
      const totalWords = externalWordStatuses.length;
      if (totalWords === 0 || maxScroll <= 0) return;
      
      // Calculate target scroll position to keep current word at ~2nd line from top
      const percent = Math.max(0, (currentIdx / totalWords) * 100);
      const targetY = -(maxScroll * percent / 100);
      
      // Only scroll if moving forward (targetY is more negative)
      if (targetY < currentYRef.current) {
        currentYRef.current = targetY;
        controls.start({
          y: targetY,
          transition: { duration: 0.3, ease: "easeOut" }
        });
        
        // Update progress
        const progress = Math.min(100, Math.abs(targetY / maxScroll) * 100);
        onProgressUpdate?.(progress);
      }
    }, [aiAssistEnabled, externalWordStatuses, maxScroll, controls, onProgressUpdate]);

    const positionClasses = {
      top: "items-start pt-2",
      center: "items-center",
      bottom: "items-end pb-4",
    };

    useImperativeHandle(ref, () => ({
      setScrollPosition: (percent: number) => {
        if (maxScroll > 0) {
          const targetY = -(maxScroll * percent / 100);
          currentYRef.current = targetY;
          controls.set({ y: targetY });
        }
      },
      reset: () => {
        currentYRef.current = 0;
        highestWordIndexRef.current = 0;
        controls.set({ y: 0 });
        onProgressUpdate?.(0);
      },
      scrollToWord: (wordIndex: number) => {
        // Reset the highest word index when user manually selects a word
        highestWordIndexRef.current = wordIndex;
        
        // Calculate approximate scroll position based on word index
        const totalWords = text.split(/\s+/).length;
        if (totalWords > 0 && maxScroll > 0) {
          const percent = (wordIndex / totalWords) * 100;
          const targetY = -(maxScroll * percent / 100);
          currentYRef.current = targetY;
          controls.start({
            y: targetY,
            transition: { duration: 0.3, ease: "easeOut" }
          });
        }
      }
    }));

    useEffect(() => {
      if (!textRef.current || !containerRef.current) return;

      const textHeight = textRef.current.scrollHeight;
      const containerHeight = containerRef.current.clientHeight;
      const scrollDistance = Math.max(0, textHeight - containerHeight + 50);
      setMaxScroll(scrollDistance);
    }, [text, fontSize]);

    useEffect(() => {
      if (!textRef.current || !containerRef.current || maxScroll <= 0) return;

      if (isPlaying && !aiAssistEnabled) {
        // Normal auto-scroll when AI assist is disabled
        const pixelsPerSecond = speed * 15;
        const remainingDistance = maxScroll + currentYRef.current;
        const duration = remainingDistance / pixelsPerSecond;

        if (duration > 0) {
          controls.start({
            y: -maxScroll,
            transition: {
              duration,
              ease: "linear",
            },
          });

          const startTime = Date.now();
          const startY = currentYRef.current;
          
          const updateProgress = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const currentY = startY - (elapsed * pixelsPerSecond);
            currentYRef.current = Math.max(-maxScroll, currentY);
            
            const progress = Math.min(100, Math.abs(currentYRef.current / maxScroll) * 100);
            onProgressUpdate?.(progress);
            
            if (currentYRef.current > -maxScroll && isPlaying) {
              animationRef.current = requestAnimationFrame(updateProgress);
            }
          };
          
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      } else {
        controls.stop();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [isPlaying, speed, maxScroll, controls, onProgressUpdate, aiAssistEnabled]);

    // Render text with word highlighting - ALWAYS show highlighting
    const renderText = () => {
      if (!wordStatuses || wordStatuses.length === 0) {
        // Fallback normal rendering only if no words parsed
        return text.split("\n").map((line, index) => (
          <p key={index} className="mb-2 mx-auto">
            {line || "\u00A0"}
          </p>
        ));
      }

      // Render with word-by-word highlighting
      let wordIndex = 0;
      return text.split("\n").map((line, lineIndex) => {
        const words = line.split(/(\s+)/);
        
        return (
          <p key={lineIndex} className="mb-2 mx-auto">
            {words.map((segment, segIndex) => {
              // If it's whitespace, render as-is
              if (/^\s+$/.test(segment)) {
                return <span key={`${lineIndex}-${segIndex}`}>{segment}</span>;
              }
              
              // If it's a word, apply styling
              if (segment.trim()) {
                const status = wordStatuses[wordIndex]?.status || "pending";
                wordIndex++;
                
                let className = "transition-all duration-200 inline-block ";
                switch (status) {
                  case "current":
                    className += "bg-white text-black px-2 py-0.5 rounded-md font-bold scale-110 shadow-lg";
                    break;
                  case "correct":
                    className += "text-green-400 font-semibold";
                    break;
                  case "incorrect":
                    className += "bg-red-500/50 text-red-200 px-1 rounded animate-pulse";
                    break;
                  default:
                    className += "text-white/70";
                }
                
                const currentWordIndex = wordIndex - 1;
                return (
                  <span 
                    key={`${lineIndex}-${segIndex}`} 
                    className={`${className} cursor-pointer hover:ring-2 hover:ring-white/50 hover:rounded`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWordClick?.(currentWordIndex);
                    }}
                  >
                    {segment}
                  </span>
                );
              }
              
              return segment;
            })}
            {!line && "\u00A0"}
          </p>
        );
      });
    };

    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 flex flex-col ${positionClasses[position]} overflow-hidden z-10`}
      >
        <motion.div
          ref={textRef}
          animate={controls}
          className={`w-full px-4 md:px-8 text-white text-center leading-relaxed ${mirrorMode ? "scale-x-[-1]" : ""}`}
          style={{
            fontSize: `${fontSize}px`,
            textShadow: "2px 2px 4px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.7)",
            fontWeight: 600,
            maxWidth: "100%",
            paddingTop: "20px",
          }}
        >
          {renderText()}
          <div style={{ height: "80vh" }} />
        </motion.div>
      </div>
    );
  }
);

SmartTeleprompter.displayName = "SmartTeleprompter";

export default SmartTeleprompter;