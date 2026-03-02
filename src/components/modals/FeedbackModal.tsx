import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TextureCard } from "../ui/TextureCard";
import { TextureButton } from "../ui/TextureButton";
import { submitFeedback } from "../../firebase/roomService";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitFeedback(name, message);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setName("");
        setMessage("");
        setSubmitted(false);
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="w-[360px] max-w-[calc(100vw-2rem)]"
          >
            <TextureCard>
              <h2 className="mb-1 text-xl font-bold">Send Feedback</h2>
              <p className="mb-4 text-sm text-white/50">
                Found a bug or an issue with a question? Let us know — all feedback is read by the creator.
              </p>

              {submitted ? (
                <p className="py-4 text-center text-green-400 font-medium">Thanks! Feedback sent.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 w-full outline-none focus:border-white/25"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe the issue..."
                    rows={3}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 w-full outline-none focus:border-white/25 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <TextureButton variant="default" onClick={onClose}>
                      Cancel
                    </TextureButton>
                    <TextureButton
                      variant="primary"
                      onClick={handleSubmit}
                      disabled={!message.trim() || submitting}
                    >
                      {submitting ? "Sending…" : "Submit"}
                    </TextureButton>
                  </div>
                </div>
              )}
            </TextureCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
