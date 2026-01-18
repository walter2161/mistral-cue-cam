import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, useAnimationControls } from "framer-motion";

interface TeleprompterProps {
  text: string;
  speed: number;
  fontSize: number;
  position: "top" | "center" | "bottom";
  isPlaying: boolean;
  mirrorMode: boolean;
  onProgressUpdate?: (progress: number) => void;
}

export interface TeleprompterRef {
  setScrollPosition: (percent: number) => void;
  reset: () => void;
}

const Teleprompter = forwardRef<TeleprompterRef, TeleprompterProps>(
  ({ text, speed, fontSize, position, isPlaying, mirrorMode, onProgressUpdate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const controls = useAnimationControls();
    const [maxScroll, setMaxScroll] = useState(0);
    const animationRef = useRef<number | null>(null);
    const currentYRef = useRef(0);

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
        controls.set({ y: 0 });
        onProgressUpdate?.(0);
      },
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

      if (isPlaying) {
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

          // Update progress during animation
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
    }, [isPlaying, speed, maxScroll, controls, onProgressUpdate]);

    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 flex flex-col ${positionClasses[position]} overflow-hidden pointer-events-none z-10`}
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
          }}
        >
          {text.split("\n").map((line, index) => (
            <p key={index} className="mb-2 mx-auto">
              {line || "\u00A0"}
            </p>
          ))}
        </motion.div>
      </div>
    );
  }
);

Teleprompter.displayName = "Teleprompter";

export default Teleprompter;