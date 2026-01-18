import { useState, useRef, useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";

interface TeleprompterProps {
  text: string;
  speed: number;
  fontSize: number;
  position: "top" | "center" | "bottom";
  isPlaying: boolean;
  mirrorMode: boolean;
}

const Teleprompter = ({ text, speed, fontSize, position, isPlaying, mirrorMode }: TeleprompterProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [scrollPosition, setScrollPosition] = useState(0);

  const positionClasses = {
    top: "items-start pt-2",
    center: "items-center",
    bottom: "items-end pb-4",
  };

  useEffect(() => {
    if (!textRef.current || !containerRef.current) return;

    const textHeight = textRef.current.scrollHeight;
    const containerHeight = containerRef.current.clientHeight;
    const scrollDistance = textHeight - containerHeight + 100;

    if (isPlaying && scrollDistance > 0) {
      const duration = scrollDistance / (speed * 10);
      controls.start({
        y: -scrollDistance,
        transition: {
          duration,
          ease: "linear",
        },
      });
    } else {
      controls.stop();
    }
  }, [isPlaying, speed, text, controls]);

  const resetScroll = () => {
    controls.set({ y: 0 });
    setScrollPosition(0);
  };

  useEffect(() => {
    if (!isPlaying) {
      resetScroll();
    }
  }, [text]);

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
          textShadow: "2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
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
};

export default Teleprompter;
