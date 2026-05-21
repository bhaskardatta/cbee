import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const SplashScreen = () => {
  const navigate = useNavigate();
  const [displayedText, setDisplayedText] = useState("");
  const fullText = "Cbee";

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => {
    let index = 0;
    const typewriterInterval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typewriterInterval);
      }
    }, 300);

    return () => clearInterval(typewriterInterval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#26A69A] to-cbee-background">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center"
      >
        <div className="rounded-full overflow-hidden w-48 h-48 mb-6 border-4 border-white shadow-lg">
          <img
            src="/lovable-uploads/9019dcec-1bb4-4b6c-aa4d-8c082145555e.png"
            alt="Cbee Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <motion.h1
          className="text-4xl font-bold bg-gradient-to-r from-[#26A69A] to-cbee-secondary bg-clip-text text-transparent"
          style={{
            WebkitTextStroke: "1px white",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.1)",
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {displayedText}
        </motion.h1>
        <motion.p
          className="text-sm mt-2 text-gray-600"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          Share your pet moments
        </motion.p>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
