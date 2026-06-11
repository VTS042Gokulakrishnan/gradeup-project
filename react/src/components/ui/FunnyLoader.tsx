import { motion } from 'framer-motion';
import React from 'react';

export interface FunnyLoaderProps {
  text?: string;
  subtext?: string;
  fullScreen?: boolean;
}

const FunnyLoader: React.FC<FunnyLoaderProps> = ({ 
  text = "Loading…", 
  subtext,
  fullScreen = false 
}) => {
  return (
    <div 
      className={`flex flex-col items-center justify-center gap-5 ${
        fullScreen ? 'fixed inset-0 bg-background z-[9999]' : 'py-12 w-full h-full min-h-[200px]'
      }`}
    >
      <motion.div 
        className="w-[60px] h-[60px] rounded-[16px] flex items-center justify-center text-[28px] shadow-[0_0_40px_rgba(0,195,122,0.35)]"
        style={{ background: 'linear-gradient(135deg, #00c37a, #2d9cdb)' }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      >
        🎓
      </motion.div>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-[15px] font-bold text-foreground tracking-[0.05em]">{text}</div>
        {subtext && <div className="text-[11px] text-muted-foreground tracking-[0.08em] uppercase">{subtext}</div>}
      </div>
      
      {/* Loading Bar */}
      <div className="w-[200px] h-[3px] bg-muted overflow-hidden mt-1 rounded-full relative">
        <motion.div 
          className="h-full absolute left-0 top-0 rounded-full w-full"
          style={{ background: 'linear-gradient(135deg, #00c37a, #2d9cdb)' }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
        />
      </div>
    </div>
  );
};

export default FunnyLoader;
